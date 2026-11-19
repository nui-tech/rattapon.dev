"use client";

import { computeAngularSpanPx } from "@/lib/panorama/calibrationMath";
import { CalibrationData } from "@/lib/panorama/types";

interface ScaleReticleOverlayProps {
  visible: boolean;
  vFovDeg: number;
  viewportHeightPx: number;
  yawDeg: number;
  pitchDeg: number;
  calibration: CalibrationData | null;
}

export default function ScaleReticleOverlay({
  visible,
  vFovDeg,
  viewportHeightPx,
  yawDeg,
  pitchDeg,
  calibration,
}: ScaleReticleOverlayProps) {
  if (!visible || viewportHeightPx <= 0) return null;

  // Height on screen of a 5° angular span (approx. a 100m wind turbine at ~1.14 km!)
  const span5DegPx = computeAngularSpanPx(5, vFovDeg, viewportHeightPx);
  const span1DegPx = computeAngularSpanPx(1, vFovDeg, viewportHeightPx);
  const clampedSpanPx = Math.max(24, Math.min(span5DegPx, viewportHeightPx * 0.6));
  const physicalMm =
    calibration && calibration.pxPerMm > 0 ? span5DegPx / calibration.pxPerMm : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center">
      {/* Center crosshair */}
      <div className="relative flex items-center justify-center">
        <div className="w-6 h-px bg-cyan-400/75" />
        <div className="absolute h-6 w-px bg-cyan-400/75" />
        <div className="absolute w-1.5 h-1.5 rounded-full border border-cyan-300 bg-gray-950/60" />

        {/* Vertical 5° angular scale caliper to the right of center */}
        <div
          className="absolute left-12 flex items-center gap-2"
          style={{ height: `${clampedSpanPx}px` }}
        >
          <div className="relative h-full w-3 flex flex-col justify-between items-start">
            <span className="w-3 h-px bg-emerald-400/90" />
            <span className="absolute left-0 top-0 bottom-0 w-px bg-emerald-400/80" />
            {/* 1° sub-ticks if span is large enough */}
            {span1DegPx >= 10 &&
              [1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="absolute left-0 w-1.5 h-px bg-emerald-400/60"
                  style={{ top: `${(i / 5) * 100}%` }}
                />
              ))}
            <span className="w-3 h-px bg-emerald-400/90" />
          </div>
          <div className="px-2 py-1 rounded bg-gray-950/80 border border-emerald-500/30 backdrop-blur-sm text-[10px] font-mono leading-tight whitespace-nowrap">
            <div className="text-emerald-300 font-semibold">5.0° Angular Span</div>
            <div className="text-gray-400">
              {span5DegPx.toFixed(0)} px
              {physicalMm !== null ? ` · ${physicalMm.toFixed(1)} mm on screen` : ""}
            </div>
            <div className="text-gray-500">≈ 100m tower @ 1.15 km</div>
          </div>
        </div>

        {/* Live yaw / pitch readout directly below crosshair */}
        <div className="absolute top-8 px-2 py-0.5 rounded bg-gray-950/75 border border-cyan-500/25 text-[10px] font-mono text-cyan-300 whitespace-nowrap">
          AZ {yawDeg.toFixed(1)}° · EL {pitchDeg >= 0 ? `+${pitchDeg.toFixed(1)}` : pitchDeg.toFixed(1)}°
        </div>
      </div>
    </div>
  );
}
