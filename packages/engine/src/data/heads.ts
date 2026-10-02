export interface HeadDef {
  id: string;
  name: { de: string; en: string };
  /** What the head shows, in words. Written for the old concept-image pipeline, kept as the description. */
  prompt: string;
  /**
   * Built height of the head in world units (the body is ~1.0), rounded to 2 decimals.
   * `tests/heads.test.ts` keeps this in step with the geometry – change a head and the test tells
   * you the new number.
   */
  height: number;
}

/**
 * Swappable heads for the colour figures. Adding an entry here makes it selectable in every lobby –
 * `Lobby.tsx` cycles this array, `net.ts` validates guests against it, nothing else needs touching.
 * The geometry lives in `assets/procedural/heads-classic.ts` and `heads-extra.ts`; `kugel` is the
 * fallback ball built in `buildHead` itself. Sizes vary on purpose.
 */
export const HEADS: HeadDef[] = [
  { id: 'kugel', name: { de: 'Kugel', en: 'Ball' }, prompt: 'smooth round cartoon head with big friendly eyes', height: 0.54 },
  { id: 'pferd', name: { de: 'Pferd', en: 'Horse' }, prompt: 'cartoon horse head with long snout, pointy ears and short mane', height: 0.69 },
  { id: 'flaschengeist', name: { de: 'Flaschengeist', en: 'Genie' }, prompt: 'friendly fairy-tale genie head with a big blue turban with a jewel, round nose, long curly black beard and a wide happy grin', height: 0.95 },
  { id: 'pirat', name: { de: 'Pirat', en: 'Pirate' }, prompt: 'cartoon pirate head with tricorn hat, eye patch and stubble grin', height: 0.65 },
  { id: 'roboter', name: { de: 'Roboter', en: 'Robot' }, prompt: 'boxy cartoon robot head with glowing visor eyes and a small antenna', height: 0.68 },
  { id: 'kuerbis', name: { de: 'Kürbis', en: 'Pumpkin' }, prompt: 'cartoon jack-o-lantern pumpkin head with a cheeky carved grin and a stem', height: 0.58 },
  { id: 'astronaut', name: { de: 'Astronaut', en: 'Astronaut' }, prompt: 'cartoon astronaut helmet head with reflective gold visor and white shell', height: 0.67 },
  { id: 'wikinger', name: { de: 'Wikinger', en: 'Viking' }, prompt: 'cartoon viking head with horned helmet, braided red beard and a grin', height: 0.71 },
  { id: 'ritter', name: { de: 'Ritter', en: 'Knight' }, prompt: 'cartoon knight helmet head with visor slit and a red plume', height: 0.95 },
  { id: 'zauberer', name: { de: 'Zauberer', en: 'Wizard' }, prompt: 'cartoon wizard head with tall pointy star hat, long white beard and round glasses', height: 1.12 },
  { id: 'koch', name: { de: 'Koch', en: 'Chef' }, prompt: 'cartoon chef head with tall white toque, curly moustache and rosy cheeks', height: 0.89 },
  { id: 'hai', name: { de: 'Hai', en: 'Shark' }, prompt: 'cartoon shark head with dorsal fin, big toothy smile and googly eyes', height: 0.68 },
  { id: 'kaktus', name: { de: 'Kaktus', en: 'Cactus' }, prompt: 'cute cartoon cactus head with tiny arms, a pink flower and a smile', height: 0.74 },
  { id: 'ninja', name: { de: 'Ninja', en: 'Ninja' }, prompt: 'cartoon ninja head in a black hood with a single eye slit and a red headband knotted at the back', height: 0.65 },
  { id: 'drache', name: { de: 'Drache', en: 'Dragon' }, prompt: 'cartoon green dragon head with a snout, two horns, small fangs and a golden spine crest', height: 0.77 },
  { id: 'alien', name: { de: 'Alien', en: 'Alien' }, prompt: 'cartoon green alien head, broad cranium tapering to a narrow chin, big black almond eyes and no mouth', height: 0.82 },
  { id: 'skelett', name: { de: 'Skelett', en: 'Skeleton' }, prompt: 'cartoon skull head with deep eye sockets, a triangular nose hole and a row of white teeth', height: 0.73 },
  { id: 'biene', name: { de: 'Biene', en: 'Bee' }, prompt: 'cute cartoon bee head with a black and yellow striped cap, two ball-tipped antennae and big compound eyes', height: 0.92 },
  { id: 'yeti', name: { de: 'Yeti', en: 'Yeti' }, prompt: 'cartoon yeti head with shaggy white fur, heavy brows, a blue nose and two small fangs', height: 0.79 },
  { id: 'taucher', name: { de: 'Taucher', en: 'Diver' }, prompt: 'cartoon copper diving helmet head with a round porthole, three rivets and an air hose stub at the back', height: 0.76 },
  { id: 'einhorn', name: { de: 'Einhorn', en: 'Unicorn' }, prompt: 'cartoon unicorn head with a white coat, a twisted golden horn and a rainbow mane', height: 1.0 },
  { id: 'anubis', name: { de: 'Anubis', en: 'Anubis' }, prompt: 'low poly egyptian god anubis: black jackal head with tall ears, blue and gold striped nemes headdress, gold collar and forehead jewel', height: 0.9 },
];

export const headById = (id: string) => HEADS.find((h) => h.id === id) ?? HEADS[0]!;
