# 04 – Asset-Pipeline mit ComfyUI

Grundsatz: **Die GPU arbeitet im Hintergrund, das Spiel wartet nie.** Alles Sichtbare hat einen Code-Platzhalter, der `AssetManager` tauscht ihn aus, sobald eine generierte Datei existiert.

## Art Direction – „Toy-Diorama"
- Knuffige Chibi-Figuren (großer Kopf, kurze Beine), Karts wie Spielzeugautos, Strecken als Spielzeuginseln auf blauem Meer / Wiesenteppich / Lavabecken.
- Kräftige Flächenfarben, weiche Formen, `MeshToonMaterial` mit 3-Stufen-Gradient + dunkle Outline (Inverted Hull). Keine PBR-Details nötig.
- Warum: Hunyuan3D liefert organische, **untexturierte** Meshes. Toon-Shading, flache Farben und Frontprojektion des Konzeptbilds kaschieren fehlende Texturdetails. Figuren ohne Rig: im Kart sitzen sie starr (Lean/Tilt per Tween), im Party-Spiel hüpfen sie (Squash&Stretch).

### Figuren: Farbe + Kopf (Stand 2026-09-04)
Die Spielfiguren sind farbige Platzhalter-Männchen mit **wechselbarem Kopf**. Köpfe sind das ideale Format für Bild-zu-3D (kompakt, frontal lesbar) und kosten je ~15 min GPU. Liste in `packages/engine/src/data/heads.ts`, Manifest-Items `head-*` (Höhe ~0,6, Octree 192, max. 6k Tris). Die ursprüngliche Charakterbibel bleibt als Idee für spätere Vollfiguren erhalten:

### Charakterbibel (8 Fahrer, eigenes Universum, zurückgestellt)
| ID | Name | Idee | Farbe |
|---|---|---|---|
| pip | Pip | kleiner Fuchs mit Fliegerbrille, flink | orange |
| bolla | Bolla | runde Kugelfisch-Dame, gemütlich, schwer | blau |
| grummel | Grummel | mürrischer Steintroll, sehr schwer | grau/grün |
| lumi | Lumi | Glühwürmchen-Fee, leicht, leuchtet | gelb |
| kaptn | Käpt'n Krabbe | Krabbe mit Kapitänsmütze, Allrounder | rot |
| zisch | Zisch | Raketen-Roboter, schnell, wackelig | silber/cyan |
| mo | Mo | Pilz-Kind mit riesigem Hut, Allrounder | violett |
| tante-ruth | Tante Ruth | Schildkröten-Oma mit Handtasche, schwer, gutmütig | grün/rosa |

## Werkzeuge
- venv unter `~/.venvs/pv-assets` (auf /mnt/c schlägt `python -m venv` fehl; Aufruf über `tools/assets/py <script>`), Python 3.12: `requests`, `rembg[cpu]`, `trimesh`, `fast-simplification`, `pillow`, `numpy`.
- `tools/assets/comfyui_client.py`: Kopie aus `Desktop/Songs/scripts/` – `ensure_comfyui()` löst die URL aus WSL auf (pterm) und startet ComfyUI bei Bedarf.
- `tools/assets/workflows/*.json`: ComfyUI-**API**-Graphen (Prompt-Format): `zimage.json`, `flux_schnell.json`, `sdxl.json`, `hunyuan3d.json`, `upscale.json`.
- `npx @gltf-transform/cli optimize --compress draco` für die finalen GLBs.

## Manifest (`tools/assets/manifest.json`)
```json
{
  "style": "3D render, toy figurine, soft studio light, clean white background, single subject, centered, vibrant flat colors, chibi proportions",
  "negative": "text, watermark, blurry, multiple subjects, cropped, realistic skin, photo",
  "items": [
    {"id":"driver-pip","kind":"character","prompt":"small orange fox wearing aviator goggles, standing, front view","out":"characters/pip","mesh":true},
    {"id":"kart-flitzer","kind":"kart","prompt":"tiny toy race kart, low, sleek, red and white","out":"karts/flitzer","mesh":true},
    {"id":"prop-palm","kind":"prop","prompt":"stylized palm tree","out":"props/palm","mesh":true,"tris":3000},
    {"id":"tex-sand","kind":"texture","prompt":"seamless tileable sand texture, top-down, flat lighting","out":"textures/sand","size":1024},
    {"id":"ui-logo","kind":"ui","prompt":"game logo lettering 'PARTYVERSE', bubbly 3D letters, colorful","out":"ui/logo","upscale":true},
    {"id":"music-beach","kind":"music","prompt":"upbeat tropical steel drums, ukulele, 128 bpm, instrumental","out":"music/beach","duration":120}
  ]
}
```
Ausgabe je Item unter `public/assets/generated/<out>.{png|glb|ogg}` + `<out>.meta.json` (Prompt-Hash, Seed, Zeit, Modell). Fertige Ausgaben mit gleichem Hash werden übersprungen (resumable). `--force` erzwingt Neugenerierung, `--only <id|prefix>` filtert, `--dry-run` listet.

