"use client";

import { useEffect, useRef, useState } from "react";
import {
  clamp,
  computeCalibratedVFovDeg,
  computeCalibration,
  computeHFovDeg,
  CREDIT_CARD_ASPECT,
  CREDIT_CARD_CORNER_RADIUS_MM,
  CREDIT_CARD_HEIGHT_MM,
  CREDIT_CARD_WIDTH_MM,
  DEFAULT_CARD_WIDTH_PX,
  DEFAULT_UNCALIBRATED_VFOV_DEG,
  DEFAULT_VIEWING_DISTANCE_MM,
  MAX_CARD_WIDTH_PX,
  MAX_VIEWING_DISTANCE_MM,
  MIN_CARD_WIDTH_PX,
  MIN_VIEWING_DISTANCE_MM,
} from "@/lib/panorama/calibrationMath";
import { CalibrationData } from "@/lib/panorama/types";

interface CalibrationModalProps {
  initialCalibration: CalibrationData | null;
  viewportWidthPx: number;
  viewportHeightPx: number;
  onApply: (calibration: CalibrationData) => void;
  onClose: () => void;
}

const DISTANCE_PRESETS = [
  { label: "45 cm", sub: "Laptop", mm: 450 },
  { label: "60 cm", sub: "Desktop", mm: 600 },
  { label: "80 cm", sub: "Large Screen", mm: 800 },
] as const;

