"""Die Teile des Helden-Rigs aus der Vorlage schneiden.

Ebenen (alle 768×1024, gleiche Lage):
  O  assets-source/rssouls/spr_hero_idle.png       die Figur aus dem Spiel (Original)
  A  assets-source/rssouls/rig/hero_noarms.png     dieselbe Figur ohne Arme (Qwen-Image-Edit)
  B  assets-source/rssouls/rig/hero_legs.png       dieselbe Figur ohne Mantelschoß (Qwen-Image-Edit)

Kopf, Arme und Stiefel kommen aus O. Rumpf und Mantel kommen aus A, wo sie hinter den Armen
vollständig sind; fehlt A, nimmt das Werkzeug O (dann mit Resten der Arme, nur zum Testen).
Oberschenkel kommen aus B, fehlt B, bleiben sie leer. Die Arme werden, wenn A da ist, genau
dort ausgeschnitten, wo O und A sich unterscheiden.

  tools/assets/py tools/assets/rssouls_rig/cut_parts.py [--preview out.png]
Ausgabe: assets-source/rssouls/rig/parts/<teil>.png und rig.json (Lage der Teile, Knochen).
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import hero_spec as spec  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = os.path.join(ROOT, "assets-source", "rssouls")
RIG = os.path.join(SRC, "rig")

# Umrisse der Teile in Pixeln der Vorlage, großzügig: es zählt, was darin zur Figur gehört.
POLYS = {
    "head": [(318, 150), (333, 100), (380, 80), (440, 82), (482, 105), (498, 150), (496, 228), (480, 252),
             (440, 264), (395, 264), (352, 252), (325, 228)],
    "torso": [(236, 262), (318, 205), (505, 215), (530, 290), (548, 420), (528, 512), (292, 512), (288, 470),
              (296, 400), (250, 300)],
    "skirt_b": [(196, 490), (422, 490), (422, 860), (196, 860)],
    "skirt_f": [(402, 490), (566, 490), (585, 860), (402, 860)],
    "arm_r_up": [(228, 276), (302, 276), (310, 330), (302, 398), (292, 436), (194, 436), (204, 378), (220, 326)],
    "arm_r_lo": [(190, 424), (296, 424), (292, 470), (296, 500), (292, 558), (192, 558), (192, 500)],
    "hand_r": [(192, 548), (296, 548), (300, 600), (290, 636), (196, 636), (188, 600)],
    "arm_l_up": [(486, 286), (532, 296), (546, 330), (558, 418), (564, 440), (496, 440), (492, 380), (486, 330)],
    "arm_l_lo": [(492, 426), (566, 426), (588, 498), (596, 558), (498, 558), (496, 498)],
    "hand_l": [(500, 548), (596, 548), (594, 622), (574, 644), (516, 640), (504, 600)],
    "leg_r_up": [(286, 520), (380, 520), (330, 820), (236, 820)],
    "leg_l_up": [(410, 520), (500, 520), (520, 815), (436, 815)],
    "leg_r_lo": [(226, 760), (326, 760), (314, 900), (310, 982), (208, 984), (214, 900)],
    "leg_l_lo": [(434, 760), (532, 760), (524, 900), (604, 928), (604, 978), (436, 978), (442, 900)],
}
# Woher ein Teil kommt (erste vorhandene Ebene gewinnt).
LAYER = {
    "head": "O",
    "torso": "AO",
    "skirt_b": "AO",
    "skirt_f": "AO",
    "arm_r_up": "O", "arm_r_lo": "O", "hand_r": "O",
    "arm_l_up": "O", "arm_l_lo": "O", "hand_l": "O",
    "leg_r_up": "B", "leg_l_up": "B",
    "leg_r_lo": "BO", "leg_l_lo": "BO",
}
ARMS = {"arm_r_up", "arm_r_lo", "hand_r", "arm_l_up", "arm_l_lo", "hand_l"}


def alpha_of(img_rgb):
    """Freistellen (rembg) – Weiß um die Figur wird durchsichtig."""
    from rembg import remove

    cut = remove(img_rgb.convert("RGBA"))
    a = np.array(cut.split()[3])
    a[a < 20] = 0
    return a


def poly_mask(pts, size):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return np.array(m) > 0


def load_layers():
    layers = {}
    for key, path in (("O", os.path.join(SRC, spec.SOURCE)), ("A", os.path.join(RIG, "hero_noarms.png")), ("B", os.path.join(RIG, "hero_legs.png"))):
        if not os.path.exists(path):
            continue
        img = Image.open(path).convert("RGB")
        if img.size != spec.SIZE:
            img = img.resize(spec.SIZE, Image.LANCZOS)
        cache = os.path.join(RIG, f".alpha-{key}.png")
        if os.path.exists(cache) and os.path.getmtime(cache) >= os.path.getmtime(path):
            a = np.array(Image.open(cache))
        else:
            a = alpha_of(img)
            os.makedirs(RIG, exist_ok=True)
            Image.fromarray(a).save(cache)
        rgb = np.array(img)
        if key != "O" and "O" in layers:
            dx, dy = align(layers["O"][0], rgb)
            if dx or dy:
                print(f"Ebene {key}: um {dx},{dy} px verschoben, ausgerichtet")
                rgb = np.roll(rgb, (-dy, -dx), axis=(0, 1))
                a = np.roll(a, (-dy, -dx), axis=(0, 1))
        layers[key] = (rgb, a)
    return layers


def align(ref, img, box=(330, 90, 500, 260), r=14):
    """Verschiebung von `img` gegenüber `ref`, gemessen am Kopf (in allen Varianten unverändert)."""
    x0, y0, x1, y1 = box
    a = ref[y0:y1, x0:x1].astype(np.float32)
    best, arg = None, (0, 0)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            b = img[y0 + dy:y1 + dy, x0 + dx:x1 + dx].astype(np.float32)
            d = float(np.abs(a - b).mean())
            if best is None or d < best:
                best, arg = d, (dx, dy)
    return arg


def arm_region(layers):
    """Wo O und A sich unterscheiden: dort liegen die Arme (aufgeweitet, Löcher gefüllt)."""
    if "A" not in layers:
        return None
    o, oa = layers["O"]
    a, aa = layers["A"]
    diff = np.abs(o.astype(int) - a.astype(int)).sum(axis=2) > 60
    diff |= (oa > 0) & (aa == 0)
    m = Image.fromarray((diff * 255).astype(np.uint8))
    # Rauschen weg, Umriss schließen, Ränder mitnehmen
    m = m.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(5))
    return np.array(m) > 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", default="")
    a = ap.parse_args()
    layers = load_layers()
    arms = arm_region(layers)
    os.makedirs(os.path.join(RIG, "parts"), exist_ok=True)
    out = {"size": list(spec.SIZE), "bones": spec.BONES, "parts": [], "frame": {
        "center": list(spec.FRAME_CENTER), "span": spec.FRAME_SPAN, "px": spec.FRAME_PX, "ground": spec.GROUND_Y}}
    preview = Image.new("RGBA", spec.SIZE, (60, 110, 60, 255))
    for z, p in enumerate(spec.PARTS):
        pid = p["id"]
        src = next((k for k in LAYER[pid] if k in layers), None)
        if src is None:
            print("skip", pid, "(keine Ebene)")
            continue
        rgb, alpha = layers[src]
        m = poly_mask(POLYS[pid], spec.SIZE) & (alpha > 0)
        if arms is not None and pid in ARMS:
            m &= arms
        if not m.any():
            print("skip", pid, "(leer)")
            continue
        rgba = np.dstack([rgb, np.where(m, alpha, 0)]).astype(np.uint8)
        ys, xs = np.nonzero(m)
        x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
        img = Image.fromarray(rgba, "RGBA").crop((x0, y0, x1, y1))
        img.save(os.path.join(RIG, "parts", pid + ".png"))
        out["parts"].append({"id": pid, "file": f"parts/{pid}.png", "bbox": [x0, y0, x1, y1], "bone": p["bone"], "z": z,
                             "tint": p.get("tint", 1.0), "layer": p.get("layer", "body"), "from": src})
        preview.alpha_composite(img, (x0, y0))
        print(f"{pid:9s} {src} bbox {x0},{y0}-{x1},{y1}")
    with open(os.path.join(RIG, "rig.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, indent=1)
    if a.preview:
        preview.save(a.preview)


if __name__ == "__main__":
    main()
