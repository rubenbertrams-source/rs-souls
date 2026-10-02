"""Bilder für „RS Souls" (games/rssouls) mit ComfyUI erzeugen.

Gemalte Parallax-Ebenen je Gebiet (Theme): eine ferne Kulisse (opak) und ein mittlerer
Silhouetten-Streifen (freigestellt). Figuren und Gegner bleiben bewusst flache Formen – die
Lesbarkeit des Kampfes geht vor (UEBERGABE §9: Silhouette, Kontrast, dunkles Inneres).

Master als PNG in `assets-source/rssouls/`, Auslieferung als WebP in `games/rssouls/src/assets/img/`.

  tools/assets/py tools/assets/gen_rssouls.py                 # fehlende erzeugen
  tools/assets/py tools/assets/gen_rssouls.py --only far_     # nur ferne Ebenen
  tools/assets/py tools/assets/gen_rssouls.py --force --only far_rosttal --seed 12
  tools/assets/py tools/assets/gen_rssouls.py --reexport      # nur WebP neu aus den Mastern
"""
import argparse
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)

MASTER = os.path.join(ROOT, "assets-source", "rssouls")
OUT = os.path.join(ROOT, "games", "rssouls", "src", "assets", "img")

STYLE = (
    "dark fantasy industrial wasteland, grimdark, hand painted matte painting, muted desaturated palette of rust brown, "
    "soot black and sickly smog yellow, heavy atmospheric haze, painterly brush strokes, moody, no people, no characters, no text"
)
FAR = f"2D side scrolling video game parallax background, far layer, wide horizontal panorama, straight-on side view, {STYLE}"
MID = f"2D side scrolling video game parallax middle layer, a horizontal strip of dark silhouettes, straight-on side view, {STYLE}, isolated on plain white background"

SPR = (
    "2D side scrolling action game character sprite, strict side view facing right, full body, standing in a ready pose, "
    "dark fantasy industrial, hand painted with clean dark outlines, strong readable silhouette, muted palette, "
    "single character, centered, plain white background, no scenery, no text"
)