export default function CalibrationModal({
  initialCalibration,
  viewportWidthPx,
  viewportHeightPx,
  onApply,
  onClose,
}: CalibrationModalProps) {
  const [cardWidthPx, setCardWidthPx] = useState<number>(
    () => initialCalibration?.cardWidthPx ?? DEFAULT_CARD_WIDTH_PX
  );
  const [viewingDistanceMm, setViewingDistanceMm] = useState<number>(
    () => initialCalibration?.viewingDistanceMm ?? DEFAULT_VIEWING_DISTANCE_MM
  );
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);

  const dragOriginRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Keyboard fine adjustment & Escape to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        setCardWidthPx((w) => clamp(w + step, MIN_CARD_WIDTH_PX, MAX_CARD_WIDTH_PX));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        setCardWidthPx((w) => clamp(w - step, MIN_CARD_WIDTH_PX, MAX_CARD_WIDTH_PX));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const previewCal = computeCalibration(cardWidthPx, viewingDistanceMm);
  const cardHeightPx = cardWidthPx / CREDIT_CARD_ASPECT;
  const cornerRadiusPx = (CREDIT_CARD_CORNER_RADIUS_MM / CREDIT_CARD_WIDTH_MM) * cardWidthPx;

  const vpW = Math.max(320, viewportWidthPx);
  const vpH = Math.max(240, viewportHeightPx);
  const viewportWidthMm = vpW / previewCal.pxPerMm;
  const viewportHeightMm = vpH / previewCal.pxPerMm;
  const calibratedVFov = computeCalibratedVFovDeg(
    vpH,
    previewCal.pxPerMm,
    viewingDistanceMm
  );
  const calibratedHFov = computeHFovDeg(calibratedVFov, vpW / vpH);

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragOriginRef.current = { startX: e.clientX, startWidth: cardWidthPx };
    setIsDraggingHandle(true);
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOriginRef.current) return;
    const dx = e.clientX - dragOriginRef.current.startX;
    const nextW = clamp(
      Math.round((dragOriginRef.current.startWidth + dx) * 2) / 2,
      MIN_CARD_WIDTH_PX,
      MAX_CARD_WIDTH_PX
    );
    setCardWidthPx(nextW);
  };

  const handleResizePointerUp = () => {
    dragOriginRef.current = null;
    setIsDraggingHandle(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/85 backdrop-blur-md p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calibration-modal-title"
    >
      <div className="relative w-full max-w-4xl rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-3.5 border-b border-gray-800 bg-gray-950/60">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-0.5">
              Physical Scale Calibration · ISO/IEC 7810 ID-1
            </p>
            <h2 id="calibration-modal-title" className="text-lg font-bold text-white">
              Match Your Real-World Credit Card to the Screen
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
              Hold a standard credit card, EFTPOS card, or NZ driver licence against the screen
              and align the left edge with the cyan guide, then resize until both edges match 1:1.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-lg border border-gray-800 hover:border-gray-700 bg-gray-900 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
            aria-label="Close calibration modal"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Interactive Credit Card Alignment Stage */}
          <div className="relative rounded-xl bg-gray-950 border border-gray-800/90 p-4 sm:p-5 overflow-x-auto">
            {/* Subtle calibration millimeter grid background */}
            <div
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(34,211,238,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(34,211,238,0.18) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />

            <div className="relative flex items-start min-h-[225px] pt-5 pb-3 pl-6">
              {/* Left Alignment Rail */}
              <div className="absolute left-6 top-0 bottom-0 w-px bg-cyan-400/70 pointer-events-none">
                <span className="absolute -top-0.5 left-2 text-[10px] font-mono uppercase tracking-wider text-cyan-400 whitespace-nowrap">
                  ← Align physical card left edge here
                </span>
              </div>

              {/* Top width callout & Virtual Card */}
              <div className="relative select-none" style={{ width: `${cardWidthPx}px` }}>
                {/* Top dimension bar */}
                <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300/90 mb-2">
                  <span className="w-2 h-2 border-l border-t border-cyan-400 -rotate-45" />
                  <div className="flex-1 mx-1 border-t border-dashed border-cyan-500/50" />
                  <span className="px-2 py-0.5 rounded bg-gray-900 border border-cyan-500/30 text-cyan-300">
                    {CREDIT_CARD_WIDTH_MM.toFixed(2)} mm · {cardWidthPx.toFixed(1)} px
                  </span>
                  <div className="flex-1 mx-1 border-t border-dashed border-cyan-500/50" />
                  <span className="w-2 h-2 border-r border-t border-cyan-400 rotate-45" />
                </div>

                {/* Dynamically Sized Virtual Credit Card */}
                <div className="relative flex items-stretch">
                  <div
                    className="relative overflow-hidden border-2 border-cyan-400/80 shadow-[0_0_32px_rgba(34,211,238,0.18)] transition-shadow"
                    style={{
                      width: `${cardWidthPx}px`,
                      height: `${cardHeightPx}px`,
                      borderRadius: `${cornerRadiusPx}px`,
                      background:
                        "linear-gradient(135deg, #0f172a 0%, #1e293b 48%, #0c4a6e 100%)",
                    }}
                  >
                    {/* Decorative subtle tech lines */}
                    <div
                      className="absolute inset-0 opacity-20 pointer-events-none"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle at 82% 24%, rgba(34,211,238,0.6), transparent 45%)",
                      }}
                    />

                    {/* Card interior scaled proportionally */}
                    <div className="relative h-full p-[6%] flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] tracking-widest uppercase text-cyan-300/90 font-semibold">
                          ISO 7810 · ID-1
                        </span>
                        {/* Contactless waves SVG */}
                        <svg
                          viewBox="0 0 24 24"
                          className="w-5 h-5 text-cyan-300/70"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path d="M8.5 14.5a3.5 3.5 0 0 0 0-5" strokeLinecap="round" />
                          <path d="M11.5 16.5a6.5 6.5 0 0 0 0-9" strokeLinecap="round" />
                          <path d="M14.5 18.5a9.5 9.5 0 0 0 0-13" strokeLinecap="round" />
                        </svg>
                      </div>

                      {/* EMV Chip */}
                      <div className="flex items-center gap-3">
                        <div className="w-[15%] aspect-[1.25/1] rounded border border-amber-300/70 bg-gradient-to-br from-amber-200/35 to-amber-500/20 grid grid-cols-3 grid-rows-2 overflow-hidden">
                          <div className="border-r border-b border-amber-300/40" />
                          <div className="border-r border-b border-amber-300/40" />
                          <div className="border-b border-amber-300/40" />
                          <div className="border-r border-amber-300/40" />
                          <div className="border-r border-amber-300/40" />
                          <div />
                        </div>
                        <span className="font-mono text-[10px] text-gray-400">
                          85.60 × 53.98 mm
                        </span>
                      </div>

                      {/* Card footer */}
                      <div className="flex items-end justify-between">
                        <div className="font-mono text-[11px] tracking-[0.2em] text-gray-300/80">
                          3600 · SCALE · CAL · 1:1
                        </div>
                        <div className="flex -space-x-1.5 opacity-75">
                          <span className="w-4 h-4 rounded-full bg-cyan-400/60 border border-cyan-200/40" />
                          <span className="w-4 h-4 rounded-full bg-sky-500/60 border border-sky-200/40" />
                        </div>
                      </div>
                    </div>

                    {/* Corner crosshairs */}
                    <span className="absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t border-l border-cyan-300/80" />
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 border-t border-r border-cyan-300/80" />
                    <span className="absolute bottom-1.5 left-1.5 w-2.5 h-2.5 border-b border-l border-cyan-300/80" />
                    <span className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-b border-r border-cyan-300/80" />
                  </div>

                  {/* Direct Drag Resize Handle on Right Edge */}
                  <div
                    onPointerDown={handleResizePointerDown}
                    onPointerMove={handleResizePointerMove}
                    onPointerUp={handleResizePointerUp}
                    onPointerCancel={handleResizePointerUp}
                    title="Drag horizontally to match your physical card width"
                    className={`group -ml-2.5 z-10 w-5 cursor-ew-resize flex items-center justify-center touch-none`}
                  >
                    <div
                      className={`w-2.5 h-16 rounded-full border flex flex-col items-center justify-center gap-1 transition-all ${
                        isDraggingHandle
                          ? "bg-cyan-400 border-cyan-200 scale-110 shadow-[0_0_16px_rgba(34,211,238,0.8)]"
                          : "bg-gray-900 border-cyan-400/80 group-hover:bg-cyan-400/30"
                      }`}
                    >
                      <span className="w-0.5 h-1.5 rounded-full bg-cyan-200" />
                      <span className="w-0.5 h-1.5 rounded-full bg-cyan-200" />
                      <span className="w-0.5 h-1.5 rounded-full bg-cyan-200" />
                    </div>
                  </div>

                  {/* Right height label */}
                  <div className="ml-2 flex items-center">
                    <span className="text-[10px] font-mono text-gray-500 whitespace-nowrap">
                      {CREDIT_CARD_HEIGHT_MM.toFixed(2)} mm
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Precision Slider + Fine Controls */}
            <div className="relative mt-2 pt-4 border-t border-gray-800/80 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCardWidthPx((w) => clamp(w - 5, MIN_CARD_WIDTH_PX, MAX_CARD_WIDTH_PX))
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-700 hover:border-cyan-500/60 text-xs font-mono text-gray-300 hover:text-cyan-300 transition-colors"
                >
                  −5px
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCardWidthPx((w) => clamp(w - 1, MIN_CARD_WIDTH_PX, MAX_CARD_WIDTH_PX))
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-700 hover:border-cyan-500/60 text-xs font-mono text-gray-300 hover:text-cyan-300 transition-colors"
                >
                  −1px
                </button>
              </div>

              <input
                type="range"
                min={MIN_CARD_WIDTH_PX}
                max={MAX_CARD_WIDTH_PX}
                step={0.5}
                value={cardWidthPx}
                onChange={(e) => setCardWidthPx(parseFloat(e.target.value))}
                className="flex-1 accent-cyan-400 cursor-pointer"
                aria-label="Adjust virtual credit card width in pixels"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCardWidthPx((w) => clamp(w + 1, MIN_CARD_WIDTH_PX, MAX_CARD_WIDTH_PX))
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-700 hover:border-cyan-500/60 text-xs font-mono text-gray-300 hover:text-cyan-300 transition-colors"
                >
                  +1px
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCardWidthPx((w) => clamp(w + 5, MIN_CARD_WIDTH_PX, MAX_CARD_WIDTH_PX))
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-700 hover:border-cyan-500/60 text-xs font-mono text-gray-300 hover:text-cyan-300 transition-colors"
                >
                  +5px
                </button>
              </div>
            </div>
            <p className="text-[11px] font-mono text-gray-500 mt-2">
              Tip: Drag the right edge handle directly, or use{" "}
              <span className="text-gray-300">← / →</span> arrow keys (hold{" "}
              <span className="text-gray-300">Shift</span> for ±5px).
            </p>
          </div>

          {/* Step 2: Viewing Distance + Live Optical Derivation */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Eye-to-Screen Distance */}
            <div className="rounded-xl bg-gray-950/70 border border-gray-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-gray-400">
                  Eye-to-Screen Viewing Distance
                </span>
                <span className="text-sm font-mono font-semibold text-cyan-400">
                  {(viewingDistanceMm / 10).toFixed(0)} cm ({viewingDistanceMm} mm)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {DISTANCE_PRESETS.map((preset) => {
                  const active = Math.abs(viewingDistanceMm - preset.mm) < 5;
                  return (
                    <button
                      key={preset.mm}
                      type="button"
                      onClick={() => setViewingDistanceMm(preset.mm)}
                      className={`px-2 py-2 rounded-lg border text-center transition-colors ${
                        active
                          ? "bg-cyan-500/15 border-cyan-400/70 text-cyan-300"
                          : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-200"
                      }`}
                    >
                      <div className="text-xs font-mono font-semibold">{preset.label}</div>
                      <div className="text-[10px] text-gray-500">{preset.sub}</div>
                    </button>
                  );
                })}
              </div>

              <input
                type="range"
                min={MIN_VIEWING_DISTANCE_MM}
                max={MAX_VIEWING_DISTANCE_MM}
                step={10}
                value={viewingDistanceMm}
                onChange={(e) => setViewingDistanceMm(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-400 cursor-pointer"
                aria-label="Viewing distance in millimeters"
              />
              <p className="text-xs text-gray-500 leading-relaxed">
                Treating your monitor as a physical window into the 360° scene, the real-world
                vertical FOV depends on your screen&apos;s physical height and your distance from it.
              </p>
            </div>

            {/* Derived Optical Parameters */}
            <div className="rounded-xl bg-gray-950/70 border border-gray-800 p-4 flex flex-col justify-between">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-gray-400 mb-3">
                  Derived Real-World Camera Parameters
                </p>
                <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-gray-900 border border-gray-800">
                    <div className="text-gray-500 text-[10px] uppercase">Display Scale</div>
                    <div className="text-white font-semibold mt-0.5">
                      {previewCal.pxPerMm.toFixed(2)} px/mm
                    </div>
                    <div className="text-gray-500 text-[10px]">
                      {previewCal.ppi.toFixed(1)} CSS PPI
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gray-900 border border-gray-800">
                    <div className="text-gray-500 text-[10px] uppercase">Physical Viewport</div>
                    <div className="text-white font-semibold mt-0.5">
                      {Math.round(viewportWidthMm)} × {Math.round(viewportHeightMm)} mm
                    </div>
                    <div className="text-gray-500 text-[10px]">
                      {Math.round(vpW)} × {Math.round(vpH)} CSS px
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 col-span-2 flex items-center justify-between">
                    <div>
                      <div className="text-cyan-400 text-[10px] uppercase">
                        Calibrated 1:1 Vertical FOV
                      </div>
                      <div className="text-lg text-cyan-300 font-bold">
                        {calibratedVFov.toFixed(1)}°{" "}
                        <span className="text-xs font-normal text-gray-400">
                          (hFOV {calibratedHFov.toFixed(1)}°)
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 uppercase">vs Uncalibrated</div>
                      <div className="text-xs text-gray-400 line-through">
                        {DEFAULT_UNCALIBRATED_VFOV_DEG.toFixed(1)}°
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-gray-800/80 text-[11px] font-mono text-gray-500">
                vFOV = 2 · atan(H_mm / 2D) = 2 · atan({viewportHeightMm.toFixed(0)} /{" "}
                {(2 * viewingDistanceMm).toFixed(0)})
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-gray-800 bg-gray-950/70">
          <button
            type="button"
            onClick={() => {
              setCardWidthPx(DEFAULT_CARD_WIDTH_PX);
              setViewingDistanceMm(DEFAULT_VIEWING_DISTANCE_MM);
            }}
            className="text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors"
          >
            Reset to ~96 PPI default
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-600 text-sm font-mono text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onApply(previewCal)}
              className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-gray-950 text-sm font-semibold transition-colors shadow-[0_0_20px_rgba(34,211,238,0.25)]"
            >
              Apply Calibration ({calibratedVFov.toFixed(1)}° FOV)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
