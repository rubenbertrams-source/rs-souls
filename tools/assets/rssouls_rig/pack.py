"""Gerenderte Rig-Bilder fürs Spiel packen.

Je Aktion ein Streifen (alle Bilder nebeneinander) für den Körper und einer für die Schwertfaust,
auf den gemeinsamen Rahmen aller Bilder der Aktion zugeschnitten. Dazu `hero.json` mit Bildgröße,
Bezugspunkt (Fußpunkt der Figur), Griff je Bild und den Phasen der Angriffe.

  tools/assets/py tools/assets/rssouls_rig/pack.py
Ausgabe: games/rssouls/src/assets/img/rig_hero_<aktion>_{body,hand}.webp, games/rssouls/src/assets/rig/hero.json
"""
import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
RIG = os.path.join(ROOT, "assets-source", "rssouls", "rig")
IMG = os.path.join(ROOT, "games", "rssouls", "src", "assets", "img")
META = os.path.join(ROOT, "games", "rssouls", "src", "assets", "rig")


def main():
    import sys

    sys.path.insert(0, HERE)
    import actions_hero

    rig = json.load(open(os.path.join(RIG, "rig.json")))
    fr = rig["frame"]
    out = {"figurePx": (fr["ground"] - 85) / fr["span"] * fr["px"], "actions": {}}
    for name in actions_hero.ACTIONS:
        meta_path = os.path.join(RIG, "frames", name + ".json")
        if not os.path.exists(meta_path):
            continue
        meta = json.load(open(meta_path))
        n = meta["frames"]
        frames = {layer: [Image.open(os.path.join(RIG, "frames", name, f"{layer}_{i:03d}.png")).convert("RGBA") for i in range(n)]
                  for layer in ("body", "hand")}
        box = None
        for layer in frames.values():
            for im in layer:
                b = im.getbbox()
                if b:
                    box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
        x0, y0, x1, y1 = box
        x0, y0 = max(0, x0 - 2), max(0, y0 - 2)
        x1, y1 = min(meta["size"], x1 + 2), min(meta["size"], y1 + 2)
        w, h = x1 - x0, y1 - y0
        for layer, ims in frames.items():
            strip = Image.new("RGBA", (w * n, h), (0, 0, 0, 0))
            for i, im in enumerate(ims):
                strip.paste(im.crop((x0, y0, x1, y1)), (i * w, 0))
            strip.save(os.path.join(IMG, f"rig_hero_{name}_{layer}.webp"), "WEBP", quality=88, method=6)
        # Bezugspunkt: Mitte des Bildausschnitts der Vorlage (x) auf der Fußlinie (y), im zugeschnittenen Bild
        ax = meta["size"] / 2 - x0
        ay = meta["ground"] - y0
        out["actions"][name] = {
            "frames": n, "fps": meta["fps"], "loop": meta["loop"], "phases": meta["phases"],
            "w": w, "h": h, "anchor": [round(ax, 2), round(ay, 2)],
            "grip": [[round(g[0] - x0, 2), round(g[1] - y0, 2), g[2]] for g in meta["grip"]],
        }
        print(f"{name:10s} {n:2d} Bilder  {w}×{h}")
    os.makedirs(META, exist_ok=True)
    with open(os.path.join(META, "hero.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, indent=1)


if __name__ == "__main__":
    main()
