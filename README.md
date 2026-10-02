# RS Souls

Ein 2D-Soulslike mit Roguelike-Elementen in der Welt **Reinstrom**: langsamer, harter, fairer Kampf
(Telegraf lesen, ausweichen, parieren, zuschlagen), sechs Level vom Rosttal bis zu Doktor Asche.

Das Spiel ist im Partyverse-Monorepo entstanden (dort als ein Spiel des Hubs) und wurde am
2026-10-02 als eigenständiges Projekt herausgelöst. Es läuft ohne den Hub: `src/main.tsx` übernimmt
dessen Aufgaben (Titel, Moduswahl, Pause, Ergebnis, Sprache, Lautstärke).

- Konzept, Welt und Stand der Umsetzung: [`docs/KONZEPT-UND-STAND.md`](docs/KONZEPT-UND-STAND.md)
- Die ursprüngliche Spielidee: [`docs/UEBERGABE-SPIELKONZEPT.md`](docs/UEBERGABE-SPIELKONZEPT.md)
- Bild-Pipeline (ComfyUI): [`docs/ASSET-PIPELINE.md`](docs/ASSET-PIPELINE.md)

## Schnellstart

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
npm run dev          # http://localhost:5173
```

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver mit Hot Reload |
| `npm run build` | Produktions-Build nach `dist/` (statisch auslieferbar) |
| `npm run typecheck` | TypeScript prüfen |
| `npm run lint` | ESLint |
| `npm test` | Unit-Tests (Vitest, 69 Tests: Kern, Welt-Schaffbarkeit, Boss-Balance per Bot, Fuzz, Spielstand) |
| `npm run e2e` | Browser-Tests (Playwright; vorher einmal `npx playwright install chromium`) |

### URL-Parameter

| Parameter | Wirkung |
|---|---|
| `?mode=campaign` · `newgame` · `run` · `daily` · `training` | startet direkt in diesem Modus |
| `&humans=0&cpus=1` | der Demo-Bot spielt |
| `&seed=4` | feste Saat (Würfel-Lauf, Gegner, Effekte) |
| `&lang=de` · `en` | Sprache |
| `&heroRig=true` | Held aus dem Blender-Rig statt der gemalten Posen (in Arbeit, siehe unten) |
| sonst `key=value` | wird zur Regel, z. B. `enemyCount=3`, `slowmo=0.5`, `showBoxes=true`, `kills=3` |

Zum Debuggen hängt alles an `window.pv` (`engine`, `input`, `audio`, `save`, `route`, `game`, `paused`).
`window.pv.game.value.sim` ist die laufende Simulation.

### Steuerung (Tastatur / Gamepad)

A/D laufen · Leertaste springen · Shift rollen · E oder Linksklick schlagen (halten = Ladung) ·
C oder Rechtsklick blocken (die erste Fünftelsekunde = Parry) · Q benutzen bzw. Waffen-Fähigkeit ·
F Glut-Ampulle · R Waffe wechseln (halten = Karte) · Esc Pause. Die vollständige Tabelle steht im
Titelmenü unter „Steuerung“ und in `games/rssouls/src/index.ts`.

## Aufbau

```
src/                   der Host: Titelmenü, Pause, Ergebnis (ersetzt den Partyverse-Hub)
games/rssouls/src/
  index.ts             Metadaten: Modi, Regeln (Sandbox), Steuerung
  RsSoulsGame.ts       Verbindung von Simulation, Darstellung, Audio, HUD, Spielstand
  core/                die Simulation: deterministisch, ohne DOM und three.js, voll testbar
    sim.ts             Welt aus Räumen, Türen, Hebel, Projektile, Bosse, Ereignisse
    hero.ts enemy.ts   Held als Zustandsautomat, Gegnerhirn aus Daten
    attack.ts combat.ts body.ts progress.ts …
  data/                die Welt Reinstrom: Waffen, Gegner, Räume (42 in 6 Leveln), Völker/Klassen, Texte
  render/              three.js-Darstellung (Scene.ts), gemalte Bilder, Rig-Abspielung (heroRig.ts)
  ui/                  HUD (Preact), Karte
  ai/heroBot.ts        der Demo-Bot (Tests, Vorführung)
  assets/              Bilder (WebP), Ambiente (Ogg), Rig-Daten
