import { LOD_LEVELS, TileSource } from "./types";

/**
 * Loads a tile over HTTP with real AbortController cancellation so rapid panning
 * drops out-of-frustum requests immediately.
 */
async function fetchImageWithAbort(
  url: string,
  signal?: AbortSignal
): Promise<HTMLImageElement> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Tile fetch failed (${response.status}): ${url}`);
  }
  const blob = await response.blob();
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  const objectUrl = URL.createObjectURL(blob);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to decode tile image: ${url}`));
    };
    img.src = objectUrl;
  });
}

/**
 * Pre-tiled 4-level equirectangular photograph (Poly Haven CC0 — Alps Field).
 * Files live at /pano/alps/{level}/{row}_{col}.jpg (170 tiles across L0..L3).
 */
export function createAlpsTileSource(): TileSource {
  return {
    id: "alps",
    name: "Alpine Valley (4K Photo)",
    subtitle: "Pre-tiled 4-level equirectangular pyramid (CC0 · 4096×2048)",
    initialYawDeg: 180, // Faces the alpine mountain ridge & valley
    initialPitchDeg: 3,
    loadTile: (level, col, row, signal) =>
      fetchImageWithAbort(`/pano/alps/${level}/${row}_${col}.jpg`, signal),
  };
}

/**
 * Mathematically exact procedural 4-level equirectangular Calibration Survey Dome.
 * Renders azimuth/elevation meridians (15° / 5° / 1°), horizon datum, and known-angle
 * optical scale targets so users can verify both LOD switching and 1:1 physical scale.
 */
export function createCalibrationDomeSource(): TileSource {
  return {
    id: "calibration-dome",
    name: "Optical Survey Dome",
    subtitle: "Synthetic 1°/5°/15° angular grid & real-world scale targets",
    initialYawDeg: 180,
    initialPitchDeg: 0,
    loadTile: async (level, col, row) => {
      const cfg = LOD_LEVELS[level];
      const size = cfg.tileSize;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;

      const degPerTileX = 360 / cfg.cols;
      const degPerTileY = 180 / cfg.rows;
      const lonStart = col * degPerTileX; // 0..360
      const lonEnd = lonStart + degPerTileX;
      const latTop = 90 - row * degPerTileY; // +90 (zenith) down to -90 (nadir)
      const latBottom = latTop - degPerTileY;

      const lonToX = (lon: number) => ((lon - lonStart) / degPerTileX) * size;
      const latToY = (lat: number) => ((latTop - lat) / degPerTileY) * size;

      // Sky vs ground subtle elevation gradient
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      const skyColor = (lat: number) => {
        if (lat >= 0) {
          const t = Math.min(1, lat / 90);
          const r = Math.round(12 - t * 6);
          const g = Math.round(28 - t * 14);
          const b = Math.round(48 - t * 18);
          return `rgb(${r},${g},${b})`;
        } else {
          const t = Math.min(1, -lat / 90);
          const r = Math.round(15 - t * 8);
          const g = Math.round(23 - t * 12);
          const b = Math.round(32 - t * 18);
          return `rgb(${r},${g},${b})`;
        }
      };
      grad.addColorStop(0, skyColor(latTop));
      if (latTop > 0 && latBottom < 0) {
        const horizonStop = latTop / (latTop - latBottom);
        grad.addColorStop(Math.max(0, horizonStop - 0.002), "rgb(14, 38, 60)");
        grad.addColorStop(Math.min(1, horizonStop + 0.002), "rgb(18, 28, 38)");
      }
      grad.addColorStop(1, skyColor(latBottom));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // 1° minor grid (L2 & L3)
      if (level >= 2) {
        ctx.strokeStyle = "rgba(34, 211, 238, 0.09)";
        ctx.lineWidth = 1;
        for (let lon = Math.ceil(lonStart); lon <= Math.floor(lonEnd); lon++) {
          if (lon % 5 === 0) continue;
          const x = lonToX(lon);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, size);
          ctx.stroke();
        }
        for (let lat = Math.ceil(latBottom); lat <= Math.floor(latTop); lat++) {
          if (lat % 5 === 0) continue;
          const y = latToY(lat);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(size, y);
          ctx.stroke();
        }
      }

      // 5° intermediate grid (L1+)
      if (level >= 1) {
        ctx.strokeStyle = "rgba(34, 211, 238, 0.22)";
        ctx.lineWidth = 1;
        const firstLon5 = Math.ceil(lonStart / 5) * 5;
        for (let lon = firstLon5; lon <= lonEnd; lon += 5) {
          if (lon % 15 === 0) continue;
          const x = lonToX(lon);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, size);
          ctx.stroke();
        }
        const firstLat5 = Math.ceil(latBottom / 5) * 5;
        for (let lat = firstLat5; lat <= latTop; lat += 5) {
          if (lat % 15 === 0) continue;
          const y = latToY(lat);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(size, y);
          ctx.stroke();
        }
      }

      // 15° major grid (all levels)
      ctx.strokeStyle = "rgba(34, 211, 238, 0.45)";
      ctx.lineWidth = level === 0 ? 1.5 : 1.25;
      const firstLon15 = Math.ceil(lonStart / 15) * 15;
      for (let lon = firstLon15; lon <= lonEnd; lon += 15) {
        const x = lonToX(lon);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size);
        ctx.stroke();
      }
      const firstLat15 = Math.ceil(latBottom / 15) * 15;
      for (let lat = firstLat15; lat <= latTop; lat += 15) {
        const y = latToY(lat);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }

      // Horizon datum line (lat = 0°)
      if (latTop >= -1 && latBottom <= 1) {
        const hy = latToY(0);
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, hy);
        ctx.lineTo(size, hy);
        ctx.stroke();
      }

      // Scale calibration vertical stadia bars on the horizon every 45°
      // Represents a 100 m wind turbine tower at 1,000 m distance = atan(100/1000) = 5.71° angular height!
      if (latTop >= -2 && latBottom <= 10) {
        const targets = [
          { lon: 180, label: "100m Turbine @ 1km", angleDeg: 5.71, accent: "#10b981" },
          { lon: 195, label: "50m Mast @ 500m", angleDeg: 5.71, accent: "#38bdf8" },
          { lon: 165, label: "10° Angular Bar", angleDeg: 10.0, accent: "#f59e0b" },
          { lon: 90, label: "5° Reference", angleDeg: 5.0, accent: "#22d3ee" },
          { lon: 270, label: "5° Reference", angleDeg: 5.0, accent: "#22d3ee" },
        ];

        for (const t of targets) {
          if (t.lon >= lonStart - 2 && t.lon <= lonEnd + 2) {
            const tx = lonToX(t.lon);
            const y0 = latToY(0);
            const yTop = latToY(t.angleDeg);
            ctx.strokeStyle = t.accent;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(tx, y0);
            ctx.lineTo(tx, yTop);
            // End caps
            ctx.moveTo(tx - 8, yTop);
            ctx.lineTo(tx + 8, yTop);
            ctx.moveTo(tx - 8, y0);
            ctx.lineTo(tx + 8, y0);
            ctx.stroke();

            if (level >= 2) {
              ctx.fillStyle = t.accent;
              ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
              ctx.textAlign = "center";
              ctx.fillText(`${t.angleDeg.toFixed(1)}°`, tx, yTop - 6);
              if (level >= 3) {
                ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
                ctx.font = "500 10px ui-monospace, SFMono-Regular, Menlo, monospace";
                ctx.fillText(t.label, tx, yTop - 20);
              }
            }
          }
        }
      }

      // Degree labels at 15° intersections on L2 & L3
      if (level >= 2) {
        ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
        ctx.font = "500 10px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "left";
        const firstLon = Math.ceil(lonStart / 15) * 15;
        const firstLat = Math.ceil(latBottom / 15) * 15;
        for (let lon = firstLon; lon <= lonEnd; lon += 15) {
          for (let lat = firstLat; lat <= latTop; lat += 15) {
            const x = lonToX(lon);
            const y = latToY(lat);
            if (x >= 4 && x <= size - 48 && y >= 14 && y <= size - 6) {
              const az = ((lon % 360) + 360) % 360;
              ctx.fillText(`${az}° / ${lat > 0 ? `+${lat}` : lat}°`, x + 4, y - 4);
            }
          }
        }
      }

      // Subtle LOD watermark in tile corner so LOD transitions are immediately verifiable
      ctx.fillStyle = cfg.color;
      ctx.globalAlpha = 0.72;
      ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "right";
      ctx.fillText(`L${level} [${col},${row}]`, size - 8, size - 8);
      ctx.globalAlpha = 1;

      return canvas;
    },
  };
}

