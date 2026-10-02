"""Ein vorhandenes Bild per Anweisung ändern: Qwen-Image-Edit 2511 in ComfyUI (Pinokio).

Für Einzelheiten, die über mehrere Bilder gleich bleiben sollen (Tasche weg, Stiefel braun,
Handschuhe schwarz …). Das Ergebnis hat dieselbe Größe wie die Vorlage. Mit `--region` wird die
Änderung nur in diesen Rechtecken übernommen (weich überblendet); außerhalb bleibt die Vorlage
pixelgenau erhalten.

  tools/assets/py tools/assets/edit_image.py --in vorlage.png --out neu.png \\
      --prompt "Remove the leather pouch from the coat. Keep everything else exactly the same."
  tools/assets/py tools/assets/edit_image.py --in a.png --out b.png --prompt "..." --region 300,620,520,980

Modelle (models/…): diffusion_models/qwen_image_edit_2511_fp8mixed, loras/Qwen-Image-Edit-2511-
Lightning-4steps-V1.0-bf16, text_encoders/qwen_2.5_vl_7b_fp8_scaled, vae/qwen_image_vae.
Workflow: workflows/qwen_edit.json (lässt sich auch in der ComfyUI-Oberfläche laden).
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def edit_image(src, dst, prompt, seed=1, steps=4, regions=(), feather=12, log=print):
    from PIL import Image, ImageDraw, ImageFilter

    import comfy
    from comfyui_client import ensure_comfyui
    from gen_images import load_graph

    ensure_comfyui(log=log)
    orig = Image.open(src)
    has_alpha = orig.mode in ("RGBA", "LA")
    # the model works on an opaque picture: transparent parts go onto white
    flat = Image.new("RGB", orig.size, "white")
    flat.paste(orig.convert("RGBA"), mask=orig.convert("RGBA").split()[3])
    tmp = os.path.splitext(dst)[0] + ".input.png"
    flat.save(tmp)
    name = comfy.upload_image(tmp, log=log)
    os.remove(tmp)
    graph = load_graph(
        "qwen_edit.json",
        IMAGE=name,
        PROMPT=prompt,
        SEED=int(seed),
        STEPS=int(steps),
        MEGAPIXELS=round(orig.size[0] * orig.size[1] / 1e6, 3),
        NAME="edit-" + os.path.splitext(os.path.basename(dst))[0],
    )
    outputs = comfy.submit_and_wait(graph, timeout=1800, log=log)
    comfy.download(comfy.first_output(outputs, "images"), dst, log=log)
    out = Image.open(dst).convert("RGB").resize(orig.size, Image.LANCZOS)
    if regions:
        mask = Image.new("L", orig.size, 0)
        d = ImageDraw.Draw(mask)
        for r in regions:
            d.rectangle(r, fill=255)
        if feather:
            mask = mask.filter(ImageFilter.GaussianBlur(feather))
        out = Image.composite(out, flat, mask)
    if has_alpha:
        from rembg import remove

        out = remove(out.convert("RGBA"))
    out.save(dst)
    log(f"[edit] {dst}")
    return dst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--steps", type=int, default=4)
    ap.add_argument("--region", action="append", default=[], help="x0,y0,x1,y1 in Pixeln der Vorlage (mehrfach)")
    ap.add_argument("--feather", type=int, default=12)
    a = ap.parse_args()
    regions = [tuple(int(v) for v in r.split(",")) for r in a.region]
    edit_image(a.src, a.out, a.prompt, seed=a.seed, steps=a.steps, regions=regions, feather=a.feather)


if __name__ == "__main__":
    main()
