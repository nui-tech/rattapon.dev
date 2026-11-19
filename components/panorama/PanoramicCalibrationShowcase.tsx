"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  clamp,
  clearCalibration,
  computeCalibratedVFovDeg,
  computeCalibration,
  computeRealWorldScaleRatio,
  DEFAULT_UNCALIBRATED_VFOV_DEG,
  MAX_VFOV_DEG,
  MAX_VIEWING_DISTANCE_MM,
  MIN_VFOV_DEG,
  MIN_VIEWING_DISTANCE_MM,
  loadCalibration,
  saveCalibration,
} from "@/lib/panorama/calibrationMath";
import { TiledPanoEngine } from "@/lib/panorama/TiledPanoEngine";
import {
  createAlpsTileSource,
  createCalibrationDomeSource,
  createUploadedEquirectSource,
} from "@/lib/panorama/tileSources";
import {
  CalibrationData,
  LOD_LEVELS,
  LODSelectionMode,
  ScaleViewMode,
  TileSource,
  ViewerTelemetry,
} from "@/lib/panorama/types";
import CalibrationModal from "./CalibrationModal";
import ScaleReticleOverlay from "./ScaleReticleOverlay";

function subscribeDesktopMedia(callback: () => void): () => void {
  const mql = window.matchMedia("(min-width: 1024px)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getDesktopSnapshot(): boolean {
  return window.matchMedia("(min-width: 1024px)").matches;
}

const calibrationListeners = new Set<() => void>();
let cachedCalibrationRaw: string | null | undefined = undefined;
let cachedCalibrationSnapshot: CalibrationData | null = null;

function subscribeCalibrationStore(callback: () => void): () => void {
  calibrationListeners.add(callback);
  const onStorage = () => {
    cachedCalibrationRaw = undefined;
    callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    calibrationListeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function getCalibrationSnapshot(): CalibrationData | null {
  try {
    const raw = window.localStorage.getItem("rattapon_pano_calibration_v1");
    if (raw === cachedCalibrationRaw) {
      return cachedCalibrationSnapshot;
    }
    cachedCalibrationRaw = raw;
    cachedCalibrationSnapshot = loadCalibration();
    return cachedCalibrationSnapshot;
  } catch {
    return null;
  }
}

function notifyCalibrationChange(): void {
  cachedCalibrationRaw = undefined;
  calibrationListeners.forEach((l) => l());
}

const INITIAL_TELEMETRY: ViewerTelemetry = {
  yawDeg: 180,
  pitchDeg: 0,
  vFovDeg: DEFAULT_UNCALIBRATED_VFOV_DEG,
  hFovDeg: 100,
  targetLod: 2,
  lodMode: "auto",
  visibleTileCount: 0,
  loadedVisibleTileCount: 0,
  loadingTileCount: 0,
  cachedTileCount: 0,
  culledTileCount: 0,
  totalTilesAtTargetLod: 32,
  levelBreakdown: [0, 0, 0, 0],
  viewportWidthPx: 1280,
  viewportHeightPx: 720,
};

export default function PanoramicCalibrationShowcase() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<TiledPanoEngine | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customSourceRef = useRef<TileSource | null>(null);

  const [sceneId, setSceneId] = useState<"alps" | "calibration-dome" | "custom">("alps");
  const [customSourceName, setCustomSourceName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [telemetry, setTelemetry] = useState<ViewerTelemetry>(INITIAL_TELEMETRY);
  const [lodMode, setLodMode] = useState<LODSelectionMode>("auto");
  const [showLodGrid, setShowLodGrid] = useState<boolean>(false);
  const [showHorizonRing, setShowHorizonRing] = useState<boolean>(false);
  const [showReticle, setShowReticle] = useState<boolean>(false);

  const isDesktop = useSyncExternalStore(
    subscribeDesktopMedia,
    getDesktopSnapshot,
    () => true
  );
  const [inspectorOverride, setInspectorOverride] = useState<boolean | null>(null);
  const inspectorOpen = inspectorOverride ?? isDesktop;

  const calibration = useSyncExternalStore(
    subscribeCalibrationStore,
    getCalibrationSnapshot,
    () => null
  );
  const [scaleModeOverride, setScaleModeOverride] = useState<ScaleViewMode | null>(null);
  const scaleMode: ScaleViewMode =
    scaleModeOverride ?? (calibration ? "calibrated" : "uncalibrated");
  const [calibrationModalOpen, setCalibrationModalOpen] = useState<boolean>(false);

  // Derived calibrated vertical FOV for current viewport height
  const calibratedVFovDeg = useMemo(() => {
    if (!calibration) return null;
    return computeCalibratedVFovDeg(
      telemetry.viewportHeightPx,
      calibration.pxPerMm,
      calibration.viewingDistanceMm
    );
  }, [calibration, telemetry.viewportHeightPx]);

  const scaleRatio = useMemo(() => {
    if (calibratedVFovDeg === null) return null;
    return computeRealWorldScaleRatio(telemetry.vFovDeg, calibratedVFovDeg);
  }, [telemetry.vFovDeg, calibratedVFovDeg]);

  // Initialize Three.js TiledPanoEngine once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new TiledPanoEngine(canvas, {
      onTelemetry: (next) => setTelemetry(next),
      onUserZoom: () => {
        setScaleModeOverride((prev) => (prev === "free" ? prev : "free"));
      },
    });
    engineRef.current = engine;
    engine.setSource(createAlpsTileSource());

    return () => {
      engine.dispose();
      engineRef.current = null;
      customSourceRef.current?.dispose?.();
      customSourceRef.current = null;
    };
  }, []);

  // Keep camera FOV locked to real-world scale when in "calibrated" mode (even on window resize!)
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (scaleMode === "calibrated" && calibratedVFovDeg !== null) {
      engine.setVFov(calibratedVFovDeg);
    } else if (scaleMode === "uncalibrated") {
      engine.setVFov(DEFAULT_UNCALIBRATED_VFOV_DEG);
    }
  }, [scaleMode, calibratedVFovDeg]);

  // Sync engine overlay & LOD mode options
  useEffect(() => {
    engineRef.current?.setLodMode(lodMode);
  }, [lodMode]);

  useEffect(() => {
    engineRef.current?.setShowLodGrid(showLodGrid);
  }, [showLodGrid]);

  useEffect(() => {
    engineRef.current?.setShowHorizonRing(showHorizonRing);
  }, [showHorizonRing]);

  const handleSelectScene = useCallback((nextScene: "alps" | "calibration-dome") => {
    setUploadError(null);
    setSceneId(nextScene);
    const source =
      nextScene === "alps" ? createAlpsTileSource() : createCalibrationDomeSource();
    engineRef.current?.setSource(source);
  }, []);

  const handleUploadEquirect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setUploadError(null);
      try {
        const source = await createUploadedEquirectSource(file);
        customSourceRef.current?.dispose?.();
        customSourceRef.current = source;
        setCustomSourceName(source.name);
        setSceneId("custom");
        engineRef.current?.setSource(source);
      } catch {
        setUploadError("Could not decode image. Please upload a JPG, PNG, or WebP equirectangular panorama.");
      }
    },
    []
  );

  const handleApplyCalibration = useCallback((nextCal: CalibrationData) => {
    saveCalibration(nextCal);
    notifyCalibrationChange();
    setScaleModeOverride("calibrated");
    setCalibrationModalOpen(false);
  }, []);

  const handleClearCalibration = useCallback(() => {
    clearCalibration();
    notifyCalibrationChange();
    setScaleModeOverride("uncalibrated");
    engineRef.current?.setVFov(DEFAULT_UNCALIBRATED_VFOV_DEG);
  }, []);

  const handleLiveDistanceChange = useCallback(
    (nextDistanceMm: number) => {
      if (!calibration) return;
      const updated = computeCalibration(calibration.cardWidthPx, nextDistanceMm);
      saveCalibration(updated);
      notifyCalibrationChange();
      setScaleModeOverride("calibrated");
    },
    [calibration]
  );

  const handleStepZoom = useCallback((deltaDeg: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    setScaleModeOverride("free");
    engine.setVFov(clamp(telemetry.vFovDeg + deltaDeg, MIN_VFOV_DEG, MAX_VFOV_DEG));
  }, [telemetry.vFovDeg]);

  const viewportWidthMm = calibration
    ? telemetry.viewportWidthPx / calibration.pxPerMm
    : null;
  const viewportHeightMm = calibration
    ? telemetry.viewportHeightPx / calibration.pxPerMm
    : null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-950 text-gray-100 select-none">
      {/* Three.js 360° Tiled Panoramic Canvas */}
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        aria-label="Interactive 360-degree multi-resolution panoramic viewer"
      />

      {/* Optional 5° Angular Calibration Reticle */}
      <ScaleReticleOverlay
        visible={showReticle}
        vFovDeg={telemetry.vFovDeg}
        viewportHeightPx={telemetry.viewportHeightPx}
        yawDeg={telemetry.yawDeg}
        pitchDeg={telemetry.pitchDeg}
        calibration={calibration}
      />

      {/* Top Floating Bar */}
      <header className="fixed top-0 inset-x-0 z-20 pointer-events-none p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2">
        {/* Back + Title */}
        <div className="pointer-events-auto flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gray-950/80 backdrop-blur-md border border-gray-800/90 shadow-lg">
          <Link
            href="/#projects"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-400 hover:text-cyan-400 transition-colors pr-2.5 border-r border-gray-800"
          >
            <span>←</span>
            <span className="hidden sm:inline">Portfolio</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <h1 className="text-xs sm:text-sm font-semibold text-white tracking-tight">
              360° Panoramic Calibration
            </h1>
          </div>
        </div>

        {/* Scene Switcher */}
        <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-xl bg-gray-950/80 backdrop-blur-md border border-gray-800/90 shadow-lg">
          <button
            type="button"
            onClick={() => handleSelectScene("alps")}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              sceneId === "alps"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-gray-400 hover:text-white border border-transparent"
            }`}
          >
            Alpine 4K
          </button>
          <button
            type="button"
            onClick={() => handleSelectScene("calibration-dome")}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              sceneId === "calibration-dome"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-gray-400 hover:text-white border border-transparent"
            }`}
          >
            Survey Dome
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              sceneId === "custom"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-gray-400 hover:text-white border border-transparent"
            }`}
            title="Upload your own 2:1 equirectangular image to slice into 4 LOD levels"
          >
            {sceneId === "custom" && customSourceName ? customSourceName : "+ Upload 360°"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUploadEquirect}
            className="hidden"
          />
        </div>

        {/* Right Calibration CTA & Inspector Toggle */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCalibrationModalOpen(true)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold transition-all shadow-lg ${
              calibration
                ? "bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300"
                : "bg-cyan-500 hover:bg-cyan-400 text-gray-950 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
            }`}
          >
            {/* Credit card icon */}
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="2" y="5" width="20" height="14" rx="2.5" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <span>{calibration ? "Recalibrate Card" : "Calibrate with Credit Card"}</span>
          </button>

          <button
            type="button"
            onClick={() => setInspectorOverride(!inspectorOpen)}
            className={`px-3 py-2 rounded-xl text-xs font-mono border backdrop-blur-md transition-colors shadow-lg ${
              inspectorOpen
                ? "bg-gray-900/90 border-cyan-500/40 text-cyan-300"
                : "bg-gray-950/80 border-gray-800 text-gray-300 hover:text-white"
            }`}
            aria-expanded={inspectorOpen}
          >
            {inspectorOpen ? "Hide HUD" : "LOD & Scale HUD"}
          </button>
        </div>
      </header>

      {/* Upload error toast */}
      {uploadError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-red-950/90 border border-red-500/40 text-xs font-mono text-red-200 shadow-xl">
          {uploadError}
        </div>
      )}

      {/* Subtle First-Time Guidance Pill (when uncalibrated & modal closed) */}
      {!calibration && !calibrationModalOpen && (
        <div className="fixed top-18 sm:top-20 left-4 z-20 max-w-xs px-3.5 py-2.5 rounded-xl bg-gray-950/80 backdrop-blur-md border border-cyan-500/30 shadow-lg">
          <p className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider mb-1">
            Uncalibrated · 75° Default FOV
          </p>
          <p className="text-xs text-gray-300 leading-relaxed">
            Drag to explore or scroll to zoom through the{" "}
            <span className="text-white font-medium">4-level LOD tiles</span>. Click{" "}
            <button
              type="button"
              onClick={() => setCalibrationModalOpen(true)}
              className="text-cyan-400 underline hover:text-cyan-300 font-medium"
            >
              Calibrate with Credit Card
            </button>{" "}
            to lock the camera to real-world 1:1 scale.
          </p>
        </div>
      )}

      {/* Right Collapsible Engineering HUD / Telemetry Drawer */}
      {inspectorOpen && (
        <aside className="fixed top-18 right-3 sm:right-4 bottom-20 z-20 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-gray-950/85 backdrop-blur-md border border-gray-800/90 shadow-2xl overflow-y-auto p-4 space-y-4">
          {/* 1. Optical Scale Calibration Status */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400">
                1 · Real-World Calibration
              </span>
              {calibration ? (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    scaleMode === "calibrated"
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                      : "bg-amber-500/15 border-amber-500/40 text-amber-300"
                  }`}
                >
                  {scaleMode === "calibrated"
                    ? "1:1 LOCKED"
                    : scaleRatio !== null
                    ? `${scaleRatio.toFixed(2)}× REAL LIFE`
                    : "UNLOCKED"}
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-400">
                  UNCALIBRATED
                </span>
              )}
            </div>

            {calibration && calibratedVFovDeg !== null ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-gray-900/90 border border-gray-800">
                    <div className="text-[10px] text-gray-500">ACTIVE vFOV</div>
                    <div className="text-white font-semibold">
                      {telemetry.vFovDeg.toFixed(1)}°
                    </div>
                    <div className="text-[10px] text-gray-500">
                      hFOV {telemetry.hFovDeg.toFixed(1)}°
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-gray-900/90 border border-gray-800">
                    <div className="text-[10px] text-gray-500">1:1 TARGET vFOV</div>
                    <div className="text-emerald-300 font-semibold">
                      {calibratedVFovDeg.toFixed(1)}°
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {scaleRatio !== null ? `${scaleRatio.toFixed(2)}× scale` : ""}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-gray-900/90 border border-gray-800">
                    <div className="text-[10px] text-gray-500">DISPLAY SCALE</div>
                    <div className="text-gray-200 font-semibold">
                      {calibration.pxPerMm.toFixed(2)} px/mm
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {calibration.ppi.toFixed(1)} PPI
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-gray-900/90 border border-gray-800">
                    <div className="text-[10px] text-gray-500">VIEWPORT (MM)</div>
                    <div className="text-gray-200 font-semibold">
                      {viewportWidthMm ? Math.round(viewportWidthMm) : "–"}×
                      {viewportHeightMm ? Math.round(viewportHeightMm) : "–"}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {telemetry.viewportWidthPx}×{telemetry.viewportHeightPx} px
                    </div>
                  </div>
                </div>

                {/* Live Viewing Distance Adjustment */}
                <div className="p-2.5 rounded-lg bg-gray-900/80 border border-gray-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-gray-400">Eye Distance (D)</span>
                    <span className="text-cyan-300 font-semibold">
                      {(calibration.viewingDistanceMm / 10).toFixed(0)} cm
                    </span>
                  </div>
                  <input
                    type="range"
                    min={MIN_VIEWING_DISTANCE_MM}
                    max={MAX_VIEWING_DISTANCE_MM}
                    step={10}
                    value={calibration.viewingDistanceMm}
                    onChange={(e) => handleLiveDistanceChange(parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-400 cursor-pointer"
                    aria-label="Adjust eye viewing distance"
                  />
                  <div className="flex items-center justify-between text-[10px] font-mono text-gray-500">
                    <span>30 cm</span>
                    <button
                      type="button"
                      onClick={handleClearCalibration}
                      className="text-gray-500 hover:text-red-400 transition-colors"
                    >
                      Clear calibration
                    </button>
                    <span>120 cm</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-gray-900/90 border border-gray-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-400">Current Camera FOV</span>
                  <span className="text-white font-semibold">
                    {telemetry.vFovDeg.toFixed(1)}° vFOV
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Browsers don&apos;t report physical monitor dimensions. Align a real credit card
                  (85.60 × 53.98 mm) to compute exact display <span className="text-gray-200 font-mono">px/mm</span>{" "}
                  and real-life camera FOV.
                </p>
                <button
                  type="button"
                  onClick={() => setCalibrationModalOpen(true)}
                  className="w-full py-2 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-semibold transition-colors"
                >
                  Open Credit Card Calibrator →
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-gray-800/80" />

          {/* 2. 4-Level Multi-Resolution LOD Pyramid */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400">
                2 · 4-Level LOD Pyramid
              </span>
              <span className="text-[10px] font-mono text-gray-400">
                Active: <strong className="text-white">L{telemetry.targetLod}</strong>
              </span>
            </div>

            {/* Auto / Manual LOD selector */}
            <div className="grid grid-cols-5 gap-1 p-1 rounded-lg bg-gray-900 border border-gray-800">
              {(["auto", 0, 1, 2, 3] as LODSelectionMode[]).map((mode) => {
                const active = lodMode === mode;
                return (
                  <button
                    key={String(mode)}
                    type="button"
                    onClick={() => setLodMode(mode)}
                    className={`py-1 rounded text-[11px] font-mono transition-colors ${
                      active
                        ? "bg-cyan-500 text-gray-950 font-semibold"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {mode === "auto" ? "Auto" : `L${mode}`}
                  </button>
                );
              })}
            </div>

            {/* 4-Level Breakdown List */}
            <div className="space-y-1.5">
              {LOD_LEVELS.map((cfg) => {
                const isTarget = telemetry.targetLod === cfg.level;
                const total = cfg.cols * cfg.rows;
                const rendered = telemetry.levelBreakdown[cfg.level];
                return (
                  <div
                    key={cfg.level}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] font-mono transition-colors ${
                      isTarget
                        ? "bg-gray-900 border-cyan-500/50 text-white"
                        : "bg-gray-900/40 border-gray-800/70 text-gray-500"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: cfg.color }}
                      />
                      <span>
                        L{cfg.level} · {cfg.cols}×{cfg.rows}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500">
                        {cfg.width}×{cfg.height}
                      </span>
                      <span
                        className={`text-[10px] min-w-[3.2rem] text-right ${
                          isTarget ? "text-cyan-300 font-semibold" : "text-gray-600"
                        }`}
                      >
                        {isTarget ? `${rendered}/${total}` : `${total}t`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Frustum Culling & LRU Stats */}
            <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px]">
              <div className="p-1.5 rounded-lg bg-gray-900/80 border border-gray-800">
                <div className="text-gray-500">IN FRUSTUM</div>
                <div className="text-cyan-300 font-semibold text-xs">
                  {telemetry.loadedVisibleTileCount}/{telemetry.visibleTileCount}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-gray-900/80 border border-gray-800">
                <div className="text-gray-500">CULLED</div>
                <div className="text-gray-300 font-semibold text-xs">
                  {telemetry.culledTileCount}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-gray-900/80 border border-gray-800">
                <div className="text-gray-500">LRU CACHE</div>
                <div className="text-gray-300 font-semibold text-xs">
                  {telemetry.cachedTileCount}/96
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800/80" />

          {/* 3. Visual Inspection Overlays */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400">
              3 · Diagnostic Overlays
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => setShowLodGrid((v) => !v)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-mono transition-colors ${
                  showLodGrid
                    ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                    : "bg-gray-900/70 border-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                <span>LOD Tile Wireframes</span>
                <span>{showLodGrid ? "ON" : "OFF"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowReticle((v) => !v)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-mono transition-colors ${
                  showReticle
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : "bg-gray-900/70 border-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                <span>5° Angular Scale Caliper</span>
                <span>{showReticle ? "ON" : "OFF"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowHorizonRing((v) => !v)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-mono transition-colors ${
                  showHorizonRing
                    ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                    : "bg-gray-900/70 border-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                <span>3D Horizon & 15° Ticks</span>
                <span>{showHorizonRing ? "ON" : "OFF"}</span>
              </button>
            </div>
          </div>

          {/* Compact Engineering Note */}
          <div className="pt-2 border-t border-gray-800/80 text-[11px] text-gray-500 leading-relaxed">
            <span className="text-gray-300 font-mono">How it works:</span>{" "}
            Mirrors Marzipano&apos;s multi-resolution tile pipeline in Three.js (frustum culling, L0
            base fallback, abortable streaming, LRU GPU cache). Locking the camera to calibrated{" "}
            <span className="font-mono text-gray-300">vFOV = 2·atan(H/2D)</span> narrows FOV to
            real-world perspective and automatically triggers higher-resolution L3 tiles.
          </div>
        </aside>
      )}

      {/* Bottom Floating Control Dock */}
      <div className="fixed bottom-4 inset-x-0 z-20 pointer-events-none px-4 flex justify-center">
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 px-3 py-2 rounded-2xl bg-gray-950/85 backdrop-blur-md border border-gray-800/90 shadow-2xl">
          {/* Scale A/B Comparison Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-900 border border-gray-800">
            <button
              type="button"
              onClick={() => {
                if (!calibration) {
                  setCalibrationModalOpen(true);
                } else {
                  setScaleModeOverride("calibrated");
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                scaleMode === "calibrated" && calibration
                  ? "bg-emerald-500 text-gray-950 font-semibold shadow-[0_0_14px_rgba(16,185,129,0.4)]"
                  : "text-gray-300 hover:text-white"
              }`}
              title="Lock camera FOV to 1:1 physical real-world scale"
            >
              {calibration && calibratedVFovDeg !== null
                ? `1:1 Real Scale (${calibratedVFovDeg.toFixed(1)}°)`
                : "1:1 Real Scale (Calibrate)"}
            </button>

            <button
              type="button"
              onClick={() => setScaleModeOverride("uncalibrated")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                scaleMode === "uncalibrated"
                  ? "bg-gray-700 text-white font-semibold"
                  : "text-gray-400 hover:text-white"
              }`}
              title="Compare against standard uncalibrated 75° web viewer FOV"
            >
              Uncalibrated ({DEFAULT_UNCALIBRATED_VFOV_DEG}°)
            </button>
          </div>

          <div className="hidden sm:block w-px h-6 bg-gray-800" />

          {/* Zoom & Orientation Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleStepZoom(10)}
              className="w-8 h-8 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white font-mono text-sm flex items-center justify-center transition-colors"
              title="Zoom out (wider FOV)"
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="min-w-[4.5rem] text-center text-xs font-mono text-gray-300">
              {telemetry.vFovDeg.toFixed(1)}°
            </span>
            <button
              type="button"
              onClick={() => handleStepZoom(-10)}
              className="w-8 h-8 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white font-mono text-sm flex items-center justify-center transition-colors"
              title="Zoom in (narrower FOV)"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => engineRef.current?.resetOrientation()}
              className="px-2.5 h-8 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs font-mono text-gray-400 hover:text-white transition-colors"
              title="Reset view orientation"
            >
              Reset
            </button>
          </div>

          <div className="hidden md:block w-px h-6 bg-gray-800" />

          {/* Quick LOD & Reticle Toggles */}
          <div className="hidden md:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowLodGrid((v) => !v)}
              className={`px-2.5 h-8 rounded-lg border text-xs font-mono transition-colors ${
                showLodGrid
                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                  : "bg-gray-900 border-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              LOD Grid
            </button>
            <button
              type="button"
              onClick={() => setShowReticle((v) => !v)}
              className={`px-2.5 h-8 rounded-lg border text-xs font-mono transition-colors ${
                showReticle
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  : "bg-gray-900 border-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              Reticle
            </button>
          </div>
        </div>
      </div>

      {/* Credit Card Calibration Modal */}
      {calibrationModalOpen && (
        <CalibrationModal
          initialCalibration={calibration}
          viewportWidthPx={telemetry.viewportWidthPx}
          viewportHeightPx={telemetry.viewportHeightPx}
          onApply={handleApplyCalibration}
          onClose={() => setCalibrationModalOpen(false)}
        />
      )}
    </div>
  );
}
