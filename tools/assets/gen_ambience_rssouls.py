"""Ambient loops for „RS Souls" (games/rssouls) with Stable Audio Open via ComfyUI.

Stable Audio is poor at one-shots (see gen_sfx.py) but good at long textures – which is what an
area's ambience is: wind, drips, distant machines. Each texture is rendered ~22 s long, turned into
a seamless loop by crossfading its tail into its head, normalised quietly and written as Ogg to
games/rssouls/src/assets/audio/amb_<area>.ogg, where the game bundles it with Vite.

  tools/assets/py tools/assets/gen_ambience_rssouls.py            # missing ones
  tools/assets/py tools/assets/gen_ambience_rssouls.py --only rosttal --force
  tools/assets/py tools/assets/gen_ambience_rssouls.py --reloop   # loops again from the cache, no GPU
"""
import argparse
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)

OUT = os.path.join(ROOT, "games", "rssouls", "src", "assets", "audio")
CACHE = os.path.join(HERE, "cache", "rssouls-ambience")
NEG = "music, melody, speech, voice, singing, drums, beat, rhythm, clicks, distortion"
TARGET_RMS = 0.05
STYLE = ", ambient field recording, continuous, seamless background atmosphere, no music"

AMB = {
    "rosttal": ("wind blowing through a slum of corrugated iron shacks, loose sheet metal rattling, distant metal clanks, faint far bell", 401),
    "rohr": ("a maze of industrial pipes, hissing steam leaks, dripping water, low machine hum, metal creaks", 402),
    "unter": ("underground sewer tunnel, slow water drips echoing, trickling stream, deep distant rumble", 403),
    "ader": ("ominous low droning wind over a dead swamp, thick oil bubbling slowly, deep sub rumble", 404),
    "wald": ("quiet ancient forest, gentle wind in leaves, soft rustling, a faint warm hum of light, peaceful", 405),
    "stadt": ("a cold futuristic city at night, distant traffic hum, electrical buzz of neon, far away sirens", 406),
    "labor": ("sterile underground laboratory, steady machine hum, ventilation, quiet electronic ticking, bubbling tanks", 407),
    "pumpe": ("huge pumping station hall, slow heavy pistons thumping, steam, large echoing space", 408),
}


def graph(prompt, seed, seconds, ckpt, t5):
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": ckpt}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": t5, "type": "stable_audio"}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": prompt + STYLE}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": NEG}},
        "5": {"class_type": "ConditioningStableAudio", "inputs": {"positive": ["3", 0], "negative": ["4", 0], "seconds_start": 0.0, "seconds_total": seconds}},
        "6": {"class_type": "EmptyLatentAudio", "inputs": {"seconds": seconds, "batch_size": 1}},
        "7": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "positive": ["5", 0], "negative": ["5", 1], "latent_image": ["6", 0], "seed": seed, "steps": 60, "cfg": 5, "sampler_name": "dpmpp_3m_sde_gpu", "scheduler": "exponential", "denoise": 1.0}},
        "8": {"class_type": "VAEDecodeAudio", "inputs": {"vae": ["1", 2], "samples": ["7", 0]}},
        "9": {"class_type": "SaveAudio", "inputs": {"audio": ["8", 0], "filename_prefix": "rss-amb"}},
    }


def make_loop(src, dst, xfade=2.0):
    """Trim the fade-in and fade-out, crossfade the tail into the head: a loop without a seam."""
    import soundfile as sf

    data, sr = sf.read(src, dtype="float32", always_2d=True)
    stereo = data[:, :2] if data.shape[1] >= 2 else np.repeat(data, 2, axis=1)
    # the model fades in and out: drop half a second at both ends
    cut = int(sr * 0.5)
    body = stereo[cut:-cut] if len(stereo) > 4 * cut else stereo
    n = int(sr * xfade)
    if len(body) < 3 * n:
        return None
    head, mid, tail = body[:n], body[n:-n], body[-n:]
    ramp = np.linspace(0, 1, n, dtype=np.float32)[:, None]
    # equal-power crossfade of the tail into the head: the loop end flows into its own start
    joint = tail * np.cos(ramp * np.pi / 2) + head * np.sin(ramp * np.pi / 2)
    loop = np.concatenate([joint, mid], axis=0)
    # same loudness for every area (RMS), with the peaks kept clear of clipping
    rms = float(np.sqrt(np.mean(loop**2))) or 1.0
    loop *= min(TARGET_RMS / rms, 0.85 / (float(np.max(np.abs(loop))) or 1.0))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    sf.write(dst, loop, sr, format="OGG", subtype="VORBIS")
    return len(loop) / sr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--seconds", type=float, default=24)
    ap.add_argument("--reloop", action="store_true", help="no GPU: rebuild the loops from the cached renders")
    a = ap.parse_args()
    if a.reloop:
        for name in AMB:
            raw = os.path.join(CACHE, name + ".flac")
            if os.path.exists(raw):
                print(name, make_loop(raw, os.path.join(OUT, f"amb_{name}.ogg")))
        return

    from gen_sfx import find_model
    import comfy

    ckpt = find_model("checkpoints", "stable-audio-open-1.0.safetensors", "stable_audio_open_1.0.safetensors")
    t5 = find_model("text_encoders", "t5-base.safetensors", "t5_base.safetensors")
    if not ckpt or not t5:
        print(f"missing model file (checkpoint={ckpt}, t5={t5})")
        sys.exit(2)
    os.makedirs(CACHE, exist_ok=True)
    for name, (prompt, seed) in AMB.items():
        if a.only and not any(name.startswith(p) for p in a.only.split(",")):
            continue
        dst = os.path.join(OUT, f"amb_{name}.ogg")
        if os.path.exists(dst) and not a.force:
            print(f"skip {name}")
            continue
        t0 = time.time()
        print(f"[ambience] {name}: {prompt}", flush=True)
        raw = os.path.join(CACHE, name + ".flac")
        try:
            out = comfy.submit_and_wait(graph(prompt, seed, a.seconds, ckpt, t5), timeout=900)
            comfy.download(comfy.first_output(out, "audio"), raw)
        except Exception as e:
            print(f"  !! {type(e).__name__}: {str(e)[:300]}", flush=True)
            continue
        secs = make_loop(raw, dst)
        print(f"  → {os.path.relpath(dst, ROOT)} ({secs:.1f}s loop, {time.time() - t0:.0f}s)" if secs else "  !! too short")


if __name__ == "__main__":
    main()
