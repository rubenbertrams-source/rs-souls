export interface CharacterDef {
  id: string;
  /** The roster is colours, and a colour has a name in every language – see `characterName`. */
  name: { de: string; en: string };
  /** Short flavour line (de/en). */
  tagline: { de: string; en: string };
  /** Primary + secondary colours for placeholders / HUD. */
  color: string;
  color2: string;
  /** light | medium | heavy – games map this to their stats. */
  weight: 'light' | 'medium' | 'heavy';
  /** Placeholder body shape until generated meshes exist. */
  shape: 'capsule' | 'sphere' | 'box' | 'cone';
  scale: number;
  /** true = placeholder colour entry; real characters (with meshes) set this to false. */
  placeholder?: boolean;
}

/**
 * Current roster: twelve colour placeholders (same figure, different paint).
 * Real characters with generated meshes are added here later – the games only rely on
 * id / colour / weight, so adding an entry is enough to make it selectable everywhere.
 *
 * Twelve and not eight because a seat claims its colour (see `takenCharacters` in the hub): with a
 * roster of exactly eight, a full eight-player lobby would leave nobody anything to switch to.
 */
export const CHARACTERS: CharacterDef[] = [
  { id: 'rot', name: { de: 'Rot', en: 'Red' }, tagline: { de: 'Platzhalter-Figur', en: 'Placeholder figure' }, color: '#ff4d4d', color2: '#ffd6d6', weight: 'medium', shape: 'capsule', scale: 1, placeholder: true },
  { id: 'blau', name: { de: 'Blau', en: 'Blue' }, tagline: { de: 'Platzhalter-Figur', en: 'Placeholder figure' }, color: '#3d8bff', color2: '#cfe6ff', weight: 'medium', shape: 'capsule', scale: 1, placeholder: true },
  { id: 'gruen', name: { de: 'Grün', en: 'Green' }, tagline: { de: 'Platzhalter-Figur', en: 'Placeholder figure' }, color: '#3ecf5a', color2: '#d6ffe0', weight: 'medium', shape: 'capsule', scale: 1, placeholder: true },
  { id: 'gelb', name: { de: 'Gelb', en: 'Yellow' }, tagline: { de: 'Platzhalter-Figur', en: 'Placeholder figure' }, color: '#ffd23a', color2: '#fff6cc', weight: 'medium', shape: 'capsule', scale: 1, placeholder: true },
  { id: 'orange', name: { de: 'Orange', en: 'Orange' }, tagline: { de: 'Platzhalter-Figur', en: 'Placeholder figure' }, color: '#ff8c1a', color2: '#ffe4c4', weight: 'medium', shape: 'capsule', scale: 1, placeholder: true },
  { id: 'lila', name: { de: 'Lila', en: 'Purple' }, tagline: { de: 'Platzhalter-Figur', en: 'Placeholder figure' }, color: '#9c4dff', color2: '#efe0ff', weight: 'medium', shape: 'capsule', scale: 1, placeholder: true },
  { id: 'tuerkis', name: { de: 'Türkis', en: 'Turquoise' }, tagline: { de: 'Platzhalter-Figur', en: 'Placeholder figure' }, color: '#2ad4d4', color2: '#e0ffff', weight: 'medium', shape: 'capsule', scale: 1, placeholder: true },
  { id: 'rosa', name: { de: 'Rosa', en: 'Pink' }, tagline: { de: 'Platzhalter-Figur', en: 'Placeholder figure' }, color: '#ff6fb5', color2: '#ffe0ef', weight: 'medium', shape: 'capsule', scale: 1, placeholder: true },
  // four more for eight-player rounds – hues picked to fill the gaps in the eight above (yellow-green,
  // magenta) plus a light and a dark neutral, so no two seats read the same across a room
  { id: 'limette', name: { de: 'Limette', en: 'Lime' }, tagline: { de: 'Platzhalter-Figur', en: 'Placeholder figure' }, color: '#9ee83a', color2: '#ecffd0', weight: 'medium', shape: 'capsule', scale: 1, placeholder: true },
  { id: 'magenta', name: { de: 'Magenta', en: 'Magenta' }, tagline: { de: 'Platzhalter-Figur', en: 'Placeholder figure' }, color: '#e83ad4', color2: '#ffdcfa', weight: 'medium', shape: 'capsule', scale: 1, placeholder: true },
  { id: 'weiss', name: { de: 'Weiß', en: 'White' }, tagline: { de: 'Platzhalter-Figur', en: 'Placeholder figure' }, color: '#f0efe8', color2: '#ffffff', weight: 'medium', shape: 'capsule', scale: 1, placeholder: true },
  { id: 'kohle', name: { de: 'Kohle', en: 'Charcoal' }, tagline: { de: 'Platzhalter-Figur', en: 'Placeholder figure' }, color: '#59606e', color2: '#c9cede', weight: 'medium', shape: 'capsule', scale: 1, placeholder: true },
];

export const characterById = (id: string) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0]!;

/** Name of a character in the player's language – takes the id or the entry itself. */
export const characterName = (c: CharacterDef | string, locale: 'de' | 'en') =>
  (typeof c === 'string' ? characterById(c) : c).name[locale];

/**
 * Player slot colours (P1..P8) used for HUD frames, lobby seats and result rows. They mirror the
 * first eight roster colours, so the seat colour and the figure a player is most likely holding
 * agree; the list is written out rather than derived so reordering the roster cannot silently
 * repaint every HUD.
 */
export const PLAYER_COLORS = ['#ff4d4d', '#3d8bff', '#3ecf5a', '#ffd23a', '#ff8c1a', '#9c4dff', '#2ad4d4', '#ff6fb5'];
