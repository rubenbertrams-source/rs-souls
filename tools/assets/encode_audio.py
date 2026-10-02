"""Encode generated audio for delivery: masters in assets-source/ → Ogg Vorbis in public/.

Three kinds, one script:

  music  ACE-Step renders 320 kbps MP3 (4.4 MB per 110 s track)
  sfx    Stable Audio Open renders WAV (174 files, 7.8 MB), several takes per name (name, name.v2)
  voice  spoken lines cut by import_voice.py (WAV, ~1 s each), the target sounds of Nachmacher

Both stay as masters in assets-source/, outside publicDir. The browser gets an Ogg transcode a
fraction of the size. AudioManager ranks .ogg ahead of .mp3 and .wav per name *and take*, so a
transcode replaces its master in delivery instead of being loaded next to it – that ranking is what
makes this safe for sfx, and it is why the sfx were still WAV until it existed.

  ./py encode_audio.py                     # encode what is missing or out of date, both kinds
  ./py encode_audio.py --only sfx          # just one kind
  ./py encode_audio.py --force
  ./py encode_audio.py --quality 0.7       # override for both kinds

Quality is libsndfile's compression level for Vorbis. Measured on a 110 s stereo 48 kHz track:
0.6 ≈ 138 kbps, 0.7 ≈ 118 kbps, 0.8 ≈ 97 kbps, 1.0 ≈ 62 kbps.

Music defaults to 0.8: it plays under everything and nobody listens to it closely.

Sfx default to 0.0, the encoder's best setting. 0.4 shipped first and was audibly worse - measured
against the masters, the whole set sits at a median 23 dB SNR there against 38.6 dB at 0.0, and the
difference is not academic: these are short transients (impacts, coins, a lap bell) that play in the
foreground, and smearing them is exactly what a perceptual codec does when it is given room. The
setting costs 1.4 MB over the whole set (1.7 -> 3.1 MB) and still saves 4.3 MB against the WAV
masters. If a sound ever sounds wrong again, the way back is short: delete public/assets/generated/
sfx/*.ogg, copy the masters from assets-source/generated/sfx/ in their place and rebuild the
manifest - registerSamples ranks ogg over wav per take, so whichever format is present is the one
that plays.
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SOURCE_EXT = (".mp3", ".wav", ".flac", ".ogg")
KINDS = {
    "music": {"quality": 0.8},
    "sfx": {"quality": 0.0},
    # Spoken lines for Nachmacher (import_voice.py). Same setting as the sfx and for the same
    # reason: they are the thing being judged, and the scorer reads the spectrum the player hears.
    "voice": {"quality": 0.0},
}


def paths(kind):
    return (
        os.path.join(ROOT, "assets-source", "generated", kind),
        os.path.join(ROOT, "public", "assets", "generated", kind),
    )
# libsndfile segfaults when a whole 110 s track is handed to the Vorbis encoder in one call, so the
# samples go in one second at a time.
CHUNK = 48000


def encode(src, dst, quality):
    import soundfile as sf

    data, rate = sf.read(src, dtype="float32", always_2d=True)
    tmp = dst + ".part"
    with sf.SoundFile(tmp, "w", samplerate=rate, channels=data.shape[1], format="OGG",
                      subtype="VORBIS", compression_level=quality) as f:
        for i in range(0, len(data), CHUNK):
            f.write(data[i:i + CHUNK])
    os.replace(tmp, dst)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quality", type=float, default=None, help="0.0 best … 1.0 smallest (default: 0.8 music, 0.4 sfx)")
    ap.add_argument("--only", choices=sorted(KINDS), help="encode just this kind")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    for kind in [a.only] if a.only else sorted(KINDS):
        SRC, OUT = paths(kind)
        quality = a.quality if a.quality is not None else KINDS[kind]["quality"]
        if not os.path.isdir(SRC):
            print(f"no masters in {SRC}", file=sys.stderr)
            continue
        os.makedirs(OUT, exist_ok=True)
        total_src = total_dst = 0
        for fn in sorted(os.listdir(SRC)):
            name, ext = os.path.splitext(fn)
            if ext.lower() not in SOURCE_EXT:
                continue
            src, dst = os.path.join(SRC, fn), os.path.join(OUT, name + ".ogg")
            total_src += os.path.getsize(src)
            if not a.force and os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
                total_dst += os.path.getsize(dst)
                continue
            encode(src, dst, quality)
            total_dst += os.path.getsize(dst)
        print(f"{kind}: {total_src / 1048576:.1f} MB → {total_dst / 1048576:.1f} MB (quality {quality})")
    sys.path.insert(0, HERE)
    from run_all import rebuild_manifest

    print(f"manifest: {len(rebuild_manifest())} Dateien")


if __name__ == "__main__":
    main()
