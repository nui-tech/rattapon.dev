export interface LODLevelConfig {
  level: number;
  cols: number;
  rows: number;
  tileSize: number;
  width: number;
  height: number;
  label: string;
  color: string;
  hexColor: number;
}

/**
 * 4-level Marzipano-style equirectangular tile pyramid.
 * Level 0 acts as the always-resident base fallback layer (2x1 = 2 tiles),
 * while Levels 1-3 stream on demand only for tiles intersecting the camera frustum.
 */
export const LOD_LEVELS: readonly LODLevelConfig[] = [
  {
    level: 0,
    cols: 2,
    rows: 1,
    tileSize: 256,
    width: 512,
    height: 256,
    label: "L0 · Base (512×256)",
    color: "#f59e0b",
    hexColor: 0xf59e0b,
  },
  {
    level: 1,
    cols: 4,
    rows: 2,
    tileSize: 256,
    width: 1024,
    height: 512,
    label: "L1 · Low (1024×512)",
    color: "#8b5cf6",
    hexColor: 0x8b5cf6,
  },
  {
    level: 2,
    cols: 8,
    rows: 4,
    tileSize: 256,
    width: 2048,
    height: 1024,
    label: "L2 · Medium (2048×1024)",
    color: "#22d3ee",
    hexColor: 0x22d3ee,
  },
  {
    level: 3,
    cols: 16,
    rows: 8,
    tileSize: 256,
    width: 4096,
    height: 2048,
    label: "L3 · High (4096×2048)",
    color: "#10b981",
    hexColor: 0x10b981,
  },
] as const;

export type LODSelectionMode = "auto" | 0 | 1 | 2 | 3;

export type ScaleViewMode = "calibrated" | "uncalibrated" | "free";

export interface CalibrationData {
  /** Measured CSS pixel width of an ISO/IEC 7810 ID-1 credit card (85.60 mm). */
  cardWidthPx: number;
  /** Physical eye-to-screen viewing distance in millimeters. */
  viewingDistanceMm: number;
  /** Derived display density in CSS pixels per millimeter. */
  pxPerMm: number;
  /** Derived effective CSS pixels per inch. */
  ppi: number;
  /** Timestamp when calibration was saved. */
  calibratedAt: number;
}

export interface TileSource {
  id: string;
  name: string;
  subtitle: string;
  /** Initial viewing yaw in degrees (0 = center of equirectangular image). */
  initialYawDeg?: number;
  /** Initial viewing pitch in degrees. */
  initialPitchDeg?: number;
  /** Returns a URL or data/blob URL for the requested tile, or a canvas element directly. */
  loadTile: (
    level: number,
    col: number,
    row: number,
    signal?: AbortSignal
  ) => Promise<HTMLImageElement | HTMLCanvasElement>;
  dispose?: () => void;
}

export interface ViewerTelemetry {
  yawDeg: number;
  pitchDeg: number;
  vFovDeg: number;
  hFovDeg: number;
  targetLod: number;
  lodMode: LODSelectionMode;
  visibleTileCount: number;
  loadedVisibleTileCount: number;
  loadingTileCount: number;
  cachedTileCount: number;
  culledTileCount: number;
  totalTilesAtTargetLod: number;
  levelBreakdown: [number, number, number, number];
  viewportWidthPx: number;
  viewportHeightPx: number;
}
