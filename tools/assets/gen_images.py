"""Text → image via ComfyUI (Z-Image Turbo default; flux / sdxl alternatives) + optional rembg cutout.

Usage:
  ./py gen_images.py --prompt "small orange fox ..." --out /tmp/pip.png [--model zimage|flux|sdxl] [--seed 1] [--size 1024x1024] [--cut]
Importable: generate_image(...), cutout(...)
"""
import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import comfy  # noqa: E402

MODELS = {"zimage": ("zimage.json", 8), "flux": ("flux_schnell.json", 4), "sdxl": ("sdxl.json", 28)}


def load_graph(name, **vals):
    with open(os.path.join(HERE, "workflows", name), encoding="utf-8") as f:
        raw = f.read()
    for k, v in vals.items():
        raw = raw.replace('"{{%s}}"' % k, json.dumps(v))  # typed value replaces the whole quoted token
        raw = raw.replace("{{%s}}" % k, json.dumps(str(v))[1:-1])  # token embedded inside a string
    if "{{" in raw:
        missing = re.findall(r"\{\{(\w+)\}\}", raw)
        raise ValueError(f"unfilled placeholders in {name}: {missing}")
    return json.loads(raw)


def generate_image(prompt, out, seed=1, model="zimage", size=(1024, 1024), negative="", steps=None, name=None, log=print):
    wf, default_steps = MODELS[model]
    graph = load_graph(
        wf,
        PROMPT=prompt,
        NEGATIVE=negative or "text, watermark, blurry, low quality",
        WIDTH=size[0],
        HEIGHT=size[1],
        SEED=int(seed),
        STEPS=int(steps or default_steps),
        NAME=name or re.sub(r"[^a-z0-9]+", "-", os.path.splitext(os.path.basename(out))[0].lower()),
    )
    log(f"[image:{model}] {prompt[:90]}…")
    outputs = comfy.submit_and_wait(graph, timeout=900, log=log)
    ref = comfy.first_output(outputs, "images")
    comfy.download(ref, out, log=log)
    return out


def cutout(src, dst, pad_to=1024, bg=None, log=print):
    """Remove background with rembg, crop to content, pad to a square (RGBA, or flattened on `bg`)."""
    from PIL import Image
    from rembg import remove

    img = Image.open(src).convert("RGBA")
    cut = remove(img)
    bbox = cut.getbbox()
    if bbox:
        cut = cut.crop(bbox)
    w, h = cut.size
    side = int(max(w, h) * 1.12)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(cut, ((side - w) // 2, (side - h) // 2), cut)
    canvas = canvas.resize((pad_to, pad_to), Image.LANCZOS)
    if bg is not None:
        flat = Image.new("RGB", canvas.size, bg)
        flat.paste(canvas, mask=canvas.split()[3])
        flat.save(dst)
    else:
        canvas.save(dst)
    log(f"[cutout] {dst}")
    return dst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--negative", default="")
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="zimage", choices=list(MODELS))
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--steps", type=int)
    ap.add_argument("--size", default="1024x1024")
    ap.add_argument("--cut", action="store_true", help="also write <out>.cut.png with background removed")
    a = ap.parse_args()
    w, h = (int(x) for x in a.size.lower().split("x"))
    generate_image(a.prompt, a.out, a.seed, a.model, (w, h), a.negative, a.steps)
    if a.cut:
        cutout(a.out, os.path.splitext(a.out)[0] + ".cut.png")


if __name__ == "__main__":
    main()
