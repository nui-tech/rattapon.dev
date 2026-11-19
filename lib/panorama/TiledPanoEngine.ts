import * as THREE from "three";
import {
  LOD_LEVELS,
  LODSelectionMode,
  TileSource,
  ViewerTelemetry,
} from "./types";
import {
  clamp,
  computeHFovDeg,
  DEFAULT_UNCALIBRATED_VFOV_DEG,
  degToRad,
  MAX_VFOV_DEG,
  MIN_VFOV_DEG,
} from "./calibrationMath";

const SPHERE_RADIUS = 50;
const MAX_CONCURRENT_LOADS = 6;
const MAX_CACHED_TEXTURES = 96;

interface TileNode {
  key: string;
  level: number;
  col: number;
  row: number;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  wireframe: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  boundingBox: THREE.Box3;
  centerDir: THREE.Vector3;
  texture: THREE.Texture | null;
  status: "idle" | "loading" | "loaded" | "error";
  lastUsedFrame: number;
  loadedAt: number;
  abortController: AbortController | null;
}

export interface EngineCallbacks {
  onTelemetry?: (telemetry: ViewerTelemetry) => void;
  onUserZoom?: (newVFovDeg: number) => void;
}

function makeTileKey(level: number, col: number, row: number): string {
  return `${level}/${row}_${col}`;
}

/**
 * Builds an inside-facing spherical patch geometry matching equirectangular UV bounds
 * for tile (level, col, row), plus its 3D bounding box and unit center direction.
 */
function createTileGeometry(
  level: number,
  col: number,
  row: number
): {
  geometry: THREE.BufferGeometry;
  wireGeometry: THREE.BufferGeometry;
  boundingBox: THREE.Box3;
  centerDir: THREE.Vector3;
} {
  const cfg = LOD_LEVELS[level];
  const phiStart = (col / cfg.cols) * Math.PI * 2;
  const phiLength = (1 / cfg.cols) * Math.PI * 2;
  const thetaStart = (row / cfg.rows) * Math.PI;
  const thetaLength = (1 / cfg.rows) * Math.PI;

  // Higher segment counts on coarser tiles so curvature aligns sub-pixel across LOD levels
  const segW = level === 0 ? 24 : level === 1 ? 14 : level === 2 ? 8 : 6;
  const segH = level === 0 ? 24 : level === 1 ? 14 : level === 2 ? 8 : 6;

  const geometry = new THREE.SphereGeometry(
    SPHERE_RADIUS,
    segW,
    segH,
    phiStart,
    phiLength,
    thetaStart,
    thetaLength
  );
  // Flip X to face inward while keeping equirectangular left-to-right orientation non-mirrored
  geometry.scale(-1, 1, 1);
  geometry.computeBoundingBox();
  const boundingBox = geometry.boundingBox!.clone();

  // Compute unit direction to tile center in flipped sphere space:
  // x = +cos(phi)*sin(theta), y = cos(theta), z = sin(phi)*sin(theta)
  const phiMid = phiStart + phiLength * 0.5;
  const thetaMid = thetaStart + thetaLength * 0.5;
  const centerDir = new THREE.Vector3(
    Math.cos(phiMid) * Math.sin(thetaMid),
    Math.cos(thetaMid),
    Math.sin(phiMid) * Math.sin(thetaMid)
  ).normalize();

  // Build crisp perimeter loop slightly inside the sphere radius for optional LOD debug wireframe
  const wireRadius = SPHERE_RADIUS * 0.995;
  const steps = Math.max(6, Math.round(16 / (level + 1)));
  const pts: THREE.Vector3[] = [];
  const pushPt = (phi: number, theta: number) => {
    pts.push(
      new THREE.Vector3(
        wireRadius * Math.cos(phi) * Math.sin(theta),
        wireRadius * Math.cos(theta),
        wireRadius * Math.sin(phi) * Math.sin(theta)
      )
    );
  };
  // Top edge (thetaStart)
  for (let i = 0; i <= steps; i++) {
    pushPt(phiStart + (i / steps) * phiLength, thetaStart);
  }
  // Right edge (phiStart + phiLength)
  for (let i = 1; i <= steps; i++) {
    pushPt(phiStart + phiLength, thetaStart + (i / steps) * thetaLength);
  }
  // Bottom edge (thetaStart + thetaLength)
  for (let i = 1; i <= steps; i++) {
    pushPt(phiStart + (1 - i / steps) * phiLength, thetaStart + thetaLength);
  }
  // Left edge (phiStart)
  for (let i = 1; i <= steps; i++) {
    pushPt(phiStart, thetaStart + (1 - i / steps) * thetaLength);
  }

  const wireGeometry = new THREE.BufferGeometry().setFromPoints(pts);

  return { geometry, wireGeometry, boundingBox, centerDir };
}

