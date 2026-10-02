"""Das Cutout-Rig des RS-Souls-Helden: Knochen und Teile, in Pixeln der Vorlage.

Vorlage ist das Master-Bild der Standpose (`assets-source/rssouls/spr_hero_idle.png`, 768×1024):
genau die Figur, die das Spiel schon zeigt. Der Held schaut nach rechts, leicht zur Kamera gedreht.
Sein **rechter** Arm (links im Bild) ist der Arm nahe der Kamera und führt die Waffe.

Wird von `cut_parts.py` (Teile ausschneiden) und von `rig_blender.py` (Blender) gelesen.
Koordinaten: x nach rechts, y nach unten, wie im Bild.
"""

SOURCE = "spr_hero_idle.png"
SIZE = (768, 1024)

# Knochen: Kopf (Drehpunkt) und Spitze in Pixeln, Elternknochen. Die Reihenfolge ist die Hierarchie.
BONES = {
    "root": {"head": (400, 520), "tail": (400, 440), "parent": None},
    "torso": {"head": (400, 505), "tail": (410, 300), "parent": "root"},
    "head": {"head": (412, 258), "tail": (420, 130), "parent": "torso"},
    # rechter Arm (links im Bild, nah an der Kamera, führt die Waffe)
    "arm_r_up": {"head": (268, 320), "tail": (238, 430), "parent": "torso"},
    "arm_r_lo": {"head": (238, 430), "tail": (243, 552), "parent": "arm_r_up"},
    "hand_r": {"head": (243, 552), "tail": (244, 596), "parent": "arm_r_lo"},
    # Waffenanker: Kopf = Mitte der Faust (dort sitzt der Griff), Richtung = Klinge
    "grip_r": {"head": (244, 592), "tail": (290, 632), "parent": "hand_r"},
    # linker Arm (rechts im Bild, von der Kamera abgewandt)
    "arm_l_up": {"head": (506, 320), "tail": (530, 432), "parent": "torso"},
    "arm_l_lo": {"head": (530, 432), "tail": (548, 552), "parent": "arm_l_up"},
    "hand_l": {"head": (548, 552), "tail": (550, 600), "parent": "arm_l_lo"},
    # Beine: Oberschenkel liegen unter dem Mantel, Unterschenkel mit Stiefel darunter
    "leg_r_up": {"head": (330, 560), "tail": (272, 790), "parent": "root"},
    "leg_r_lo": {"head": (272, 790), "tail": (262, 945), "parent": "leg_r_up"},
    "leg_l_up": {"head": (455, 560), "tail": (472, 790), "parent": "root"},
    "leg_l_lo": {"head": (472, 790), "tail": (492, 935), "parent": "leg_l_up"},
    # Mantelschoß: hintere und vordere Hälfte, hängen am Gürtel
    "skirt_b": {"head": (350, 500), "tail": (290, 830), "parent": "root"},
    "skirt_f": {"head": (440, 500), "tail": (500, 830), "parent": "root"},
}

# Zeichenreihenfolge von hinten nach vorn. Abgewandte Glieder werden etwas abgedunkelt.
DARK = 0.72
PARTS = [
    {"id": "hand_l", "bone": "hand_l", "tint": DARK},
    {"id": "arm_l_lo", "bone": "arm_l_lo", "tint": DARK},
    {"id": "arm_l_up", "bone": "arm_l_up", "tint": DARK},
    {"id": "leg_l_lo", "bone": "leg_l_lo", "tint": 0.85},
    {"id": "leg_l_up", "bone": "leg_l_up", "tint": 0.85},
    {"id": "leg_r_lo", "bone": "leg_r_lo"},
    {"id": "leg_r_up", "bone": "leg_r_up"},
    {"id": "skirt_b", "bone": "skirt_b"},
    {"id": "skirt_f", "bone": "skirt_f"},
    {"id": "torso", "bone": "torso"},
    {"id": "head", "bone": "head"},
    {"id": "arm_r_up", "bone": "arm_r_up"},
    {"id": "arm_r_lo", "bone": "arm_r_lo"},
    {"id": "hand_r", "bone": "hand_r", "layer": "hand"},
]

# Ausgabe: quadratischer Bildausschnitt um die Figur (Pixel der Vorlage) und Kantenlänge eines Bildes.
FRAME_CENTER = (400, 500)
FRAME_SPAN = 1320
FRAME_PX = 384
GROUND_Y = 975  # Sohlen in der Vorlage
