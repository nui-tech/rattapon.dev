import { CalibrationData } from "./types";

/** ISO/IEC 7810 ID-1 standard credit card dimensions (millimeters). */
export const CREDIT_CARD_WIDTH_MM = 85.6;
export const CREDIT_CARD_HEIGHT_MM = 53.98;
export const CREDIT_CARD_CORNER_RADIUS_MM = 3.18;
export const CREDIT_CARD_ASPECT = CREDIT_CARD_WIDTH_MM / CREDIT_CARD_HEIGHT_MM;

/** Standard desktop viewing distance in mm (60 cm), commonly used in LVIA / panoramic visualisation. */
export const DEFAULT_VIEWING_DISTANCE_MM = 600;
export const MIN_VIEWING_DISTANCE_MM = 300;
export const MAX_VIEWING_DISTANCE_MM = 1200;

/** Typical default vertical FOV of uncalibrated Three.js / web panoramic viewers. */
export const DEFAULT_UNCALIBRATED_VFOV_DEG = 75;

export const MIN_VFOV_DEG = 10;
export const MAX_VFOV_DEG = 110;

export const MIN_CARD_WIDTH_PX = 160;
export const MAX_CARD_WIDTH_PX = 620;
/** Reasonable starting estimate (~96 CSS PPI -> 3.78 px/mm -> ~324 px). */
export const DEFAULT_CARD_WIDTH_PX = Math.round((96 / 25.4) * CREDIT_CARD_WIDTH_MM);

const STORAGE_KEY = "rattapon_pano_calibration_v1";

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Derive physical screen scale from the user's matched on-screen credit card width.
 */
export function computeCalibration(
  cardWidthPx: number,
  viewingDistanceMm: number
): CalibrationData {
  const safeCardPx = clamp(cardWidthPx, MIN_CARD_WIDTH_PX, MAX_CARD_WIDTH_PX);
  const safeDistMm = clamp(
    viewingDistanceMm,
    MIN_VIEWING_DISTANCE_MM,
    MAX_VIEWING_DISTANCE_MM
  );
  const pxPerMm = safeCardPx / CREDIT_CARD_WIDTH_MM;
  const ppi = pxPerMm * 25.4;

  return {
    cardWidthPx: safeCardPx,
    viewingDistanceMm: safeDistMm,
    pxPerMm,
    ppi,
    calibratedAt: Date.now(),
  };
}

/**
 * Compute the physical vertical FOV (degrees) required so that the viewport acts as
 * a true 1:1 physical window into the 360° panoramic world at the viewer's eye distance.
 *
 *   vFOV = 2 * atan( H_viewport_mm / (2 * D_eye_mm) )
 */
export function computeCalibratedVFovDeg(
  viewportHeightPx: number,
  pxPerMm: number,
  viewingDistanceMm: number
): number {
  if (viewportHeightPx <= 0 || pxPerMm <= 0 || viewingDistanceMm <= 0) {
    return DEFAULT_UNCALIBRATED_VFOV_DEG;
  }
  const viewportHeightMm = viewportHeightPx / pxPerMm;
  const vFovRad = 2 * Math.atan(viewportHeightMm / (2 * viewingDistanceMm));
  return clamp(radToDeg(vFovRad), MIN_VFOV_DEG, MAX_VFOV_DEG);
}

/**
 * Compute horizontal FOV (degrees) from vertical FOV and viewport aspect ratio.
 */
export function computeHFovDeg(vFovDeg: number, aspect: number): number {
  const halfVRad = degToRad(vFovDeg) / 2;
  const halfHRad = Math.atan(Math.tan(halfVRad) * Math.max(aspect, 0.1));
  return radToDeg(2 * halfHRad);
}

/**
 * Compute how large objects appear on screen relative to real life (1.00 = true 1:1 scale).
 * Values < 1 mean the scene is compressed / looks smaller & farther than real life.
 * Values > 1 mean the scene is magnified / zoomed in beyond real life.
 */
export function computeRealWorldScaleRatio(
  currentVFovDeg: number,
  calibratedVFovDeg: number
): number {
  const tanCal = Math.tan(degToRad(calibratedVFovDeg) / 2);
  const tanCur = Math.tan(degToRad(currentVFovDeg) / 2);
  if (tanCur <= 0) return 1;
  return tanCal / tanCur;
}

/**
 * Compute the physical height (in mm) on screen subtended by a given angular size (degrees)
 * at the calibrated viewing distance. Useful for rendering a real-world angular scale ruler.
 */
export function computeAngularSpanPx(
  angleDeg: number,
  vFovDeg: number,
  viewportHeightPx: number
): number {
  const halfAngle = degToRad(angleDeg) / 2;
  const halfFov = degToRad(vFovDeg) / 2;
  const tanFov = Math.tan(halfFov);
  if (tanFov <= 0) return 0;
  return (Math.tan(halfAngle) / tanFov) * viewportHeightPx;
}

export function saveCalibration(data: CalibrationData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota / private mode errors
  }
}

export function loadCalibration(): CalibrationData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CalibrationData>;
    if (
      typeof parsed.cardWidthPx === "number" &&
      typeof parsed.viewingDistanceMm === "number" &&
      parsed.cardWidthPx >= MIN_CARD_WIDTH_PX &&
      parsed.cardWidthPx <= MAX_CARD_WIDTH_PX
    ) {
      return computeCalibration(parsed.cardWidthPx, parsed.viewingDistanceMm);
    }
    return null;
  } catch {
    return null;
  }
}

export function clearCalibration(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
