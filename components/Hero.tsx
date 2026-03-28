"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// Southern Cross (Crux) + Pointer Stars — as seen from Christchurch, NZ
// [name, screenX (-1..1), screenY (-1..1), magnitude, isPointer]
// Screen coords: 0,0 = centre; right=+x, up=+y
// Cross sits in the upper-right quadrant, framing the hero text
const CRUX_STARS = [
  ["Acrux",   0.55, -0.12, 0.77, false],   // α Cru — brightest, bottom of vertical
  ["Gacrux",  0.55,  0.40, 1.63, false],   // γ Cru — top of vertical
  ["Becrux",  0.30,  0.14, 1.25, false],   // β Cru — left of horizontal
  ["Delta",   0.74,  0.14, 2.79, false],   // δ Cru — right (shorter arm)
  ["Epsilon", 0.56,  0.10, 3.59, false],   // ε Cru — small inner star
  ["α Cen",  -0.02,  0.28, -0.27, true],  // pointer — warm yellow-white
  ["β Cen",   0.12,  0.42,  0.61, true],  // pointer
] as const;

// Lines connecting Crux stars: index pairs
const CRUX_LINES = [
  [0, 1], // vertical arm
  [2, 3], // horizontal arm
];

function magToSize(mag: number, isPointer: boolean): number {
  // Stars at STAR_Z=-28, camera z=6 → distance ≈ 34, half-height ≈ 23.8 units
  // A scale of 1.0 ≈ ~10px on a 480px-tall viewport
  const base = Math.max(0.5, 2.8 - mag * 0.35);
  return isPointer ? base * 0.8 : base;
}

function magToOpacity(mag: number): number {
  return Math.max(0.6, 1.05 - mag * 0.09);
}

