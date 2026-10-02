"""Blender: das Cutout-Rig des Helden bauen, animieren und zu Einzelbildern rendern.

  R=~/.claude/skills/blender/scripts
  $R/blender-run tools/assets/rssouls_rig/rig_blender.py -- <rig-ordner> [--only run,hieb1] [--no-render]

<rig-ordner> ist assets-source/rssouls/rig (rig.json + parts/ aus cut_parts.py). Ergebnis:
  hero_rig.blend                 das Rig mit allen Aktionen, zum Weiterbearbeiten in Blender
  frames/<aktion>/body_###.png   die Figur ohne Schwertfaust
  frames/<aktion>/hand_###.png   nur die Schwertfaust (liegt im Spiel über der Waffe)
  frames/<aktion>.json           je Bild: Griff (x, y in Bildpixeln) und Klingenwinkel

Ebene des Bildes ist XZ (x rechts, z oben), die Kamera schaut entlang +Y. Jeder Knochen ist so
gerollt, dass seine lokale Z-Achse zur Kamera zeigt: eine Drehung um Z ist eine Drehung im Bild
(positiv = gegen den Uhrzeigersinn). In Blender also: Vorderansicht, Knochen wählen, R drücken.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
RIG_DIR = argv[0]
ONLY = []
RENDER = "--no-render" not in argv
if "--only" in argv:
    ONLY = argv[argv.index("--only") + 1].split(",")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import actions_hero  # noqa: E402

with open(os.path.join(RIG_DIR, "rig.json"), encoding="utf-8") as f:
    RIG = json.load(f)
W, H = RIG["size"]
PX = 100.0  # Pixel der Vorlage je Blender-Einheit


def P(x, y, depth=0.0):
    return Vector((x / PX, depth, (H - y) / PX))


# --- Szene ---------------------------------------------------------------------------------------
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 16
scene.render.film_transparent = True
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
fr = RIG["frame"]
scene.render.resolution_x = scene.render.resolution_y = fr["px"]
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.fps = 12

cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = fr["span"] / PX
cam = bpy.data.objects.new("cam", cam_data)
cam.location = P(fr["center"][0], fr["center"][1], -20)
cam.rotation_euler = (math.radians(90), 0, 0)
scene.collection.objects.link(cam)
scene.camera = cam

# --- Skelett ------------------------------------------------------------------------------------
arm_data = bpy.data.armatures.new("hero")
arm_data.display_type = "STICK"
arm = bpy.data.objects.new("hero_rig", arm_data)
arm.show_in_front = True
scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for name, b in RIG["bones"].items():
    eb = arm_data.edit_bones.new(name)
    eb.head = P(*b["head"])
    eb.tail = P(*b["tail"])
    eb.align_roll(Vector((0, -1, 0)))  # lokale Z-Achse zeigt zur Kamera
    if b["parent"]:
        eb.parent = arm_data.edit_bones[b["parent"]]
        eb.use_connect = False
bpy.ops.object.mode_set(mode="OBJECT")
for pb in arm.pose.bones:
    pb.rotation_mode = "XYZ"
    pb.lock_rotation = (True, True, False)


# --- Teile als Ebenen am Knochen ----------------------------------------------------------------
def part_material(pid, img_path, tint):
    mat = bpy.data.materials.new("m_" + pid)
    mat.surface_render_method = "BLENDED"
    nt = mat.node_tree
    nt.nodes.clear()
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(img_path)
    tex.interpolation = "Linear"
    tex.extension = "CLIP"
    emi = nt.nodes.new("ShaderNodeEmission")
    emi.inputs["Strength"].default_value = tint
    nt.links.new(tex.outputs["Color"], emi.inputs["Color"])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(tex.outputs["Alpha"], mix.inputs["Fac"])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(emi.outputs[0], mix.inputs[2])
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return mat


PART_OBJ = {}
n_parts = len(RIG["parts"])
for p in RIG["parts"]:
    x0, y0, x1, y1 = p["bbox"]
    depth = (n_parts - p["z"]) * 0.02  # vorne = näher an der Kamera (kleineres y)
    depth = -depth
    me = bpy.data.meshes.new("p_" + p["id"])
    vs = [P(x0, y1, depth), P(x1, y1, depth), P(x1, y0, depth), P(x0, y0, depth)]
    me.from_pydata([tuple(v) for v in vs], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new()
    for i, co in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.data[i].uv = co
    me.materials.append(part_material(p["id"], os.path.join(RIG_DIR, p["file"]), p.get("tint", 1.0)))
    ob = bpy.data.objects.new("part_" + p["id"], me)
    scene.collection.objects.link(ob)
    bone = arm.data.bones[p["bone"]]
    ob.parent = arm
    ob.parent_type = "BONE"
    ob.parent_bone = p["bone"]
    # Knochen-Elternschaft hängt am Knochenende: die Ruhelage ausgleichen
    rest = arm.matrix_world @ bone.matrix_local @ Matrix.Translation((0, bone.length, 0))
    ob.matrix_parent_inverse = rest.inverted()
    ob["layer"] = p.get("layer", "body")
    PART_OBJ[p["id"]] = ob

# Referenzschwert am Griff, nur zum Animieren (wird nicht gerendert)
wpn = os.path.join(RIG_DIR, "..", "..", "..", "games", "rssouls", "src", "assets", "img", "wpn_rost-klinge.webp")
if os.path.exists(wpn):
    g = arm.data.bones["grip_r"]
    length_px = 50 / 71 * 890  # Spiel: Schwert 50 bei 71 hoher Figur; Figur hier ~890 px
    img = bpy.data.images.load(os.path.abspath(wpn))
    asp = img.size[0] / max(1, img.size[1])
    hpx = length_px / asp
    cut, grip = 0.16, 0.205
    me = bpy.data.meshes.new("ref_sword")
    # entlang der Knochenrichtung (lokal +Y) liegt die Klinge, lokal X quer dazu
    x0 = (cut - grip) * length_px / PX
    x1 = (1 - grip) * length_px / PX
    hh = hpx / 2 / PX
    me.from_pydata([(-hh, x0, 0), (hh, x0, 0), (hh, x1, 0), (-hh, x1, 0)], [], [(0, 1, 2, 3)])
    uvl = me.uv_layers.new()
    for i, co in enumerate([(cut, 1), (cut, 0), (1, 0), (1, 1)]):
        uvl.data[i].uv = co
    me.materials.append(part_material("ref_sword", os.path.abspath(wpn), 1.0))
    sw = bpy.data.objects.new("ref_sword", me)
    scene.collection.objects.link(sw)
    sw.parent = arm
    sw.parent_type = "BONE"
    sw.parent_bone = "grip_r"
    # in die Bildebene drehen: lokal Z des Knochens zeigt zur Kamera, die Ebene liegt in lokal XY
    sw.matrix_parent_inverse = Matrix.Translation((0, -g.length, 0))
    sw.location = (0, 0, 0.01)
    sw.hide_render = True


# --- Aktionen -----------------------------------------------------------------------------------
def pose(values):
    for pb in arm.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
    for k, v in values.items():
        if k == "root_xy":
            # Knochen "root" zeigt nach oben: lokal X = rechts, lokal Y = oben
            arm.pose.bones["root"].location = (v[0] / PX, v[1] / PX, 0)
        else:
            arm.pose.bones[k].rotation_euler = (0, 0, math.radians(v))


def build_action(name, act):
    a = bpy.data.actions.new(name)
    a.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = a
    ad = arm.animation_data
    if hasattr(ad, "action_suitable_slots") and ad.action_slot is None and ad.action_suitable_slots:
        ad.action_slot = ad.action_suitable_slots[0]
    for f, values in act["keys"]:
        pose(values)
        for pb in arm.pose.bones:
            pb.keyframe_insert("rotation_euler", index=2, frame=f + 1)
        arm.pose.bones["root"].keyframe_insert("location", frame=f + 1)
    return a


def screen_px(world):
    c = fr["center"]
    x = (world.x * PX - c[0]) / fr["span"] * fr["px"] + fr["px"] / 2
    y = ((H - world.z * PX) - c[1]) / fr["span"] * fr["px"] + fr["px"] / 2
    return x, y


def render_action(name, act, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    meta = {"frames": act["frames"], "fps": act.get("fps", 12), "loop": act.get("loop", False),
            "phases": act.get("phases"), "size": fr["px"],
            "ground": (fr["ground"] - fr["center"][1]) / fr["span"] * fr["px"] + fr["px"] / 2,
            "scale": fr["px"] / fr["span"], "grip": []}
    for i in range(act["frames"]):
        scene.frame_set(i + 1)
        g = arm.pose.bones["grip_r"]
        hx, hy = screen_px(arm.matrix_world @ g.head)
        tx, ty = screen_px(arm.matrix_world @ g.tail)
        meta["grip"].append([round(hx, 2), round(hy, 2), round(math.atan2(-(ty - hy), tx - hx), 4)])
        if not RENDER:
            continue
        for layer in ("body", "hand"):
            for ob in PART_OBJ.values():
                ob.hide_render = ob["layer"] != layer
            scene.render.filepath = os.path.join(out_dir, f"{layer}_{i:03d}.png")
            bpy.ops.render.render(write_still=True)
    with open(out_dir + ".json", "w", encoding="utf-8", newline="\n") as f:
        json.dump(meta, f, indent=1)
    print("RIG rendered", name, act["frames"], flush=True)


for name, act in actions_hero.ACTIONS.items():
    build_action(name, act)
for name, act in actions_hero.ACTIONS.items():
    if ONLY and name not in ONLY:
        continue
    arm.animation_data.action = bpy.data.actions[name]
    ad = arm.animation_data
    if hasattr(ad, "action_suitable_slots") and ad.action_suitable_slots:
        ad.action_slot = ad.action_suitable_slots[0]
    scene.frame_start, scene.frame_end = 1, act["frames"]
    render_action(name, act, os.path.join(RIG_DIR, "frames", name))
arm.animation_data.action = bpy.data.actions[next(iter(actions_hero.ACTIONS))]
for ob in PART_OBJ.values():
    ob.hide_render = False
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(RIG_DIR, "hero_rig.blend"))
print("RIG saved", flush=True)
