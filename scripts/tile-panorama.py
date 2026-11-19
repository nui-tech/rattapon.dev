#!/usr/bin/env python3
"""
Slice an equirectangular 360° panorama (2:1) into a 4-level Marzipano-style
multi-resolution tile pyramid:
  Level 0:  2 x 1 tiles ( 512 x  256)
  Level 1:  4 x 2 tiles (1024 x  512)
  Level 2:  8 x 4 tiles (2048 x 1024)
  Level 3: 16 x 8 tiles (4096 x 2048)

Each tile is 256x256 JPEG saved to <output_dir>/<level>/<row>_<col>.jpg.

Usage:
  python3 scripts/tile-panorama.py <input_equirect.jpg> <output_dir> [--quality 82]
"""

import argparse
import os
from pathlib import Path
from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # Support 16K+ panoramas

LEVELS = [
    (0, 2, 1, 256),
    (1, 4, 2, 256),
    (2, 8, 4, 256),
    (3, 16, 8, 256),
]


def tile_panorama(input_path: Path, output_dir: Path, quality: int = 82) -> None:
    print(f"Loading {input_path} ...")
    src = Image.open(input_path).convert("RGB")
    print(f"Source resolution: {src.width}x{src.height}")

    total_tiles = 0
    total_bytes = 0

    # Generate from highest resolution downwards for crisp Lanczos antialiasing
    for level, cols, rows, tile_size in reversed(LEVELS):
        target_w = cols * tile_size
        target_h = rows * tile_size
        print(f"Level {level}: resizing to {target_w}x{target_h} ({cols}x{rows} tiles) ...")
        level_img = src.resize((target_w, target_h), Image.Resampling.LANCZOS)

        level_dir = output_dir / str(level)
        level_dir.mkdir(parents=True, exist_ok=True)

        for row in range(rows):
            for col in range(cols):
                left = col * tile_size
                top = row * tile_size
                tile = level_img.crop((left, top, left + tile_size, top + tile_size))
                tile_path = level_dir / f"{row}_{col}.jpg"
                tile.save(tile_path, "JPEG", quality=quality, optimize=True, progressive=False)
                total_tiles += 1
                total_bytes += os.path.getsize(tile_path)

    print(f"Done! Wrote {total_tiles} tiles ({total_bytes / 1024 / 1024:.2f} MB) to {output_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Tile a 360° equirectangular panorama into 4 LOD levels.")
    parser.add_argument("input", type=Path, help="Path to source equirectangular image")
    parser.add_argument("output", type=Path, help="Output directory for tile pyramid")
    parser.add_argument("--quality", type=int, default=82, help="JPEG quality (default: 82)")
    args = parser.parse_args()
    tile_panorama(args.input, args.output, args.quality)
