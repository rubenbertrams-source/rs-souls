"""Kontaktbogen der gerenderten Rig-Aktionen, so zusammengesetzt wie im Spiel:
Körper, dann das Schwert am Griffpunkt, dann die Schwertfaust darüber.

  tools/assets/py tools/assets/rssouls_rig/preview.py out.png [aktion …]
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
RIG = os.path.join(ROOT, "assets-source", "rssouls", "rig")
WPN = os.path.join(ROOT, "games", "rssouls", "src", "assets", "img", "wpn_rost-klinge.webp")
CUT, GRIP = 0.16, 0.205


def sword_at(frame, gx, gy, ang, length):
    img = Image.open(WPN).convert("RGBA")
    w, h = img.size
    img = img.crop((int(w * CUT), 0, w, h))
    full = length
    vis = full * (1 - CUT)
    img = img.resize((max(1, round(vis)), max(1, round(vis * h / (w * (1 - CUT))))), Image.LANCZOS)
    # Drehpunkt: der Griff liegt (GRIP - CUT) * Länge vom linken Rand
    px = (GRIP - CUT) * full
    pad = Image.new("RGBA", (img.width * 2 + 4, img.height * 2 + 4 + int(img.width * 2)), (0, 0, 0, 0))
    size = int(full * 2.4)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(img, (round(size / 2 - px), round(size / 2 - img.height / 2)))
    canvas = canvas.rotate(math.degrees(ang), resample=Image.BICUBIC, center=(size / 2, size / 2))
    frame.alpha_composite(canvas, (round(gx - size / 2), round(gy - size / 2)))
    del pad


def main():
    out = sys.argv[1]
    names = sys.argv[2:] or ["idle", "run", "hieb1"]
    rows = []
    for n in names:
        meta = json.load(open(os.path.join(RIG, "frames", n + ".json")))
        s = meta["size"]
        length = 50 / 71 * 890 * meta["scale"]
        row = []
        for i in range(meta["frames"]):
            f = Image.new("RGBA", (s, s), (58, 64, 52, 255))
            d = ImageDraw.Draw(f)
            d.line([(0, meta["ground"]), (s, meta["ground"])], fill=(90, 80, 60, 255), width=2)
            f.alpha_composite(Image.open(os.path.join(RIG, "frames", n, f"body_{i:03d}.png")).convert("RGBA"))
            gx, gy, a = meta["grip"][i]
            sword_at(f, gx, gy, a, length)
            f.alpha_composite(Image.open(os.path.join(RIG, "frames", n, f"hand_{i:03d}.png")).convert("RGBA"))
            d = ImageDraw.Draw(f)
            d.text((4, 4), f"{n} {i}", fill=(255, 255, 160, 255))
            row.append(f)
        rows.append(row)
    cols = max(len(r) for r in rows)
    s = rows[0][0].width
    sheet = Image.new("RGBA", (cols * s, len(rows) * s), (20, 20, 20, 255))
    for y, r in enumerate(rows):
        for x, f in enumerate(r):
            sheet.alpha_composite(f, (x * s, y * s))
    sheet.save(out)


if __name__ == "__main__":
    main()