function createGlowTexture(r: number, g: number, b: number): THREE.Texture {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d")!;
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  // Tight bright core → quick falloff → faint halo
  grad.addColorStop(0,    `rgba(${r},${g},${b},1)`);
  grad.addColorStop(0.08, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(0.2,  `rgba(${r},${g},${b},0.5)`);
  grad.addColorStop(0.45, `rgba(${r},${g},${b},0.12)`);
  grad.addColorStop(1,    `rgba(0,0,0,0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// Convert screen-space NDC coords to world position at a given depth z
function screenToWorld(sx: number, sy: number, z: number, camera: THREE.PerspectiveCamera): THREE.Vector3 {
  const vec = new THREE.Vector3(sx, sy, 0.5);
  vec.unproject(camera);
  const dir = vec.sub(camera.position).normalize();
  const dist = (z - camera.position.z) / dir.z;
  return camera.position.clone().add(dir.multiplyScalar(dist));
}

export default function Hero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const camera = new THREE.PerspectiveCamera(70, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
    camera.position.z = 6;

    const scene = new THREE.Scene();
    // Separate group for background so it can rotate independently
    const bgGroup = new THREE.Group();
    scene.add(bgGroup);

    // ── Background star field ──────────────────────────────────────────────
    const starCount = 2200;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 40 + Math.random() * 20;
      starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    bgGroup.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xd0e8ff, size: 0.11, transparent: true, opacity: 0.5, sizeAttenuation: true,
    })));

    // ── Milky Way band ─────────────────────────────────────────────────────
    const mwCount = 800;
    const mwPos = new Float32Array(mwCount * 3);
    for (let i = 0; i < mwCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const band = (Math.random() - 0.5) * 0.3;
      const phi = Math.PI / 2 + band + Math.sin(theta * 1.5) * 0.5;
      const r = 45;
      mwPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      mwPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      mwPos[i * 3 + 2] = r * Math.cos(phi);
    }
    const mwGeo = new THREE.BufferGeometry();
    mwGeo.setAttribute("position", new THREE.BufferAttribute(mwPos, 3));
    bgGroup.add(new THREE.Points(mwGeo, new THREE.PointsMaterial({
      color: 0xaac4e8, size: 0.07, transparent: true, opacity: 0.22, sizeAttenuation: true,
    })));

    // ── Named stars: Southern Cross + Pointer stars ────────────────────────
    // Place at z = -28 (far enough that sprites look like stars, not blobs)
    const STAR_Z = -28;
    const glowCrux    = createGlowTexture(160, 220, 255); // cool blue-white
    const glowPointer = createGlowTexture(255, 220, 160); // warm yellow (Alpha Cen is actually warm)

    // Single group — stars AND lines move together, so parallax never misaligns them
    const cruxGroup = new THREE.Group();
    scene.add(cruxGroup);

    const namedSprites: THREE.Sprite[] = [];
    const starLocalPos: THREE.Vector3[] = []; // positions relative to group origin

    // Compute star positions in world space, store as local positions within cruxGroup
    const computeStarPositions = () => {
      starLocalPos.length = 0;
      CRUX_STARS.forEach(([, sx, sy]) => {
        starLocalPos.push(screenToWorld(sx as number, sy as number, STAR_Z, camera));
      });
      // Update sprite positions
      namedSprites.forEach((s, i) => s.position.copy(starLocalPos[i]));
      // Rebuild line geometries
      CRUX_LINES.forEach(([a, b], i) => {
        lineGeos[i].setFromPoints([starLocalPos[a].clone(), starLocalPos[b].clone()]);
      });
    };

    // Build sprites
    CRUX_STARS.forEach(([, , , mag, isPointer]) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: isPointer ? glowPointer : glowCrux,
        transparent: true,
        opacity: magToOpacity(mag as number),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      sprite.scale.setScalar(magToSize(mag as number, isPointer as boolean));
      cruxGroup.add(sprite);
      namedSprites.push(sprite);
    });

    // Build lines (geometries populated by computeStarPositions)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.3 });
    const lineGeos: THREE.BufferGeometry[] = CRUX_LINES.map(() => new THREE.BufferGeometry());
    lineGeos.forEach((geo) => cruxGroup.add(new THREE.Line(geo, lineMat)));

    // ── Resize — use ResizeObserver so we catch the real initial canvas size ─
    const handleResize = (w: number, h: number) => {
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      computeStarPositions(); // updates both sprites and lines
    };

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      handleResize(width, height);
    });
    ro.observe(canvas);

    // ── Mouse parallax ─────────────────────────────────────────────────────
    let targetX = 0, targetY = 0, curX = 0, curY = 0;
    const handleMouse = (e: MouseEvent) => {
      targetX = (e.clientX / window.innerWidth  - 0.5) * 0.06;
      targetY = (e.clientY / window.innerHeight - 0.5) * 0.04;
    };
    window.addEventListener("mousemove", handleMouse);

    // ── Animate ────────────────────────────────────────────────────────────
    let animId: number;
    let t = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      t += 0.001;

      curX += (targetX - curX) * 0.04;
      curY += (targetY - curY) * 0.04;

      // Background slowly drifts (Earth rotation feel), named stars stay put
      bgGroup.rotation.y = curX + t * 0.015;
      bgGroup.rotation.x = curY;

      // Move entire cruxGroup together — stars and lines always stay aligned
      cruxGroup.position.x = curX * 1.5;
      cruxGroup.position.y = -curY * 1.5;

      // Twinkle
      namedSprites.forEach((s, i) => {
        const [,,,mag] = CRUX_STARS[i];
        const baseOp = magToOpacity(mag as number);
        (s.material as THREE.SpriteMaterial).opacity =
          baseOp * (0.85 + Math.sin(t * 2.5 + i * 1.8) * 0.1);
      });

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      window.removeEventListener("mousemove", handleMouse);
      renderer.dispose();
      glowCrux.dispose();
      glowPointer.dispose();
    };
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gray-950">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: "block" }} />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_#030712_100%)] pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none" />

      {/* Content — left-aligned to give the Cross room on the right */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 text-left">
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-sm font-mono">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Available for opportunities
        </div>

        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-4">
          <span className="text-white">Nui </span>
          <span className="text-cyan-400 glow-cyan">Rattapon</span>
        </h1>

        <p className="text-xl sm:text-2xl text-gray-400 mb-2 font-mono">
          Senior Full-Stack Developer
        </p>

        <p className="text-base sm:text-lg text-gray-500 mb-10 max-w-xl">
          Three.js · Angular · React · TypeScript · Node.js
          <br />
          <span className="text-cyan-500/80">Full-Stack Engineer · Architecture &amp; AI</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <a href="#projects" className="px-8 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-semibold transition-colors duration-200">
            View My Work
          </a>
          <a href="/Nui_Rattapon_CV.pdf" download className="px-8 py-3 rounded-lg border border-cyan-500/40 hover:border-cyan-400 hover:bg-cyan-500/10 text-cyan-400 font-semibold transition-all duration-200">
            Download CV
          </a>
        </div>
      </div>

      {/* Southern Cross label — subtle easter egg */}
      <div className="absolute top-1/4 right-6 text-right hidden sm:block pointer-events-none">
        <p className="text-gray-600 text-xs font-mono tracking-widest">Te Kāhui o Matariki</p>
        <p className="text-gray-700 text-xs font-mono">Christchurch, NZ 43°S</p>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-600">
        <span className="text-xs font-mono tracking-widest uppercase">Scroll</span>
        <div className="w-px h-10 bg-gradient-to-b from-gray-600 to-transparent" />
      </div>
    </section>
  );
}