## Ablauf pro Typ
1. **Bild** (`gen_images.py`): Standard Z-Image Turbo (8 Steps, 1024², cfg 1), Fallback Flux Schnell (4 Steps) oder SDXL Juggernaut (Texturen). 10–20 s/Bild auf der A4000.
2. **Freistellen** (`rembg`, CPU, ~2 s) → RGBA-PNG, auf 1024² gepolstert.
3. **Mesh** (`gen_3d.py`, gemessen: **~10–15 min pro Mesh** auf der A4000 inkl. Modell-Laden und Octree-Decode – deutlich langsamer als geschätzt; Octree 192 für Props spart Zeit): API-Graph nach dem vorhandenen Workflow `3d_hunyuan3d_image_to_model.json`: `ImageOnlyCheckpointLoader(hunyuan3d-dit-v2_fp16)` → `CLIPVisionEncode` → `Hunyuan3Dv2Conditioning` → `EmptyLatentHunyuan3Dv2(3072)` → `ModelSamplingAuraFlow(1.0)` → `KSampler(20, cfg 8, euler)` → `VAEDecodeHunyuan3D(8000, 256)` → `VoxelToMesh(surface net, 0.6)` → `SaveGLB`. 60–120 s/Mesh. Ausgabe liegt im ComfyUI-Output-Ordner, wird per `/view` heruntergeladen.
4. **Nachbearbeitung** (`post3d.py`, trimesh): größte Komponente behalten, zentrieren, Y-up, Höhe normieren (Figur 1,0; Kart 0,8; Props je Manifest), dezimieren (`fast-simplification`: Figur ≤ 12k, Kart ≤ 8k, Prop ≤ 4k Tris), Normalen glätten, **planare Frontprojektion**: UV = (x,y) der Vorderansicht, Textur = freigestelltes Konzeptbild (Rückseite gespiegelt, Ränder per Dilation gefüllt) – Alternative bei schlechtem Ergebnis: Flächenfarbe aus dominanter Farbe. Export GLB → `gltf-transform optimize`.
5. ~~**Texturen** (`post_texture.py`): Kachelbarkeit per Offset-Blend prüfen/erzwingen, 1024² → Mipmaps im Spiel.~~ **Entfallen:**
   Bodentexturen kommen prozedural aus `procedural/ground.ts` (siehe 07-LOOK.md); die `kind:"texture"`-Jobs sind aus dem Manifest gestrichen.
6. **Skies**: kein Equirect; Farbverlauf (Shader) + generierte Wolken-/Sonnen-Sprites als Billboards.
7. **UI**: Logo, Item-Icons, Strecken-Thumbnails, Figuren-Porträts (aus den Konzeptbildern zugeschnitten), RealESRGAN-Upscale nur hier.
8. **Musik**: `Desktop/Songs/scripts/generate_song.py` mit instrumentalen Prompts (ACE-Step 1.5), 90–120 s, Loop-Punkt manuell notiert. **SFX**: ZzFX-Parameter im Code, keine GPU.

## Zeit- und Ressourcenbudget
- VRAM 16 GB: Flux fp8 (17 GB Datei) und Z-Image (12 GB + 7,5 GB Encoder) laufen mit ComfyUI-Offloading in 31 GB RAM. Hunyuan3D ~6–8 GB. ACE-Step ~8 GB. Die ComfyUI-Queue verarbeitet seriell, nie parallel starten.
- Erste Vollbatch Kart: 8 Figuren + 3 Karts + 25 Props = 36 Konzepte (~10 min) + 36 Meshes (~50 min) + 15 Texturen + 25 UI-Bilder (~10 min) + 5 Songs (~15 min) ≈ **1,5–2 h**.
- `run_all.py` läuft im Hintergrund (Log `tools/assets/logs/run-<datum>.log`, Fortschritt `tools/assets/progress.json`), kann jederzeit abgebrochen und fortgesetzt werden.

## Spike (P4) – Entscheidungskriterium
Ein Fahrer (Pip) komplett durch die Pipeline. Bewertung im Spiel mit Toon-Material:
- Silhouette gut, Frontprojektion akzeptabel → Pipeline wie oben.
- Silhouette gut, Textur unbrauchbar → **TRELLIS** (texturierte GLBs) anfordern, siehe 05-MODELS.
- Silhouette schlecht → Multi-View (Flux Kontext Turnarounds → `Hunyuan3Dv2ConditioningMultiView`) und/oder CC0-Hybrid (Kenney/Quaternius) für Figuren, ComfyUI nur für Texturen/UI/Props.

## Qualitätssicherung
- Jede generierte Datei bekommt eine Vorschau in `tools/assets/review/index.html` (Kontaktbogen), um Ausreißer schnell neu zu würfeln (`--force --only <id>` mit neuem Seed).
- Prompt-Konsistenz: Style-String + Negative kommen aus dem Manifest-Kopf, Item-Prompts beschreiben nur das Motiv.
