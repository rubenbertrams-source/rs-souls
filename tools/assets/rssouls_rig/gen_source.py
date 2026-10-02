"""Quellbild für das Cutout-Rig des RS-Souls-Helden erzeugen (ComfyUI, Z-Image).

Der Held steht im strengen Profil nach rechts, Arme und Beine leicht vom Körper weg, damit sich
Kopf, Rumpf, Arme, Beine und Mantelschoß sauber in Teile schneiden lassen (cut_parts.py).

  tools/assets/py tools/assets/rssouls_rig/gen_source.py --seeds 1,2,3     # Kandidaten
Ausgabe: assets-source/rssouls/rig/source-<seed>.png
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(ROOT, "assets-source", "rssouls", "rig")

PROMPT = (
    "2D side scrolling platformer game character sprite, orthographic side view, exact side profile facing right, "
    "we see only the left side of the body, only one goggle lens visible, nose and chest pointing to the right edge of the image, "
    "a nameless lean survivor in a tattered knee length grey coat, hood up and a soot-stained scarf over the face, "
    "small round brass goggles, belt with a brass buckle, brown trousers, dark leather boots, black gloves, "
    "standing upright, the near arm held out forward and down away from the body at a slight angle, fist clenched, "
    "legs straight and slightly apart in a small step so both boots are visible, "
    "dark fantasy industrial, hand painted with clean dark outlines, flat cel shading, strong readable silhouette, muted palette, "
    "single character, centered, plain white background, no scenery, no shadow, no text"
)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", default="1,2,3,4,5,6")
    a = ap.parse_args()
    from comfyui_client import ensure_comfyui
    from gen_images import generate_image

    ensure_comfyui()
    os.makedirs(OUT, exist_ok=True)
    for s in [int(x) for x in a.seeds.split(",") if x]:
        dst = os.path.join(OUT, f"source-{s}.png")
        generate_image(PROMPT, dst, seed=s, size=(768, 1024), name=f"rssouls-rig-{s}", log=lambda *_: None)
        print("ok", dst, flush=True)


if __name__ == "__main__":
    main()