/**
 * Slices any user-uploaded 2:1 equirectangular image in-browser into the exact same
 * 4-level multi-resolution pyramid (L0: 512x256 -> L3: 4096x2048).
 */
export async function createUploadedEquirectSource(file: File): Promise<TileSource> {
  const objectUrl = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not decode uploaded image"));
    el.src = objectUrl;
  });

  // Pre-build 4 downsampled mip canvases so individual tile slices are instant & sharp
  const levelCanvases = LOD_LEVELS.map((cfg) => {
    const c = document.createElement("canvas");
    c.width = cfg.width;
    c.height = cfg.height;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, cfg.width, cfg.height);
    return c;
  });

  URL.revokeObjectURL(objectUrl);

  return {
    id: `upload-${Date.now()}`,
    name: file.name.length > 26 ? `${file.name.slice(0, 23)}...` : file.name,
    subtitle: `Client-sliced 4-level pyramid (${img.naturalWidth}×${img.naturalHeight} source)`,
    initialYawDeg: 180,
    initialPitchDeg: 0,
    loadTile: async (level, col, row) => {
      const cfg = LOD_LEVELS[level];
      const tile = document.createElement("canvas");
      tile.width = cfg.tileSize;
      tile.height = cfg.tileSize;
      const ctx = tile.getContext("2d")!;
      ctx.drawImage(
        levelCanvases[level],
        col * cfg.tileSize,
        row * cfg.tileSize,
        cfg.tileSize,
        cfg.tileSize,
        0,
        0,
        cfg.tileSize,
        cfg.tileSize
      );
      return tile;
    },
    dispose: () => {
      levelCanvases.forEach((c) => {
        c.width = 0;
        c.height = 0;
      });
    },
  };
}