packages/engine/       Spielschleife, Eingabe (Tastatur, Gamepad, Maus), Audio, Speicher, Menü …
packages/game-api/     die Schnittstelle Spiel ↔ Host (GameModule, GameContext)
public/assets/generated/  Musik (rss_*.ogg) und Kampfklänge (CC0, siehe sfx/CREDITS.md) + manifest.json
tests/  e2e/           Unit- und Browser-Tests
tools/assets/          Asset-Pipelines (Python, ComfyUI, Blender) – siehe unten
assets-source/rssouls/ Master-PNGs der gemalten Bilder (+ Prompt und Seed je Bild), das Rig
docs/                  Konzept, Stand, Pipeline
```

`packages/engine` ist die Engine des Partyverse-Monorepos, unverändert mitgenommen. Sie enthält
auch Teile, die RS Souls nicht nutzt (Online-Lockstep, Kart-Prozeduren); sie stören nicht und können
bei Bedarf entfernt werden.

### Architektur in drei Sätzen

Die **Simulation** (`core/`) läuft mit festem Zeitschritt (60 Hz), kennt weder DOM noch three.js
und ist deterministisch (gleiche Saat und Eingaben → gleicher Zustandshash); deshalb lässt sich alles
von Balance bis Schaffbarkeit der Kampagne in Vitest prüfen. Die **Darstellung** (`render/Scene.ts`)
liest den Zustand nur und schreibt nie zurück. **Daten** (`data/`) beschreiben die Welt; die
Datenprüfung (`data/validate.ts`, im Test) erzwingt Regeln wie „Telegraf nie unter 0,35 s“.

## Assets und Pipelines

Alle Pipelines laufen lokal. Python-Skripte über `tools/assets/py <skript>` (nutzt die venv
`~/.venvs/pv-assets`, Pakete in `tools/assets/requirements.txt`).

| Was | Werkzeug | Skript |
|---|---|---|
| gemalte Kulissen, Figuren, Gegner, Waffen | ComfyUI (Z-Image Turbo) + rembg | `tools/assets/gen_rssouls.py` |
| Details in vorhandenen Bildern ändern | ComfyUI (Qwen-Image-Edit 2511 + Lightning-LoRA) | `tools/assets/edit_image.py`, Workflow `workflows/qwen_edit.json` |
| Musik (8 Stücke) | ACE-Step | `tools/assets/gen_music_rssouls.sh` |
| Ambiente je Gebiet | Stable Audio Open | `tools/assets/gen_ambience_rssouls.py` |
| Kampfklänge | CC0-Bibliotheken (Kenney, OpenGameArt) | `public/assets/generated/sfx/CREDITS.md` |
| Hub-Vorschau (Poster, Clips) | Playwright + ffmpeg | `tools/assets/build_clips.sh` |
| Held als Cutout-Rig | Blender 5.2 | `tools/assets/rssouls_rig/` |

Hinweise:
- `comfyui_client.py` findet eine ComfyUI-Installation unter **Pinokio** (`pterm`); bei einer
  anderen Installation dort die URL setzen.
- `gen_music_rssouls.sh` ruft ein externes ACE-Step-Skript auf (`PV_SONG_SCRIPT`) und danach
  `encode_audio.py`. Dieses stammt aus dem Monorepo und schreibt das Manifest der *ganzen*
  Bibliothek; hier genügt es, die Ogg-Dateien nach `public/assets/generated/music/` zu legen und
  `public/assets/generated/manifest.json` zu ergänzen.
- Qwen-Image-Edit braucht in ComfyUI: `diffusion_models/qwen_image_edit_2511_fp8mixed`,
  `loras/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16`, `text_encoders/qwen_2.5_vl_7b_fp8_scaled`,
  `vae/qwen_image_vae` (alle auf Hugging Face, Comfy-Org bzw. lightx2v).

## In Arbeit: der Held als Blender-Rig

Ziel: Der Held soll echte Animationen bekommen statt vier gemalter Standbilder mit gerechneter
Bewegung. Vorlage ist die Standpose (`assets-source/rssouls/spr_hero_idle.png`), zerlegt in Teile
an einem Skelett. **Stand:** Die Pipeline läuft vollständig, die Teile sind aber noch vorläufig. Im
Spiel ist das Rig nur mit `?heroRig=true` aktiv (bzw. „Held als Rig (Probe)“ in den
Trainingsregeln); Vorgabe bleiben die gemalten Posen.

```bash
tools/assets/py tools/assets/rssouls_rig/make_variants.py --seeds 1,2,3   # Qwen: Figur ohne Arme / ohne Mantelschoß
tools/assets/py tools/assets/rssouls_rig/make_variants.py --pick A=2,B=1  # die besten wählen
tools/assets/py tools/assets/rssouls_rig/cut_parts.py --preview /tmp/p.png # Teile schneiden → assets-source/rssouls/rig/parts
<blender>/blender -b -P tools/assets/rssouls_rig/rig_blender.py -- assets-source/rssouls/rig   # Rig bauen, 18 Aktionen rendern
tools/assets/py tools/assets/rssouls_rig/preview.py /tmp/sheet.png hieb1 run   # Kontaktbogen mit Schwert
tools/assets/py tools/assets/rssouls_rig/pack.py                              # Streifen + hero.json ins Spiel
```

- `hero_spec.py`: Knochen (Gelenkpunkte in Pixeln der Vorlage) und Teile.
- `actions_hero.py`: die Animationen als Keyframes. Winkel in Grad, positiv gegen den Uhrzeigersinn;
  die Klinge wird absolut angegeben (`BLADE`), der Griffknochen daraus berechnet.
- `assets-source/rssouls/rig/hero_rig.blend`: das Rig mit allen Aktionen zum Bearbeiten in Blender
  (Vorderansicht, Knochen wählen, `R`). Ein Referenzschwert hängt am Griff, wird aber nicht gerendert.
- Je Aktion entstehen zwei Streifen: der Körper und die Schwertfaust allein. Im Spiel liegt die Faust
  über der Waffe, so umschließt sie den Griff. Griffpunkt und Klingenwinkel stehen je Bild in
  `games/rssouls/src/assets/rig/hero.json`.

**Offen am Rig:**
1. Die Qwen-Varianten A (ohne Arme) und B (ohne Mantelschoß) erzeugen, auswählen und neu schneiden.
   Erst damit verschwinden der Abdruck der Arme auf dem Mantel und die fehlenden Oberschenkel.
2. Die Posen nachschärfen, vor allem Rasten, Tod, Rolle und den Gegenschlag von unten.
3. Danach `heroRig` zur Vorgabe machen.

## Weitere offene Punkte

- Gamepad nur mit der Tastatur-Abbildung getestet, nicht an einem echten Controller.
- Balancing nur per Demo-Bot, nicht mit Spielern.
- Ruß-Kriecher und Sensor-Drohne haben keine Ausholpose.
- Eigennamen (Bosse, Orte, „Glut“) bleiben in der englischen Fassung bewusst deutsch.
- Die offenen Fragen der Übergabe stehen in `docs/KONZEPT-UND-STAND.md`, Abschnitt 13.

## Herkunft und Rechte

Code: aus dem Partyverse-Projekt übernommen. Bilder, Musik und Ambiente sind lokal mit offenen
Modellen erzeugt (Z-Image Turbo, Qwen-Image-Edit, ACE-Step, Stable Audio Open). Die Kampfklänge
stehen unter CC0 1.0 (Herkunft in `public/assets/generated/sfx/CREDITS.md`).
