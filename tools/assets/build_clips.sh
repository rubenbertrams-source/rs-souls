#!/usr/bin/env bash
# Turns the frames from tools/dev/record-clips.sh into the webm loops the game-select tiles play,
# plus the still that every waiting tile shows.
#
# Video, not a sprite sheet: three clips per game as sheets would be ~1 MB per game, and the sheet
# had to be decoded whole before the first frame could be shown. VP9 gets the same three seconds
# into well under a tenth of that, and the browser streams it.
#
#   bash tools/assets/build_clips.sh [id ...]      # default: all three games
#
# Writes public/assets/previews/<id>.clip-{1,2,3}.webm and <id>.poster.webp.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/tools/assets/cache/preview"
DST="$ROOT/public/assets/previews"

# ffmpeg is not installed on this machine; the asset venv carries a static build (imageio-ffmpeg).
FFMPEG="$(command -v ffmpeg || true)"
if [ -z "$FFMPEG" ]; then
  FFMPEG="$("$HOME/.venvs/pv-assets/bin/python" -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())' 2>/dev/null || true)"
fi
[ -n "$FFMPEG" ] || { echo "no ffmpeg – install one, or: ~/.venvs/pv-assets/bin/pip install imageio-ffmpeg"; exit 1; }

mkdir -p "$DST"
ids=("$@")
[ ${#ids[@]} -gt 0 ] || ids=(brawl kart towers mimic duckjump anschluss)

for id in "${ids[@]}"; do
  made=0
  for n in 1 2 3; do
    dir="$SRC/$id-$n"
    [ -d "$dir" ] || { echo "  skip $id-$n (no frames – run tools/dev/record-clips.sh)"; continue; }
    out="$DST/$id.clip-$n.webm"
    # captured at 896×504, played at roughly a third of that – downscaled here so the tile never
    # has to, and so the file is small enough to fetch the moment the cursor lands on it
    "$FFMPEG" -y -loglevel error \
      -framerate 15 -i "$dir/%03d.png" \
      -vf "scale=640:-2:flags=lanczos" \
      -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 -pix_fmt yuv420p \
      "$out"
    echo "  $(basename "$out")  $(( $(stat -c%s "$out") / 1024 )) KB"
    made=$((made + 1))
  done
  # the still under every waiting tile is the first frame of the first clip, so the picture does not
  # jump when the clip starts – it is the same frame at a higher resolution
  if [ -f "$SRC/$id-1/000.png" ]; then
    "$FFMPEG" -y -loglevel error -i "$SRC/$id-1/000.png" -vf "scale=896:-2:flags=lanczos" -quality 82 "$DST/$id.poster.webp"
    echo "  $id.poster.webp  $(( $(stat -c%s "$DST/$id.poster.webp") / 1024 )) KB"
  fi
  echo "$id: $made clips"
done
