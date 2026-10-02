"""Die Animationen des Helden als Keyframes.

Winkel in Grad, relativ zur Ruhelage (der gemalten Standpose), positiv = gegen den Uhrzeigersinn
im Bild. Der Held schaut nach rechts: ein Bein oder Arm, der nach vorn schwingt, dreht positiv.
`root_xy` verschiebt die ganze Figur in Pixeln der Vorlage (x rechts, y oben).

`grip_r` ist nur der Waffenanker: seine Drehung bestimmt die Klingenrichtung, ohne die Faust zu
drehen. In Ruhe zeigt die Klinge schräg nach vorn unten.

`phases` (nur bei Angriffen) teilt die Bilder auf die Phasen der Simulation auf:
[Beginn Schlag, Beginn Nachschwung] – davor ist Ausholen.
"""


def mirror_run(a):
    """Die zweite Hälfte eines Laufzyklus: rechtes und linkes Bein (und Arm) vertauscht."""
    swap = {}
    for k, v in a.items():
        if "_r_" in k:
            swap[k.replace("_r_", "_l_")] = v
        elif "_l_" in k:
            swap[k.replace("_l_", "_r_")] = v
        else:
            swap[k] = v
    return swap


def with_skirt(v, k=0.45, flow=0.0):
    """Der Mantelschoß folgt den Oberschenkeln halb, im Lauf weht er etwas nach hinten."""
    v = dict(v)
    v["skirt_b"] = v.get("leg_r_up", 0) * k - flow
    v["skirt_f"] = v.get("leg_l_up", 0) * k - flow
    return v


# Der Schwertarm trägt die Klinge beim Laufen tief und nachgezogen; der andere Arm schwingt.
RUN_A = {"leg_r_up": 30, "leg_r_lo": -8, "leg_l_up": -26, "leg_l_lo": -38,
         "arm_l_up": 28, "arm_l_lo": 40}
RUN_B = {"leg_r_up": 6, "leg_r_lo": -14, "leg_l_up": 10, "leg_l_lo": -78,
         "arm_l_up": 4, "arm_l_lo": 25}
RUN_BODY = {"torso": -9, "head": 5, "arm_r_up": -16, "arm_r_lo": 22, "blade": -150}


def run_key(legs, bob, sway):
    v = dict(RUN_BODY)
    v.update(legs)
    v["root_xy"] = (0, bob)
    v["arm_r_up"] = RUN_BODY["arm_r_up"] + sway
    return with_skirt(v, flow=9)


