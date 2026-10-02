#!/usr/bin/env bash
# Music for „RS Souls“ with the ACE-Step pipeline (projekte/Songs/scripts), like gen_music_anschluss.sh.
# Masters → assets-source/generated/music/, encode_audio.py writes the Ogg and the manifest; the game
# plays them with `audio.musicNamed('rss_<area>')` (see RsSoulsGame.music()).
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/assets-source/generated/music"
mkdir -p "$OUT"
SCRIPT="${PV_SONG_SCRIPT:-/mnt/c/Users/Home/Desktop/projekte/Songs/scripts/generate_song.py}"
PY="${PV_ASSETS_VENV:-$HOME/.venvs/pv-assets}/bin/python"
render() { # name tags bpm key
  local name="$1" tags="$2" bpm="$3" key="$4"
  if ls "$OUT/$name".mp3 >/dev/null 2>&1; then echo "skip $name"; return; fi
  echo "[music] $name"
  "$PY" "$SCRIPT" --title "$name" --tags "$tags" --lyrics "[inst]" --bpm "$bpm" --key "$key" --duration 120 --language en --outdir "$OUT" --quality 320k || echo "FAIL $name"
  # the song script writes the title with hyphens (rss-rosttal): match both spellings
  f=$(ls -t "$OUT" | grep -iE "${name//_/[-_]}.*[.](mp3|ogg|wav|flac)\$" | head -1)
  [ -n "$f" ] && ext="${f##*.}" && [ "$f" != "$name.$ext" ] && mv "$OUT/$f" "$OUT/$name.$ext"
  [ -n "$f" ] && [ -f "$OUT/${f%.*}.json" ] && mv "$OUT/${f%.*}.json" "$OUT/$name.json"
}
render rss_rosttal "dark ambient industrial, slow and bleak, distant metallic clangs, droning cello, sparse sad piano, dust and smog, dark fantasy soulslike exploration, seamless loop, instrumental, 70 bpm, D minor" 70 "D minor"
render rss_rohr "dark industrial ambient, dripping pipes, hissing steam, low pulsing synth drone, muted percussion of metal, uneasy, labyrinth, soulslike exploration, seamless loop, instrumental, 80 bpm, C minor" 80 "C minor"
render rss_ader "ominous dark ambient, deep choir drone, black oil, dead forest, sub bass rumble, eerie bowed metal, dread, soulslike, seamless loop, instrumental, 60 bpm, B minor" 60 "B minor"
render rss_wald "gentle melancholic ambient, quiet ancient forest, soft harp and flute, warm strings, hopeful light through leaves, peaceful sanctuary, seamless loop, instrumental, 72 bpm, G major" 72 "G major"
render rss_stadt "cold oppressive electronic ambient, glass city, pulsing analog synth arpeggio, distant sirens, propaganda, tense, soulslike, seamless loop, instrumental, 96 bpm, F minor" 96 "F minor"
render rss_labor "sterile clinical dark ambient, ticking machines, cold piano, glassy textures, heartbeat bass, creeping dread, seamless loop, instrumental, 76 bpm, E minor" 76 "E minor"
render rss_boss "epic dark fantasy boss battle, heavy industrial percussion, pounding taiko and anvils, aggressive cello ostinato, brass stabs, choir, soulslike boss fight, intense, instrumental, 140 bpm, D minor" 140 "D minor"
render rss_finale "tragic epic final boss battle, full orchestra and choir, driving strings, heavy drums, a sad piano theme woven in, ember and ash, soulslike final boss, instrumental, 132 bpm, C minor" 132 "C minor"
"$PY" "$ROOT/tools/assets/encode_audio.py"
echo "music done"
