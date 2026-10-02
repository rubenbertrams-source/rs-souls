"""Die Hilfsebenen fürs Schneiden mit Qwen-Image-Edit erzeugen: dieselbe Figur ohne Arme (A) und
ohne Mantelschoß (B). Mehrere Seeds je Ebene, zur Auswahl; die gewählte wird als
hero_noarms.png / hero_legs.png abgelegt (`--pick A=2,B=1`).

  tools/assets/py tools/assets/rssouls_rig/make_variants.py --seeds 1,2,3
  tools/assets/py tools/assets/rssouls_rig/make_variants.py --pick A=2,B=1
"""
import argparse
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
import hero_spec as spec  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = os.path.join(ROOT, "assets-source", "rssouls", spec.SOURCE)
RIG = os.path.join(ROOT, "assets-source", "rssouls", "rig")

KEEP = ("Keep the hood, goggles, scarf, belt, pouches, coat, trousers and boots exactly the same, "
        "with the same position, size, outlines and colours, on the same plain white background.")
VARIANTS = {
    "A": ("hero_noarms", "Remove both arms and both hands of this character completely. Where the arms were, show the plain "
          "grey coat continuing underneath, with the coat's dark outline along its sides. " + KEEP),
    "B": ("hero_legs", "Remove the long grey coat skirt below the belt, so that both legs are fully visible from the hips down: "
          "brown trousers tucked into the same brown leather boots, standing in the same pose. Keep everything above the belt "
          "exactly the same. " + KEEP),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", default="1,2,3")
    ap.add_argument("--only", default="A,B")
    ap.add_argument("--pick", default="")
    a = ap.parse_args()
    if a.pick:
        for item in a.pick.split(","):
            k, seed = item.split("=")
            name = VARIANTS[k][0]
            shutil.copy(os.path.join(RIG, "variants", f"{name}-{seed}.png"), os.path.join(RIG, name + ".png"))
            print("gewählt", name, seed)
        return
    from edit_image import edit_image

    os.makedirs(os.path.join(RIG, "variants"), exist_ok=True)
    for k in a.only.split(","):
        name, prompt = VARIANTS[k]
        for seed in [int(x) for x in a.seeds.split(",")]:
            dst = os.path.join(RIG, "variants", f"{name}-{seed}.png")
            edit_image(SRC, dst, prompt, seed=seed, log=lambda *_: None)
            print("ok", dst, flush=True)


if __name__ == "__main__":
    main()