/**
 * Marzipano-inspired Three.js 4-level multi-resolution tiled equirectangular panorama engine.
 */
export class TiledPanoEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private tileGroup: THREE.Group;
  private wireGroup: THREE.Group;
  private horizonGroup: THREE.Group;

  private tiles = new Map<string, TileNode>();
  private activeLoads = 0;
  private frameCounter = 0;
  private sourceGeneration = 0;

  private source: TileSource | null = null;
  private callbacks: EngineCallbacks;

  // Camera state with smooth damping
  private yawDeg = 180;
  private pitchDeg = 0;
  private targetYawDeg = 180;
  private targetPitchDeg = 0;
  private vFovDeg = DEFAULT_UNCALIBRATED_VFOV_DEG;
  private targetVFovDeg = DEFAULT_UNCALIBRATED_VFOV_DEG;

  private viewportWidth = 1;
  private viewportHeight = 1;

  // Options
  private lodMode: LODSelectionMode = "auto";
  private showLodGrid = false;
  private showHorizonRing = false;

  // Pointer drag state
  private isDragging = false;
  private activePointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private velocityYaw = 0;
  private velocityPitch = 0;

  // Pinch zoom state (touch devices)
  private activePointers = new Map<number, { x: number; y: number }>();
  private lastPinchDist: number | null = null;

  // Loop & observers
  private animId: number | null = null;
  private resizeObserver: ResizeObserver;
  private lastTelemetryTime = 0;
  private disposed = false;

  // Reusable math objects
  private readonly frustum = new THREE.Frustum();
  private readonly projScreenMatrix = new THREE.Matrix4();
  private readonly lookDir = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.sortObjects = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030712);

    this.camera = new THREE.PerspectiveCamera(
      this.vFovDeg,
      Math.max(1, canvas.clientWidth) / Math.max(1, canvas.clientHeight),
      0.1,
      200
    );

    this.tileGroup = new THREE.Group();
    this.wireGroup = new THREE.Group();
    this.horizonGroup = this.buildHorizonRing();
    this.horizonGroup.visible = false;

    this.scene.add(this.tileGroup);
    this.scene.add(this.wireGroup);
    this.scene.add(this.horizonGroup);

    this.buildTilePyramidNodes();

    this.resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      this.handleResize(rect.width, rect.height);
    });
    this.resizeObserver.observe(canvas);

    this.attachInputListeners();
    this.handleResize(canvas.clientWidth || 800, canvas.clientHeight || 500);
    this.startLoop();
  }

  private buildTilePyramidNodes(): void {
    for (const cfg of LOD_LEVELS) {
      for (let row = 0; row < cfg.rows; row++) {
        for (let col = 0; col < cfg.cols; col++) {
          const key = makeTileKey(cfg.level, col, row);
          const { geometry, wireGeometry, boundingBox, centerDir } =
            createTileGeometry(cfg.level, col, row);

          const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: cfg.level > 0,
            opacity: cfg.level === 0 ? 1 : 0,
            depthTest: false,
            depthWrite: false,
          });

          const mesh = new THREE.Mesh(geometry, material);
          mesh.visible = false;
          mesh.frustumCulled = false; // Managed explicitly by our Marzipano-style frustum pass
          mesh.renderOrder = cfg.level;
          this.tileGroup.add(mesh);

          const wireMat = new THREE.LineBasicMaterial({
            color: cfg.hexColor,
            transparent: true,
            opacity: 0.72,
            depthTest: false,
            depthWrite: false,
          });
          const wireframe = new THREE.Line(wireGeometry, wireMat);
          wireframe.visible = false;
          wireframe.frustumCulled = false;
          wireframe.renderOrder = 10 + cfg.level;
          this.wireGroup.add(wireframe);

          this.tiles.set(key, {
            key,
            level: cfg.level,
            col,
            row,
            mesh,
            wireframe,
            boundingBox,
            centerDir,
            texture: null,
            status: "idle",
            lastUsedFrame: 0,
            loadedAt: 0,
            abortController: null,
          });
        }
      }
    }
  }

  private buildHorizonRing(): THREE.Group {
    const group = new THREE.Group();
    const r = SPHERE_RADIUS * 0.99;

    // Equator horizon circle (pitch = 0°)
    const ringPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(r * Math.cos(a), 0, r * Math.sin(a)));
    }
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
    const ringLine = new THREE.Line(
      ringGeo,
      new THREE.LineBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.5,
        depthTest: false,
        depthWrite: false,
      })
    );
    ringLine.renderOrder = 20;
    group.add(ringLine);

    // 15° azimuth vertical tick marks along the horizon
    const tickVerts: number[] = [];
    for (let deg = 0; deg < 360; deg += 15) {
      const a = degToRad(deg);
      const halfH = deg % 90 === 0 ? 2.2 : deg % 45 === 0 ? 1.4 : 0.75;
      const x = r * Math.cos(a);
      const z = r * Math.sin(a);
      tickVerts.push(x, -halfH, z, x, halfH, z);
    }
    const tickGeo = new THREE.BufferGeometry();
    tickGeo.setAttribute("position", new THREE.Float32BufferAttribute(tickVerts, 3));
    const ticks = new THREE.LineSegments(
      tickGeo,
      new THREE.LineBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.65,
        depthTest: false,
        depthWrite: false,
      })
    );
    ticks.renderOrder = 21;
    group.add(ticks);

    return group;
  }

  public setSource(source: TileSource): void {
    this.sourceGeneration++;
    this.clearAllTileTextures();
    this.source = source;

    if (typeof source.initialYawDeg === "number") {
      this.yawDeg = source.initialYawDeg;
      this.targetYawDeg = source.initialYawDeg;
    }
    if (typeof source.initialPitchDeg === "number") {
      this.pitchDeg = source.initialPitchDeg;
      this.targetPitchDeg = source.initialPitchDeg;
    }

    // Immediately preload Level 0 base fallback tiles (only 2 tiles!)
    const l0 = LOD_LEVELS[0];
    for (let row = 0; row < l0.rows; row++) {
      for (let col = 0; col < l0.cols; col++) {
        const node = this.tiles.get(makeTileKey(0, col, row));
        if (node) this.requestTile(node);
      }
    }
    this.emitTelemetry(true);
  }

  public setVFov(vFovDeg: number, immediate = false): void {
    const clamped = clamp(vFovDeg, MIN_VFOV_DEG, MAX_VFOV_DEG);
    this.targetVFovDeg = clamped;
    if (immediate) {
      this.vFovDeg = clamped;
      this.camera.fov = clamped;
      this.camera.updateProjectionMatrix();
    }
  }

  public setLodMode(mode: LODSelectionMode): void {
    this.lodMode = mode;
    this.emitTelemetry(true);
  }

  public setShowLodGrid(show: boolean): void {
    this.showLodGrid = show;
  }

  public setShowHorizonRing(show: boolean): void {
    this.showHorizonRing = show;
    this.horizonGroup.visible = show;
  }

  public resetOrientation(): void {
    this.targetYawDeg = this.source?.initialYawDeg ?? 180;
    this.targetPitchDeg = this.source?.initialPitchDeg ?? 0;
    this.velocityYaw = 0;
    this.velocityPitch = 0;
  }

  public getViewportSize(): { width: number; height: number } {
    return { width: this.viewportWidth, height: this.viewportHeight };
  }

  private handleResize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.emitTelemetry(true);
  }

  private computeTargetLod(): number {
    if (this.lodMode !== "auto") {
      return this.lodMode;
    }
    // Screen vertical angular pixel density vs base level density (L0 = 256 / 180 ≈ 1.422 px/deg)
    const screenPxPerDeg = this.viewportHeight / Math.max(this.vFovDeg, 5);
    const l0PxPerDeg = LOD_LEVELS[0].height / 180;
    const ratio = (screenPxPerDeg * 0.42) / l0PxPerDeg;
    const rawLevel = Math.round(Math.log2(Math.max(1, ratio)));
    return clamp(rawLevel, 0, LOD_LEVELS.length - 1);
  }

  private clearAllTileTextures(): void {
    for (const node of this.tiles.values()) {
      if (node.abortController) {
        node.abortController.abort();
        node.abortController = null;
      }
      if (node.texture) {
        node.texture.dispose();
        node.texture = null;
      }
      node.mesh.material.map = null;
      node.mesh.material.needsUpdate = true;
      node.mesh.visible = false;
      node.wireframe.visible = false;
      node.status = "idle";
      node.loadedAt = 0;
    }
    this.activeLoads = 0;
  }

  private requestTile(node: TileNode): void {
    if (!this.source || node.status === "loading" || node.status === "loaded") {
      return;
    }
    if (this.activeLoads >= MAX_CONCURRENT_LOADS && node.level > 0) {
      return;
    }

    const gen = this.sourceGeneration;
    const controller = new AbortController();
    node.abortController = controller;
    node.status = "loading";
    this.activeLoads++;

    this.source
      .loadTile(node.level, node.col, node.row, controller.signal)
      .then((imageOrCanvas) => {
        if (this.disposed || gen !== this.sourceGeneration) return;
        const texture = new THREE.Texture(imageOrCanvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;

        node.texture = texture;
        node.mesh.material.map = texture;
        node.mesh.material.needsUpdate = true;
        node.status = "loaded";
        node.loadedAt = performance.now();
        node.abortController = null;
      })
      .catch((err) => {
        if (gen !== this.sourceGeneration) return;
        if (err instanceof DOMException && err.name === "AbortError") {
          node.status = "idle";
        } else {
          node.status = "error";
        }
        node.abortController = null;
      })
      .finally(() => {
        if (gen === this.sourceGeneration) {
          this.activeLoads = Math.max(0, this.activeLoads - 1);
        }
      });
  }

  private evictLruTextures(protectedKeys: Set<string>): void {
    const candidates: TileNode[] = [];
    for (const node of this.tiles.values()) {
      if (node.level === 0) continue; // Keep L0 base permanently resident
      if (node.status === "loaded" && node.texture && !protectedKeys.has(node.key)) {
        candidates.push(node);
      }
    }

    let totalCached = 0;
    for (const node of this.tiles.values()) {
      if (node.status === "loaded" && node.texture) totalCached++;
    }

    if (totalCached <= MAX_CACHED_TEXTURES) return;

    candidates.sort((a, b) => a.lastUsedFrame - b.lastUsedFrame);
    let toEvict = totalCached - MAX_CACHED_TEXTURES;
    for (const node of candidates) {
      if (toEvict <= 0) break;
      node.texture?.dispose();
      node.texture = null;
      node.mesh.material.map = null;
      node.mesh.material.needsUpdate = true;
      node.mesh.visible = false;
      node.wireframe.visible = false;
      node.status = "idle";
      toEvict--;
    }
  }

  private updateVisibleTiles(now: number): {
    targetLod: number;
    visibleAtTarget: number;
    loadedVisibleAtTarget: number;
    culledAtTarget: number;
    totalAtTarget: number;
    levelBreakdown: [number, number, number, number];
  } {
    this.frameCounter++;
    this.camera.updateMatrixWorld();
    this.projScreenMatrix.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    );
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

    const targetLod = this.computeTargetLod();
    const targetCfg = LOD_LEVELS[targetLod];

    // Reset visibility
    for (const node of this.tiles.values()) {
      node.mesh.visible = false;
      node.wireframe.visible = false;
    }

    const protectedKeys = new Set<string>();
    const neededToLoad: Array<{ node: TileNode; priority: number }> = [];
    const levelBreakdown: [number, number, number, number] = [0, 0, 0, 0];

    // Always render loaded L0 base tiles underneath so there are never black gaps
    const l0 = LOD_LEVELS[0];
    for (let r = 0; r < l0.rows; r++) {
      for (let c = 0; c < l0.cols; c++) {
        const base = this.tiles.get(makeTileKey(0, c, r))!;
        if (base.status === "loaded") {
          base.mesh.visible = true;
          base.lastUsedFrame = this.frameCounter;
          protectedKeys.add(base.key);
        } else if (base.status === "idle") {
          this.requestTile(base);
        }
      }
    }

    let visibleAtTarget = 0;
    let loadedVisibleAtTarget = 0;
    const totalAtTarget = targetCfg.cols * targetCfg.rows;

    // Frustum test all tiles in the target LOD level
    for (let row = 0; row < targetCfg.rows; row++) {
      for (let col = 0; col < targetCfg.cols; col++) {
        const node = this.tiles.get(makeTileKey(targetLod, col, row))!;
        const inFrustum = this.frustum.intersectsBox(node.boundingBox);

        if (!inFrustum) {
          // Abort stale out-of-frustum in-flight loads
          if (node.status === "loading" && node.abortController && node.level > 0) {
            node.abortController.abort();
          }
          continue;
        }

        visibleAtTarget++;
        node.lastUsedFrame = this.frameCounter;
        protectedKeys.add(node.key);

        if (node.status === "loaded") {
          loadedVisibleAtTarget++;
          node.mesh.visible = true;
          // Smooth 140ms fade-in for higher LOD tiles
          if (node.level > 0) {
            const elapsed = now - node.loadedAt;
            const alpha = Math.min(1, elapsed / 140);
            node.mesh.material.opacity = alpha;
            // While fading in, keep immediate loaded ancestor visible underneath
            if (alpha < 1) {
              this.activateClosestLoadedAncestor(node, protectedKeys);
            }
          }
          if (this.showLodGrid) {
            node.wireframe.visible = true;
          }
          levelBreakdown[node.level]++;
        } else {
          // Activate closest already-cached ancestor tile for zero-flicker fallback
          const fallbackLevel = this.activateClosestLoadedAncestor(
            node,
            protectedKeys,
            this.showLodGrid
          );
          if (fallbackLevel !== null) {
            levelBreakdown[fallbackLevel]++;
          }
          if (node.status === "idle") {
            const alignment = node.centerDir.dot(this.lookDir);
            neededToLoad.push({ node, priority: alignment });
          }
        }
      }
    }

    // Prioritize tiles nearest the camera's center ray
    neededToLoad.sort((a, b) => b.priority - a.priority);
    for (const item of neededToLoad) {
      if (this.activeLoads >= MAX_CONCURRENT_LOADS) break;
      this.requestTile(item.node);
    }

    // Cancel any leftover loading requests from non-target levels (except L0)
    for (const node of this.tiles.values()) {
      if (
        node.level > 0 &&
        node.level !== targetLod &&
        node.status === "loading" &&
        node.abortController
      ) {
        node.abortController.abort();
      }
    }

    if (this.frameCounter % 30 === 0) {
      this.evictLruTextures(protectedKeys);
    }

    return {
      targetLod,
      visibleAtTarget,
      loadedVisibleAtTarget,
      culledAtTarget: totalAtTarget - visibleAtTarget,
      totalAtTarget,
      levelBreakdown,
    };
  }

  private activateClosestLoadedAncestor(
    node: TileNode,
    protectedKeys: Set<string>,
    showWire = false
  ): number | null {
    let lvl = node.level - 1;
    let col = Math.floor(node.col / 2);
    let row = Math.floor(node.row / 2);

    while (lvl >= 0) {
      const parent = this.tiles.get(makeTileKey(lvl, col, row));
      if (parent && parent.status === "loaded") {
        parent.mesh.visible = true;
        if (parent.level > 0) {
          parent.mesh.material.opacity = 1;
        }
        if (showWire) {
          parent.wireframe.visible = true;
        }
        parent.lastUsedFrame = this.frameCounter;
        protectedKeys.add(parent.key);
        return lvl;
      }
      lvl--;
      col = Math.floor(col / 2);
      row = Math.floor(row / 2);
    }
    return null;
  }

  private emitTelemetry(force = false, stats?: ReturnType<TiledPanoEngine["updateVisibleTiles"]>): void {
    const now = performance.now();
    if (!force && now - this.lastTelemetryTime < 100) return;
    this.lastTelemetryTime = now;

    let cachedTileCount = 0;
    let loadingTileCount = 0;
    for (const node of this.tiles.values()) {
      if (node.status === "loaded" && node.texture) cachedTileCount++;
      if (node.status === "loading") loadingTileCount++;
    }

    const s = stats ?? this.updateVisibleTiles(now);
    const normalizedYaw = ((this.yawDeg % 360) + 360) % 360;
    const hFovDeg = computeHFovDeg(this.vFovDeg, this.camera.aspect);

    this.callbacks.onTelemetry?.({
      yawDeg: normalizedYaw,
      pitchDeg: this.pitchDeg,
      vFovDeg: this.vFovDeg,
      hFovDeg,
      targetLod: s.targetLod,
      lodMode: this.lodMode,
      visibleTileCount: s.visibleAtTarget,
      loadedVisibleTileCount: s.loadedVisibleAtTarget,
      loadingTileCount,
      cachedTileCount,
      culledTileCount: s.culledAtTarget,
      totalTilesAtTargetLod: s.totalAtTarget,
      levelBreakdown: s.levelBreakdown,
      viewportWidthPx: Math.round(this.viewportWidth),
      viewportHeightPx: Math.round(this.viewportHeight),
    });
  }

  private startLoop(): void {
    const tick = (now: number) => {
      if (this.disposed) return;
      this.animId = requestAnimationFrame(tick);

      // Apply gentle inertia when not dragging
      if (!this.isDragging) {
        this.targetYawDeg += this.velocityYaw;
        this.targetPitchDeg = clamp(this.targetPitchDeg + this.velocityPitch, -85, 85);
        this.velocityYaw *= 0.91;
        this.velocityPitch *= 0.91;
        if (Math.abs(this.velocityYaw) < 0.002) this.velocityYaw = 0;
        if (Math.abs(this.velocityPitch) < 0.002) this.velocityPitch = 0;
      }

      // Smoothly interpolate camera orientation & FOV
      this.yawDeg += (this.targetYawDeg - this.yawDeg) * 0.22;
      this.pitchDeg += (this.targetPitchDeg - this.pitchDeg) * 0.22;

      const fovDiff = this.targetVFovDeg - this.vFovDeg;
      if (Math.abs(fovDiff) > 0.01) {
        this.vFovDeg += fovDiff * 0.18;
        this.camera.fov = this.vFovDeg;
        this.camera.updateProjectionMatrix();
      } else if (this.vFovDeg !== this.targetVFovDeg) {
        this.vFovDeg = this.targetVFovDeg;
        this.camera.fov = this.vFovDeg;
        this.camera.updateProjectionMatrix();
      }

      // Orient camera from (yawDeg, pitchDeg)
      const yawRad = degToRad(this.yawDeg);
      const pitchRad = degToRad(this.pitchDeg);
      this.lookDir.set(
        Math.cos(pitchRad) * Math.cos(yawRad),
        Math.sin(pitchRad),
        Math.cos(pitchRad) * Math.sin(yawRad)
      );
      this.camera.lookAt(this.lookDir);

      const stats = this.updateVisibleTiles(now);
      this.renderer.render(this.scene, this.camera);
      this.emitTelemetry(false, stats);
    };

    this.animId = requestAnimationFrame(tick);
  }

  // ── Pointer & Wheel Controls ───────────────────────────────────────────────

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    this.canvas.setPointerCapture(e.pointerId);
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.activePointers.size === 1) {
      this.isDragging = true;
      this.activePointerId = e.pointerId;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.velocityYaw = 0;
      this.velocityPitch = 0;
      this.canvas.style.cursor = "grabbing";
    } else if (this.activePointers.size === 2) {
      this.isDragging = false;
      this.lastPinchDist = this.getPinchDistance();
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.activePointers.has(e.pointerId)) return;
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.activePointers.size === 2) {
      const dist = this.getPinchDistance();
      if (this.lastPinchDist !== null && dist !== null) {
        const delta = this.lastPinchDist - dist;
        const nextFov = clamp(this.targetVFovDeg + delta * 0.12, MIN_VFOV_DEG, MAX_VFOV_DEG);
        this.targetVFovDeg = nextFov;
        this.callbacks.onUserZoom?.(nextFov);
      }
      this.lastPinchDist = dist;
      return;
    }

    if (!this.isDragging || e.pointerId !== this.activePointerId) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    // 1:1 angular drag speed scaled by current FOV so panning feels glued to the image
    const degPerPx = this.vFovDeg / Math.max(200, this.viewportHeight);
    const dYaw = -dx * degPerPx;
    const dPitch = dy * degPerPx;

    this.targetYawDeg += dYaw;
    this.targetPitchDeg = clamp(this.targetPitchDeg + dPitch, -85, 85);
    this.velocityYaw = dYaw * 0.45;
    this.velocityPitch = dPitch * 0.45;
  };

  private onPointerUp = (e: PointerEvent) => {
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size < 2) {
      this.lastPinchDist = null;
    }
    if (e.pointerId === this.activePointerId) {
      this.isDragging = false;
      this.activePointerId = null;
      this.canvas.style.cursor = "grab";
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const step = e.deltaY * 0.045;
    const nextFov = clamp(this.targetVFovDeg + step, MIN_VFOV_DEG, MAX_VFOV_DEG);
    this.targetVFovDeg = nextFov;
    this.callbacks.onUserZoom?.(nextFov);
  };

  private getPinchDistance(): number | null {
    const pts = Array.from(this.activePointers.values());
    if (pts.length < 2) return null;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  private attachInputListeners(): void {
    this.canvas.style.cursor = "grab";
    this.canvas.style.touchAction = "none";
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
  }

  public dispose(): void {
    this.disposed = true;
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
    }
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("wheel", this.onWheel);

    this.clearAllTileTextures();
    for (const node of this.tiles.values()) {
      node.mesh.geometry.dispose();
      node.mesh.material.dispose();
      node.wireframe.geometry.dispose();
      node.wireframe.material.dispose();
    }
    this.tiles.clear();
    this.renderer.dispose();
  }
}
