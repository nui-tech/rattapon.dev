import type { Metadata } from "next";
import PanoramicCalibrationShowcase from "@/components/panorama/PanoramicCalibrationShowcase";

export const metadata: Metadata = {
  title: "360° Panoramic Calibration Showcase — Nui Rattapon",
  description:
    "Interactive Three.js 4-level multi-resolution tiled equirectangular panorama viewer with ISO/IEC 7810 credit-card real-world FOV scale calibration.",
};

export default function PanoramicCalibrationPage() {
  return <PanoramicCalibrationShowcase />;
}