ACTIONS = {
    "idle": {
        "frames": 12, "fps": 8, "loop": True,
        "keys": [
            (0, {}),
            (6, {"torso": 1.2, "head": -1.5, "arm_r_up": 2, "arm_r_lo": -2, "arm_l_up": -2, "root_xy": (0, 2), "grip_r": 2}),
            (12, {}),
        ],
    },
    "run": {
        "frames": 8, "fps": 14, "loop": True,
        "keys": [
            (0, run_key(RUN_A, -8, 6)),
            (2, run_key(RUN_B, 8, 0)),
            (4, run_key(mirror_run(RUN_A) | {"arm_l_up": -30, "arm_l_lo": 12}, -8, -6)),
            (6, run_key(mirror_run(RUN_B) | {"arm_l_up": -4, "arm_l_lo": 18}, 8, 0)),
            (8, run_key(RUN_A, -8, 6)),
        ],
    },
    # Hieb von oben: weit über die Schulter ausholen, durchziehen bis vorn unten, nachschwingen
    "hieb1": {
        "frames": 10, "fps": 15, "phases": [4, 6],
        "keys": [
            (0, {}),
            (2, {"arm_r_up": -120, "arm_r_lo": -40, "hand_r": -10, "grip_r": 10, "torso": 5, "head": 2,
                 "arm_l_up": 10, "root_xy": (-4, 0)}),
            (3, {"arm_r_up": -150, "arm_r_lo": -35, "hand_r": -12, "grip_r": 15, "torso": 7, "head": 3,
                 "arm_l_up": 14, "root_xy": (-6, 0), "leg_r_up": -4, "leg_l_up": 6}),
            (4, {"arm_r_up": -215, "arm_r_lo": -15, "hand_r": -5, "grip_r": -20, "torso": -4, "head": 0,
                 "arm_l_up": -10, "root_xy": (6, -2), "leg_r_up": -8, "leg_l_up": 12}),
            (5, {"arm_r_up": -282, "arm_r_lo": 0, "hand_r": 0, "grip_r": -55, "torso": -10, "head": -3,
                 "arm_l_up": -22, "root_xy": (12, -6), "leg_r_up": -12, "leg_l_up": 16, "leg_l_lo": -6}),
            (6, {"arm_r_up": -298, "arm_r_lo": 4, "hand_r": 0, "grip_r": -60, "torso": -11, "head": -3,
                 "arm_l_up": -24, "root_xy": (13, -7), "leg_r_up": -12, "leg_l_up": 16, "leg_l_lo": -6}),
            (8, {"arm_r_up": -325, "arm_r_lo": 6, "hand_r": 0, "grip_r": -30, "torso": -6, "head": -2,
                 "arm_l_up": -12, "root_xy": (8, -4), "leg_r_up": -6, "leg_l_up": 8}),
            (10, {"arm_r_up": -360}),
        ],
    },
    # Gegenschlag von unten: tief hinten ausholen, nach vorn oben durchziehen
    "hieb2": {
        "frames": 10, "fps": 15, "phases": [4, 6],
        "keys": [
            (0, {}),
            (2, {"arm_r_up": -40, "arm_r_lo": -20, "grip_r": -95, "torso": 4, "root_xy": (-4, -2), "leg_r_up": -6, "leg_l_up": 6}),
            (3, {"arm_r_up": -55, "arm_r_lo": -25, "grip_r": -110, "torso": 6, "root_xy": (-6, -4), "leg_r_up": -8, "leg_l_up": 8, "leg_l_lo": -8}),
            (4, {"arm_r_up": 40, "arm_r_lo": 20, "grip_r": -20, "torso": -4, "root_xy": (6, -2), "arm_l_up": -14}),
            (5, {"arm_r_up": 140, "arm_r_lo": 20, "grip_r": 40, "torso": -8, "head": 4, "root_xy": (10, 0), "arm_l_up": -20,
                 "leg_r_up": -10, "leg_l_up": 14}),
            (6, {"arm_r_up": 150, "arm_r_lo": 18, "grip_r": 45, "torso": -8, "head": 4, "root_xy": (10, 0), "arm_l_up": -20,
                 "leg_r_up": -10, "leg_l_up": 14}),
            (8, {"arm_r_up": 90, "arm_r_lo": 10, "grip_r": 10, "torso": -4, "root_xy": (5, 0), "arm_l_up": -8}),
            (10, {}),
        ],
    },
    # Stich: Faust zur Hüfte zurück, dann der Arm gerade nach vorn
    "stich": {
        "frames": 9, "fps": 15, "phases": [3, 5],
        "keys": [
            (0, {}),
            (2, {"arm_r_up": -25, "arm_r_lo": 75, "hand_r": -10, "grip_r": 45, "torso": 6, "root_xy": (-10, -4),
                 "leg_r_up": -8, "leg_l_up": 10, "leg_l_lo": -10}),
            (3, {"arm_r_up": 50, "arm_r_lo": 30, "grip_r": 20, "torso": -6, "root_xy": (6, -6), "leg_r_up": -14, "leg_l_up": 20}),
            (4, {"arm_r_up": 88, "arm_r_lo": 2, "grip_r": 40, "torso": -12, "head": 6, "root_xy": (22, -10), "arm_l_up": -30,
                 "leg_r_up": -20, "leg_r_lo": -6, "leg_l_up": 28, "leg_l_lo": -16}),
            (5, {"arm_r_up": 90, "arm_r_lo": 0, "grip_r": 41, "torso": -12, "head": 6, "root_xy": (24, -10), "arm_l_up": -30,
                 "leg_r_up": -20, "leg_r_lo": -6, "leg_l_up": 28, "leg_l_lo": -16}),
            (7, {"arm_r_up": 60, "arm_r_lo": 10, "grip_r": 30, "torso": -6, "root_xy": (12, -5), "arm_l_up": -14,
                 "leg_r_up": -10, "leg_l_up": 14}),
            (9, {}),
        ],
    },
    # schwerer Hieb (Ladung, Hammer): höher, langsamer ausholen, tief durchziehen
    "schwer": {
        "frames": 12, "fps": 12, "phases": [6, 8],
        "keys": [
            (0, {}),
            (3, {"arm_r_up": -140, "arm_r_lo": -30, "arm_l_up": -150, "arm_l_lo": -30, "grip_r": 20, "torso": 9, "head": 3,
                 "root_xy": (-8, 4), "leg_r_up": -6, "leg_l_up": 6}),
            (5, {"arm_r_up": -168, "arm_r_lo": -28, "arm_l_up": -170, "arm_l_lo": -25, "grip_r": 25, "torso": 12, "head": 4,
                 "root_xy": (-10, 6), "leg_r_up": -8, "leg_l_up": 8}),
            (6, {"arm_r_up": -250, "arm_r_lo": -8, "arm_l_up": -250, "arm_l_lo": -8, "grip_r": -30, "torso": -6,
                 "root_xy": (6, -6), "leg_r_up": -12, "leg_l_up": 16}),
            (7, {"arm_r_up": -312, "arm_r_lo": 0, "arm_l_up": -310, "arm_l_lo": 0, "grip_r": -70, "torso": -16, "head": -4,
                 "root_xy": (14, -16), "leg_r_up": -16, "leg_r_lo": -10, "leg_l_up": 24, "leg_l_lo": -22}),
            (8, {"arm_r_up": -318, "arm_r_lo": 0, "arm_l_up": -316, "arm_l_lo": 0, "grip_r": -72, "torso": -17, "head": -4,
                 "root_xy": (15, -18), "leg_r_up": -16, "leg_r_lo": -10, "leg_l_up": 24, "leg_l_lo": -22}),
            (10, {"arm_r_up": -335, "arm_l_up": -335, "grip_r": -40, "torso": -8, "root_xy": (8, -8), "leg_r_up": -8, "leg_l_up": 12}),
            (12, {"arm_r_up": -360, "arm_l_up": -360}),
        ],
    },
    # Sturzangriff (in der Luft, unten + Schlag): Klinge senkrecht nach unten
    "sturz": {
        "frames": 6, "fps": 12, "phases": [2, 5],
        "keys": [
            (0, {"arm_r_up": -30, "grip_r": 40, "leg_r_up": 20, "leg_r_lo": -40, "leg_l_up": 30, "leg_l_lo": -50}),
            (2, {"arm_r_up": 30, "arm_r_lo": -20, "hand_r": -20, "grip_r": -40, "torso": -6, "leg_r_up": 25, "leg_r_lo": -55,
                 "leg_l_up": 35, "leg_l_lo": -60}),
            (5, {"arm_r_up": 30, "arm_r_lo": -20, "hand_r": -20, "grip_r": -40, "torso": -6, "leg_r_up": 25, "leg_r_lo": -55,
                 "leg_l_up": 35, "leg_l_lo": -60}),
            (6, {}),
        ],
    },
    # Drehschlag (Fähigkeit rundum): die Klinge kreist um den Körper
    "dreh": {
        "frames": 10, "fps": 15, "phases": [3, 8],
        "keys": [
            (0, {}),
            (3, {"arm_r_up": -100, "arm_r_lo": -20, "grip_r": 10, "torso": 8, "root_xy": (0, -8), "leg_r_up": -10, "leg_l_up": 10}),
            (5, {"arm_r_up": -280, "arm_r_lo": 0, "grip_r": -10, "torso": -8, "root_xy": (0, -10), "leg_r_up": -12, "leg_l_up": 12}),
            (8, {"arm_r_up": -460, "arm_r_lo": 0, "grip_r": -10, "torso": 8, "root_xy": (0, -10), "leg_r_up": -12, "leg_l_up": 12}),
            (10, {"arm_r_up": -360}),
        ],
    },
    # Luftschlag: Beine angezogen, Hieb schräg nach vorn unten
    "luft": {
        "frames": 8, "fps": 15, "phases": [3, 5],
        "keys": [
            (0, {"leg_r_up": 20, "leg_r_lo": -40, "leg_l_up": 30, "leg_l_lo": -50}),
            (2, {"arm_r_up": -150, "arm_r_lo": -30, "grip_r": 20, "torso": 6, "leg_r_up": 20, "leg_r_lo": -45, "leg_l_up": 35,
                 "leg_l_lo": -55}),
            (3, {"arm_r_up": -230, "arm_r_lo": -10, "grip_r": -20, "torso": -4, "leg_r_up": 25, "leg_r_lo": -50, "leg_l_up": 40,
                 "leg_l_lo": -60}),
            (4, {"arm_r_up": -300, "arm_r_lo": 0, "grip_r": -60, "torso": -10, "leg_r_up": 25, "leg_r_lo": -50, "leg_l_up": 40,
                 "leg_l_lo": -60}),
            (6, {"arm_r_up": -330, "grip_r": -40, "torso": -5, "leg_r_up": 20, "leg_r_lo": -40, "leg_l_up": 30, "leg_l_lo": -50}),
            (8, {"arm_r_up": -360, "leg_r_up": 20, "leg_r_lo": -40, "leg_l_up": 30, "leg_l_lo": -50}),
        ],
    },
    # Deckung: Schwert schräg vor dem Gesicht, freie Hand stützt; zweites Bild: Treffer drückt zurück
    "block": {
        "frames": 2, "fps": 1,
        "keys": [
            (0, {"arm_r_up": 62, "arm_r_lo": 78, "hand_r": -6, "arm_l_up": 26, "arm_l_lo": 92, "torso": 5, "head": -3,
                 "root_xy": (-4, -10), "leg_r_up": -12, "leg_r_lo": 10, "leg_l_up": 14, "leg_l_lo": -18}),
            (1, {"arm_r_up": 52, "arm_r_lo": 86, "hand_r": -4, "arm_l_up": 20, "arm_l_lo": 98, "torso": 11, "head": 1,
                 "root_xy": (-12, -12), "leg_r_up": -16, "leg_r_lo": 12, "leg_l_up": 10, "leg_l_lo": -20}),
        ],
    },
    # Rolle: zusammengekauert (das Spiel dreht die Figur)
    "roll": {
        "frames": 1, "fps": 1,
        "keys": [(0, {"arm_r_up": 60, "arm_r_lo": 80, "grip_r": 40, "arm_l_up": 70, "arm_l_lo": 80, "torso": -40, "head": -20,
                      "leg_r_up": 80, "leg_r_lo": -110, "leg_l_up": 90, "leg_l_lo": -115, "root_xy": (0, -40)})],
    },
    # Sprung (steigend) und Fall
    "jump": {
        "frames": 1, "fps": 1,
        "keys": [(0, {"arm_r_up": -20, "arm_r_lo": 20, "grip_r": -30, "arm_l_up": 40, "arm_l_lo": 40, "torso": -4, "head": 4,
                      "leg_r_up": -15, "leg_r_lo": -20, "leg_l_up": 35, "leg_l_lo": -60})],
    },
    "fall": {
        "frames": 1, "fps": 1,
        "keys": [(0, {"arm_r_up": -45, "arm_r_lo": 10, "grip_r": -10, "arm_l_up": 70, "arm_l_lo": 30, "torso": 3, "head": 2,
                      "leg_r_up": 10, "leg_r_lo": -25, "leg_l_up": 20, "leg_l_lo": -30})],
    },
    # getroffen: nach hinten geworfen
    "hurt": {
        "frames": 1, "fps": 1,
        "keys": [(0, {"arm_r_up": -40, "arm_r_lo": -10, "grip_r": 20, "arm_l_up": -50, "arm_l_lo": 30, "torso": 14, "head": 12,
                      "root_xy": (-10, -4), "leg_r_up": 8, "leg_l_up": -10})],
    },
    # tot: zusammengesunken auf den Knien (das Spiel legt die Figur dann hin)
    "dead": {
        "frames": 1, "fps": 1,
        "keys": [(0, {"arm_r_up": 20, "arm_r_lo": 10, "grip_r": -50, "arm_l_up": 10, "torso": -25, "head": -30,
                      "leg_r_up": 70, "leg_r_lo": -120, "leg_l_up": 75, "leg_l_lo": -125, "root_xy": (0, -150)})],
    },
    # Rasten am Kollektor: kniend, Schwert aufgestützt
    "rest": {
        "frames": 1, "fps": 1,
        "keys": [(0, {"arm_r_up": 40, "arm_r_lo": 40, "grip_r": -50, "arm_l_up": 30, "arm_l_lo": 60, "torso": -10, "head": -10,
                      "leg_r_up": 85, "leg_r_lo": -150, "leg_l_up": 10, "leg_l_lo": -100, "root_xy": (0, -130)})],
    },
    # Glut-Ampulle trinken: freie Hand zum Gesicht
    "drink": {
        "frames": 1, "fps": 1,
        "keys": [(0, {"arm_l_up": 130, "arm_l_lo": 110, "head": 14, "torso": 4, "grip_r": 0})],
    },
    # Ladung halten: hoch über der Schulter, gespannt
    "charge": {
        "frames": 1, "fps": 1,
        "keys": [(0, {"arm_r_up": -165, "arm_r_lo": -30, "grip_r": 25, "arm_l_up": -60, "arm_l_lo": 20, "torso": 10, "head": 3,
                      "root_xy": (-8, -6), "leg_r_up": -10, "leg_r_lo": 8, "leg_l_up": 12, "leg_l_lo": -14})],
    },
}
# Klingenwinkel im Bild (Grad, gegen den Uhrzeigersinn, 0 = nach vorn), je Aktion und Schlüsselbild.
# Daraus wird die Drehung des Griffknochens berechnet: Rumpf und Arm drehen die Klinge ja mit.
BLADE = {'hieb1': {2: 140, 3: 155, 4: 70, 5: -25, 6: -35, 8: -45}, 'hieb2': {2: -150, 3: -160, 4: -60, 5: 70, 6: 80, 8: 20}, 'stich': {2: 5, 3: 0, 4: 0, 5: 0, 7: -15}, 'schwer': {3: 150, 5: 165, 6: 60, 7: -70, 8: -75, 10: -55}, 'luft': {2: 150, 3: 60, 4: -45, 6: -50}, 'sturz': {0: -60, 2: -90, 5: -90}, 'block': {0: 72, 1: 88}, 'charge': {0: 160}, 'jump': {0: -30}, 'fall': {0: -20}, 'hurt': {0: 150}, 'rest': {0: -90}, 'drink': {0: -60}}


def rest_blade():
    import math

    import hero_spec

    (hx, hy), (tx, ty) = hero_spec.BONES["grip_r"]["head"], hero_spec.BONES["grip_r"]["tail"]
    return math.degrees(math.atan2(-(ty - hy), tx - hx))


def resolve_blades(name, keys):
    """`blade` (absolut im Bild) → `grip_r` (relativ zur Hand), stetig von Schlüssel zu Schlüssel."""
    rest = rest_blade()
    out = []
    prev = 0.0
    for f, v in keys:
        v = dict(v)
        blade = v.pop("blade", BLADE.get(name, {}).get(f))
        if blade is not None:
            chain = v.get("torso", 0) + v.get("arm_r_up", 0) + v.get("arm_r_lo", 0) + v.get("hand_r", 0)
            g = blade - rest - chain
            while g - prev > 180:
                g -= 360
            while prev - g > 180:
                g += 360
            v["grip_r"] = g
        prev = v.get("grip_r", 0.0)
        out.append((f, v))
    return out


for _name, a in ACTIONS.items():
    a["keys"] = resolve_blades(_name, [(f, with_skirt(v) if "skirt_b" not in v else v) for f, v in a["keys"]])