ITEMS = [
    # --- ferne Kulissen, opak -------------------------------------------------------------------
    {"id": "far_rosttal", "kind": "bg", "size": (1792, 768), "max": 1792,
     "prompt": f"a slum of stacked corrugated iron shacks and rusty water towers under a low smog sky, a distant glass megacity glowing faintly on the horizon, {FAR}"},
    {"id": "far_rohr", "kind": "bg", "size": (1792, 768), "max": 1792,
     "prompt": f"a labyrinth district of enormous rusted pipes, valves and chimneys venting smog, catwalks between them, dim yellow lamps, {FAR}"},
    {"id": "far_unter", "kind": "bg", "size": (1792, 768), "max": 1792,
     "prompt": f"underground sewer tunnels of huge dripping pipes in near darkness, oily water reflections, a few faint lamps, {FAR}, very dark"},
    {"id": "far_pumpe", "kind": "bg", "size": (1792, 768), "max": 1792,
     "prompt": f"interior of a vast industrial pumping station hall, giant pistons and turbines, cold blue grey light from high windows, steam, {FAR}"},
    {"id": "far_ader", "kind": "bg", "size": (1792, 768), "max": 1792,
     "prompt": f"a dead petrified forest around a black oil pool that reflects nothing, two tall sensor masts with yellow warning lights, black veins in the ground, {FAR}, very dark"},
    {"id": "far_wald", "kind": "bg", "size": (1792, 768), "max": 1792,
     "prompt": "2D side scrolling video game parallax background, far layer, wide horizontal panorama, straight-on side view, a quiet ancient forest of tall pale trees with soft green pure light falling through the canopy, glowing green motes, ferns and moss, hand painted matte painting, painterly, serene but melancholic, muted greens, no people, no characters, no text"},
    {"id": "far_schanze", "kind": "bg", "size": (1792, 768), "max": 1792,
     "prompt": f"a fortified concrete border checkpoint with watchtowers, barriers, searchlights and barbed wire under a smoky sky, the glowing glass city behind it, {FAR}"},
    {"id": "far_stadt", "kind": "bg", "size": (1792, 768), "max": 1792,
     "prompt": "2D side scrolling video game parallax background, far layer, wide horizontal panorama, straight-on side view, a gleaming futuristic glass megacity at night, towers of glass and light, cold cyan glow, propaganda screens, oppressive order, smog yellow haze at the bottom, hand painted matte painting, painterly, no people, no characters, no text"},
    {"id": "far_labor", "kind": "bg", "size": (1792, 768), "max": 1792,
     "prompt": f"a sterile underground laboratory hall with glass specimen pods, cables, operating lamps and a glowing orange furnace core, {FAR}, cold white and ember orange light"},
    # --- mittlere Silhouetten, freigestellt -------------------------------------------------------
    {"id": "mid_rosttal", "kind": "cut", "size": (1792, 640), "max": 1792,
     "prompt": f"silhouettes of ramshackle shacks, antennas, laundry lines and scrap heaps, {MID}"},
    {"id": "mid_rohr", "kind": "cut", "size": (1792, 640), "max": 1792,
     "prompt": f"silhouettes of tangled pipes, valves, ladders and cables, {MID}"},
    {"id": "mid_pumpe", "kind": "cut", "size": (1792, 640), "max": 1792,
     "prompt": f"silhouettes of heavy industrial machinery, gears, pistons and girders, {MID}"},
    # --- Kacheln für Böden und Blöcke (opak, nahtlos) ----------------------------------------------
    {"id": "tile_rosttal", "kind": "bg", "size": (512, 512), "max": 256,
     "prompt": "seamless tileable texture, flat front view of rusted corrugated iron sheets and riveted scrap metal plates, dark, grimy, hand painted, even lighting, game texture"},
    {"id": "tile_rohr", "kind": "bg", "size": (512, 512), "max": 256,
     "prompt": "seamless tileable texture, flat front view of grimy green grey industrial metal grating and bolted plates, hand painted, even lighting, game texture"},
    {"id": "tile_ader", "kind": "bg", "size": (512, 512), "max": 256,
     "prompt": "seamless tileable texture, flat front view of black cracked petrified earth with thin oily black veins, hand painted, even lighting, game texture"},
    {"id": "tile_wald", "kind": "bg", "size": (512, 512), "max": 256,
     "prompt": "seamless tileable texture, flat front view of mossy dark forest soil with roots and small stones, hand painted, even lighting, game texture"},
    {"id": "tile_stadt", "kind": "bg", "size": (512, 512), "max": 256,
     "prompt": "seamless tileable texture, flat front view of clean dark polished concrete and steel panels with thin cyan light seams, hand painted, even lighting, game texture"},
    {"id": "tile_labor", "kind": "bg", "size": (512, 512), "max": 256,
     "prompt": "seamless tileable texture, flat front view of sterile white grey laboratory wall tiles, slightly stained, hand painted, even lighting, game texture"},
    # --- Waffen (freigestellt, waagerecht, Griff links) -------------------------------------------
    {"id": "wpn_rost-klinge", "kind": "cut", "size": (1024, 512), "max": 256,
     "prompt": "a crude rusty sword made of scrap metal with a wrapped leather grip, lying perfectly horizontal, handle on the left and tip pointing right, side view, 2D game item, hand painted with clean dark outlines, isolated on plain white background, no text"},
    {"id": "wpn_verwerter-hammer", "kind": "cut", "size": (1024, 512), "max": 256,
     "prompt": "a massive industrial sledgehammer with a steel head with yellow black hazard stripes on a long iron handle, lying perfectly horizontal, handle on the left and hammer head on the right, side view, 2D game item, hand painted with clean dark outlines, isolated on plain white background, no text"},
    {"id": "wpn_lumen-dolch", "kind": "cut", "size": (1024, 512), "max": 192,
     "prompt": "a slim dagger with a faintly glowing pale blade and brass guard, lying perfectly horizontal, handle on the left and tip pointing right, side view, 2D game item, hand painted with clean dark outlines, isolated on plain white background, no text"},
    # --- Figuren (freigestellt, Fußlinie = Unterkante) ----------------------------------------------
    {"id": "spr_hero", "kind": "cut", "size": (768, 1024), "max": 512,
     "prompt": f"a nameless lean survivor in a tattered long grey coat, hood and soot-stained scarf over the face, small brass goggles, leather boots, empty hands, {SPR}"},
    {"id": "spr_hero_idle", "kind": "cut", "size": (768, 1024), "max": 512,
     "prompt": "2D side scrolling action game character sprite, strict side view facing right, a nameless lean survivor in a tattered long grey coat, hood and soot-stained scarf over the face, small brass goggles, leather boots, belt with brass buckle, standing upright in a calm ready stance, arms slightly forward, empty hands, dark fantasy industrial, hand painted with clean dark outlines, strong readable silhouette, muted palette, single character, centered, plain white background, no scenery, no text"},
    {"id": "spr_hero_run", "kind": "cut", "size": (1024, 1024), "max": 512,
     "prompt": "2D side scrolling action game character sprite, strict side view facing right, a nameless lean survivor in a tattered long grey coat, hood and soot-stained scarf over the face, small brass goggles, leather boots, belt with brass buckle, running mid stride with long steps, coat flowing behind, leaning forward, empty hands, dark fantasy industrial, hand painted with clean dark outlines, strong readable silhouette, muted palette, single character, centered, plain white background, no scenery, no text"},
    {"id": "spr_hero_attack", "kind": "cut", "size": (1024, 1024), "max": 512,
     "prompt": "2D side scrolling action game character sprite, strict side view facing right, a nameless lean survivor in a tattered long grey coat, hood and soot-stained scarf over the face, small brass goggles, leather boots, lunging forward in a deep fencing stance with the right arm thrust forward, empty hands, dark fantasy industrial, hand painted with clean dark outlines, strong readable silhouette, muted palette, single character, centered, plain white background, no scenery, no text"},
    {"id": "spr_hero_block", "kind": "cut", "size": (768, 1024), "max": 512,
     "prompt": "2D side scrolling action game character sprite, strict side view facing right, a nameless lean survivor in a tattered long grey coat, hood and soot-stained scarf over the face, small brass goggles, leather boots, crouched defensive guard stance with both forearms raised in front of the face, empty hands, dark fantasy industrial, hand painted with clean dark outlines, strong readable silhouette, muted palette, single character, centered, plain white background, no scenery, no text"},
    {"id": "spr_verwerter-konstrukt_tell", "kind": "cut", "size": (768, 1024), "max": 640,
     "prompt": f"an enormous industrial processing construct robot, grey steel with smog yellow hazard stripes, a glowing orange core in the chest, raising its giant hammer arm high above its head ready to smash down, side view facing right, {SPR}"},
    {"id": "spr_kommandantin-riss_tell", "kind": "cut", "size": (1024, 1024), "max": 512,
     "prompt": f"a stern female military commander in a long black officer coat with smog yellow insignia, drawing her short sabre back for a lunging thrust, deep stance, side view facing right, {SPR}"},
    {"id": "spr_doktor-asche_tell", "kind": "cut", "size": (768, 1024), "max": 512,
     "prompt": f"a composed female scientist in a long white lab coat, grey hair tied back, round spectacles, raising her ember orange glowing gauntlet high with fire gathering in her palm, side view facing right, {SPR}"},
    {"id": "spr_schrott-drohne_tell", "kind": "cut", "size": (1024, 1024), "max": 512,
     "prompt": f"a bulky walking scrap drone robot on two short legs, welded metal plates, one orange lamp eye, raising its heavy arm high overhead to smash down, side view facing right, {SPR}"},
    {"id": "spr_schildtraeger_tell", "kind": "cut", "size": (1024, 1024), "max": 512,
     "prompt": f"a hulking slum warrior with a huge riveted scrap metal shield, rusted helmet, lunging forward ramming with the shield, side view facing right, {SPR}"},
    {"id": "spr_nebelwerk-wache_tell", "kind": "cut", "size": (1024, 1024), "max": 512,
     "prompt": f"a corporate security guard in black armour with smog yellow stripes, gas mask helmet with yellow visor, drawing a baton back for a strike, side view facing right, {SPR}"},
    {"id": "spr_garde_tell", "kind": "cut", "size": (1024, 1024), "max": 512,
     "prompt": f"an elite corporate city guard in polished black plate armour with smog yellow trim, closed helmet with cyan visor slit, sabre raised high for a slash, tower shield, side view facing right, {SPR}"},
    {"id": "spr_vorarbeiter_tell", "kind": "cut", "size": (1024, 1024), "max": 512,
     "prompt": f"a burly factory foreman in a leather apron and welding goggles, swinging a huge sledgehammer high over his head, side view facing right, {SPR}"},
    {"id": "spr_assistent_tell", "kind": "cut", "size": (1024, 1024), "max": 512,
     "prompt": f"a gaunt pale laboratory assistant man in a stained grey white coat and surgical mask, lunging forward stabbing with a thin scalpel, feet visible, floating on pure white, no floor, no ground line, no shadow, side view facing right, {SPR}"},
    {"id": "spr_riot-kommandeur_tell", "kind": "cut", "size": (1024, 1024), "max": 512,
     "prompt": f"a riot police commander in heavy black armour with red warning lights, gas mask helmet, raising a shock baton crackling with electricity, side view facing right, {SPR}"},
    {"id": "spr_schrott-golem_tell", "kind": "cut", "size": (1024, 1024), "max": 640,
     "prompt": f"a massive golem built from scrap metal, car parts and pipes, glowing orange furnace chest, raising both huge fists above its head, side view facing right, {SPR}"},
    {"id": "spr_sezier-golem_tell", "kind": "cut", "size": (1024, 1024), "max": 640,
     "prompt": f"a tall surgical dissection golem robot of white steel and glass, many thin arms ending in scalpels spread wide ready to strike, a cyan lens eye, side view facing right, {SPR}"},
    {"id": "spr_schwarzkittel_tell", "kind": "cut", "size": (1024, 1024), "max": 640,
     "prompt": f"a towering emergency response construct robot in a long black armoured coat, cables trailing, crouching ready to dash forward, cyan electric arcs, side view facing right, {SPR}"},
    {"id": "spr_schlund-waechter_tell", "kind": "cut", "size": (1024, 1024), "max": 640,
     "prompt": f"a towering petrified guardian made of black stone and oily veins with violet glowing cracks, raising a massive stone fist, side view facing right, {SPR}"},
    {"id": "spr_exponat_tell", "kind": "cut", "size": (1024, 1024), "max": 512,
     "prompt": f"a gaunt shadow creature, a failed experiment with violet glowing veins and long claws, lunging forward with claws outstretched, feet visible, floating on pure white, no floor, no ground line, no shadow, side view facing right, {SPR}"},
    {"id": "spr_rost-spinner_tell", "kind": "cut", "size": (1024, 768), "max": 512,
     "prompt": f"a mechanical spider construct made of rusted scrap metal, four jointed legs, one glowing yellow eye, rearing up on its back legs with front legs raised ready to bite, feet visible, floating on pure white, no floor, no ground line, no shadow, side view facing right, {SPR}"},
    {"id": "spr_ratte_tell", "kind": "cut", "size": (1024, 768), "max": 320,
     "prompt": f"a mangy sewer rat with patches of rust coloured fur and red eyes, crouched low and baring its teeth ready to pounce, feet visible, floating on pure white, no floor, no ground line, no shadow, side view facing right, {SPR}"},
    {"id": "spr_rohr-kriecher_tell", "kind": "cut", "size": (1024, 768), "max": 320,
     "prompt": f"a slimy grey-green pipe crawler creature like a giant isopod with many small legs, coiled up ready to spring forward, feet visible, floating on pure white, no floor, no ground line, no shadow, side view facing right, {SPR}"},
    {"id": "spr_teerbinder_tell", "kind": "cut", "size": (1024, 768), "max": 512,
     "prompt": f"a hunched blob creature made of dripping black tar and oil with a pale glowing face, rearing back with its mouth wide open ready to spit, feet visible, floating on pure white, no floor, no ground line, no shadow, side view facing right, {SPR}"},
    {"id": "spr_glut-wild_tell", "kind": "cut", "size": (1024, 768), "max": 512,
     "prompt": f"a feral boar-like beast with cracked charred skin glowing with embers from inside, head lowered charging with its burning horn forward, feet visible, floating on pure white, no floor, no ground line, no shadow, side view facing right, {SPR}"},
    # --- Figuren der Geschichte und Dinge der Welt -----------------------------------------------
    {"id": "npc_yara", "kind": "cut", "size": (768, 1024), "max": 384,
     "prompt": f"Yara Rostherz, a tough young resistance leader with rust red hair in a braid, patched leather jacket, a wrench on her belt, arms crossed, side view facing left, {SPR}"},
    {"id": "npc_vex", "kind": "cut", "size": (768, 1024), "max": 384,
     "prompt": f"Vex, a lanky former corporate technician with a cracked visor pushed up on his forehead, oil stained overalls with a torn yellow corporate patch, holding a soldering tool, side view facing left, {SPR}"},
    {"id": "npc_brina", "kind": "cut", "size": (768, 1024), "max": 320,
     "prompt": f"Brina, a short stocky dwarf woman smuggler with a big satchel full of papers and a wide brimmed hat, sly grin, side view facing left, {SPR}"},
    {"id": "npc_juno", "kind": "cut", "size": (768, 1024), "max": 384,
     "prompt": f"Juno Lichtborn, a young techmage with short pale hair and a long green-lined coat, holding a small glowing green rune core in his hands, side view facing left, {SPR}"},
    {"id": "npc_korro", "kind": "cut", "size": (1024, 1024), "max": 192,
     "prompt": "a small broken hovering robot drone with one cracked lens and a softly glowing green energy cell in its body, patched together, cute but battered, 2D game sprite, side view facing right, hand painted with clean dark outlines, single object, centered, plain white background, no text"},
    {"id": "obj_kollektor", "kind": "cut", "size": (768, 1024), "max": 384,
     "prompt": "a makeshift light collector device built from scrap metal, a tall pole with solar panels and a glass globe holding a glowing green pure light, cables, 2D game prop, front view, hand painted with clean dark outlines, single object, centered, plain white background, no text"},
    {"id": "obj_glutzelle", "kind": "cut", "size": (1024, 1024), "max": 128,
     "prompt": "a small glowing battery cell with bright green pure light inside a cracked glass tube with brass caps, 2D game item icon, hand painted with clean dark outlines, single object, centered, plain white background, no text"},
    {"id": "obj_ampulle", "kind": "cut", "size": (1024, 1024), "max": 128,
     "prompt": "a small glass vial shard filled with glowing warm orange ember liquid, brass cap, 2D game item icon, hand painted with clean dark outlines, single object, centered, plain white background, no text"},
    {"id": "obj_schlacke", "kind": "cut", "size": (1024, 1024), "max": 128,
     "prompt": "a lump of dark metal slag with glowing orange cracks, 2D game item icon, hand painted with clean dark outlines, single object, centered, plain white background, no text"},
    {"id": "spr_rost-spinner", "kind": "cut", "size": (1024, 768), "max": 512,
     "prompt": f"a mechanical spider construct made of rusted scrap metal, four jointed legs, one glowing yellow eye, low and wide, {SPR}"},
    {"id": "spr_ratte", "kind": "cut", "size": (1024, 768), "max": 384,
     "prompt": f"a mangy sewer rat with patches of rust coloured fur and red eyes, low to the ground, {SPR}"},
    {"id": "spr_schrott-drohne", "kind": "cut", "size": (768, 1024), "max": 512,
     "prompt": f"a bulky walking scrap drone robot on two short legs, welded metal plates, one orange lamp eye, a heavy arm, {SPR}"},
    {"id": "spr_schildtraeger", "kind": "cut", "size": (768, 1024), "max": 512,
     "prompt": f"a hulking slum warrior holding a huge riveted scrap metal shield in front, rusted helmet, {SPR}"},
    {"id": "spr_rohr-kriecher", "kind": "cut", "size": (1024, 768), "max": 384,
     "prompt": f"a slimy grey-green pipe crawler creature like a giant isopod with many small legs, {SPR}"},
    {"id": "spr_nebelwerk-wache", "kind": "cut", "size": (768, 1024), "max": 512,
     "prompt": f"a corporate security guard in black armour with smog yellow stripes, gas mask helmet with yellow visor, holding a baton, {SPR}"},
    {"id": "spr_teerbinder", "kind": "cut", "size": (1024, 1024), "max": 512,
     "prompt": f"a hunched blob creature made of dripping black tar and oil, a pale glowing face, {SPR}"},
    {"id": "spr_schrott-golem", "kind": "cut", "size": (768, 1024), "max": 640,
     "prompt": f"a massive golem built from scrap metal, car parts and pipes, glowing orange furnace chest, huge fists, {SPR}"},
    {"id": "spr_verwerter-konstrukt", "kind": "cut", "size": (768, 1024), "max": 640,
     "prompt": f"an enormous industrial processing construct robot, grey steel with smog yellow hazard stripes, a glowing orange core in the chest, one arm is a giant hammer, {SPR}"},
    {"id": "spr_russ-kriecher", "kind": "cut", "size": (1024, 768), "max": 384,
     "prompt": f"a soot black crawling creature made of ash and smoke with burning orange eyes, low and spiky, {SPR}"},
    {"id": "spr_glut-wild", "kind": "cut", "size": (1024, 768), "max": 512,
     "prompt": f"a feral boar-like beast with cracked charred skin glowing with embers from inside, one burning horn, {SPR}"},
    {"id": "spr_sensor-drohne", "kind": "cut", "size": (1024, 768), "max": 320,
     "prompt": f"a small hovering surveillance drone with a single cyan lens and yellow black warning stripes, rotor blades, {SPR}"},
    {"id": "spr_kommandantin-riss", "kind": "cut", "size": (768, 1024), "max": 512,
     "prompt": f"a stern female military commander in a long black officer coat with smog yellow insignia, short sabre in hand and a pistol at the belt, gas mask hanging at the neck, {SPR}"},
    {"id": "spr_schlund-waechter", "kind": "cut", "size": (768, 1024), "max": 640,
     "prompt": f"a towering petrified guardian made of black stone and oily veins with violet glowing cracks, {SPR}"},
    {"id": "spr_garde", "kind": "cut", "size": (768, 1024), "max": 512,
     "prompt": f"an elite corporate city guard in polished black plate armour with smog yellow trim, closed helmet with cyan visor slit, sabre and a tower shield, {SPR}"},
    {"id": "spr_vorarbeiter", "kind": "cut", "size": (768, 1024), "max": 512,
     "prompt": f"a burly factory foreman in a leather apron and welding goggles, holding a huge sledgehammer, sparks on his gloves, {SPR}"},
    {"id": "spr_riot-kommandeur", "kind": "cut", "size": (768, 1024), "max": 512,
     "prompt": f"a riot police commander in heavy black armour with red warning lights, gas mask helmet, shock baton, {SPR}"},
    {"id": "spr_assistent", "kind": "cut", "size": (768, 1024), "max": 512,
     "prompt": f"a gaunt pale laboratory assistant man in a stained grey white coat and surgical mask, thin scalpel in hand, painted with soft shading, feet visible, no floor, no ground, no platform, {SPR}"},
    {"id": "spr_sezier-golem", "kind": "cut", "size": (768, 1024), "max": 640,
     "prompt": f"a tall surgical dissection golem robot of white steel and glass, many thin arms ending in scalpels and a claw, a cyan lens eye, {SPR}"},
    {"id": "spr_exponat", "kind": "cut", "size": (768, 1024), "max": 512,
     "prompt": f"a gaunt shadow creature, a failed experiment with violet glowing veins and long claws, wisps of black smoke, {SPR}"},
    {"id": "spr_schwarzkittel", "kind": "cut", "size": (768, 1024), "max": 640,
     "prompt": f"a towering emergency response construct robot in a long black armoured coat, cables trailing from its back, cyan electric arcs, smog yellow warning stripes, {SPR}"},
    {"id": "spr_doktor-asche", "kind": "cut", "size": (768, 1024), "max": 512,
     "prompt": f"a composed female scientist in a long white lab coat with ember orange glowing gauntlet on one arm, grey hair tied back, round spectacles, clinical and calm, {SPR}"},
    {"id": "spr_oel-leviathan", "kind": "cut", "size": (1024, 1024), "max": 640,
     "prompt": f"a monstrous creature rising from black oil, slick tentacles and a gaping maw with pale teeth, {SPR}"},
]


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def export(item, master):
    """Master-PNG → WebP für das Spiel (freistellen, beschneiden, verkleinern)."""
    from PIL import Image

    img = Image.open(master)
    if item["kind"] == "cut":
        from rembg import remove

        img = remove(img.convert("RGBA"))
        a = img.split()[3].point(lambda v: 0 if v < 20 else v)
        img.putalpha(a)
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
    else:
        img = img.convert("RGB")
    w, h = img.size
    m = item.get("max", 1024)
    if max(w, h) > m:
        k = m / max(w, h)
        img = img.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, item["id"] + ".webp")
    img.save(dst, "WEBP", quality=84, method=6)
    return dst, img.size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="", help="Kommagetrennte ids oder Präfixe")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--seed", type=int)
    ap.add_argument("--reexport", action="store_true", help="keine GPU, nur WebP aus vorhandenen Mastern")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    wanted = [s for s in a.only.split(",") if s]
    items = [i for i in ITEMS if not wanted or any(i["id"] == w or i["id"].startswith(w) for w in wanted)]
    os.makedirs(MASTER, exist_ok=True)
    sizes = {}
    sizes_file = os.path.join(OUT, "sizes.json")
    if os.path.exists(sizes_file):
        with open(sizes_file, encoding="utf-8") as f:
            sizes = json.load(f)

    for n, item in enumerate(items, 1):
        master = os.path.join(MASTER, item["id"] + ".png")
        meta = os.path.join(MASTER, item["id"] + ".json")
        todo = a.force or not os.path.exists(master)
        if a.dry_run:
            log(f"[{n}/{len(items)}] {item['id']} {'GEN' if todo else 'ok'}")
            continue
        if todo and not a.reexport:
            from gen_images import generate_image

            seed = a.seed if a.seed is not None else item.get("seed", 7)
            t0 = time.time()
            log(f"[{n}/{len(items)}] {item['id']} …")
            generate_image(item["prompt"], master, seed=seed, size=item["size"], name="rssouls-" + item["id"], log=lambda *_: None)
            with open(meta, "w", encoding="utf-8") as f:
                json.dump({"prompt": item["prompt"], "seed": seed, "size": item["size"], "model": "zimage"}, f, indent=1)
            log(f"   fertig in {time.time() - t0:.0f}s")
        webp = os.path.join(OUT, item["id"] + ".webp")
        fresh = os.path.exists(webp) and os.path.getmtime(webp) >= os.path.getmtime(master) if os.path.exists(master) else False
        if os.path.exists(master) and (a.reexport or not fresh):
            dst, size = export(item, master)
            sizes[item["id"]] = list(size)
            with open(sizes_file, "w", encoding="utf-8") as f:
                json.dump(dict(sorted(sizes.items())), f, indent=1)
            log(f"   → {os.path.relpath(dst, ROOT)} {size[0]}×{size[1]}")


if __name__ == "__main__":
    main()
