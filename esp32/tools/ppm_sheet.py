"""Combines the PPM frames from render_preview into one scaled PNG contact sheet (stdlib only).

    python ppm_sheet.py <dir with .ppm files> <out.png> [scale]
"""
import struct
import sys
import zlib
from pathlib import Path


def read_ppm(path):
    data = path.read_bytes()
    parts = data.split(b"\n", 3)
    w, h = map(int, parts[1].split())
    return w, h, parts[3]


def write_png(path, w, h, rows):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)

    def chunk(kind, body):
        c = struct.pack(">I", len(body)) + kind + body
        return c + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    Path(path).write_bytes(png)


def main():
    src, out = Path(sys.argv[1]), sys.argv[2]
    scale = int(sys.argv[3]) if len(sys.argv) > 3 else 3
    frames = [read_ppm(p) for p in sorted(src.glob("*.ppm"))]
    w, h = frames[0][0], frames[0][1]
    cols, pad = 4, 6
    rows_n = (len(frames) + cols - 1) // cols
    sw, sh = cols * (w * scale + pad) + pad, rows_n * (h * scale + pad) + pad
    canvas = [bytearray([40, 40, 40] * sw) for _ in range(sh)]
    for i, (_, _, pix) in enumerate(frames):
        ox = pad + (i % cols) * (w * scale + pad)
        oy = pad + (i // cols) * (h * scale + pad)
        for y in range(h):
            line = bytearray()
            for x in range(w):
                line += pix[(y * w + x) * 3:(y * w + x) * 3 + 3] * scale
            for s in range(scale):
                canvas[oy + y * scale + s][ox * 3:(ox + w * scale) * 3] = line
    write_png(out, sw, sh, canvas)


if __name__ == "__main__":
    main()
