import type { GameContext, GameInstance, GameModule } from '@pv/game-api';

/**
 * RS Souls – a 2D soulslike in the world of Reinstrom (concept: `plan/14-RSSOULS.md`).
 *
 * Act 1: Rosttal and the Rohrviertel, seventeen rooms, a mid-boss and a boss; plus the training
 * yard. Single player, offline; the campaign saves at every Kollektor and room change.
 */
const rssouls: GameModule = {
  meta: {
    id: 'rssouls',
    title: { de: 'RS Souls', en: 'RS Souls' },
    description: {
      de: 'Ein langsamer, harter Kampf im Rosttal: Telegraf lesen, ausweichen, parieren, zuschlagen.',
      en: 'A slow, hard fight in the Rosttal: read the tell, dodge, parry, strike.',
    },
    minPlayers: 1,
    maxPlayers: 1,
    online: false,
    thumbnail: '🗡️',
    tagline: { de: 'Lesen, ausweichen, zuschlagen', en: 'Read, dodge, strike' },
    accent: '#c8692f',
    preview: async () => (await import('./render/preview')).rssoulsPreview(),
    controls: [
      { action: { de: 'Laufen', en: 'Move' }, keyboard1: 'A / D', keyboard2: '← / →', gamepad: 'Stick' },
      { action: { de: 'Springen', en: 'Jump' }, button: 'a', keyboard1: 'Leertaste', keyboard2: 'Enter', gamepad: 'A' },
      { action: { de: 'Rolle', en: 'Roll' }, button: 'b', keyboard1: 'Shift', keyboard2: 'Shift rechts', gamepad: 'B' },
      { action: { de: 'Schlag (halten: Ladung)', en: 'Strike (hold: charge)' }, button: 'x', mouse: true, keyboard1: 'E oder Linksklick', keyboard2: '-', gamepad: 'X' },
      { action: { de: 'Blocken / Parieren', en: 'Block / parry' }, button: 'r', mouse: true, keyboard1: 'C oder Rechtsklick', keyboard2: 'Num 0', gamepad: 'RB / RT' },
      { action: { de: 'Benutzen / Fähigkeit', en: 'Use / skill' }, button: 'y', keyboard1: 'Q', keyboard2: '.', gamepad: 'Y' },
      { action: { de: 'Glut-Ampulle', en: 'Glut flask' }, button: 'l', keyboard1: 'F', keyboard2: ',', gamepad: 'LB / LT' },
      { action: { de: 'Waffe wechseln (tippen) / Karte (halten)', en: 'Swap weapon (tap) / map (hold)' }, button: 'select', keyboard1: 'R', keyboard2: '\\', gamepad: 'Select' },
      { action: { de: 'Pause', en: 'Pause' }, button: 'start', keyboard1: 'Tab', keyboard2: 'Backspace', gamepad: 'Start' },
    ],
    modes: [
      {
        id: 'campaign',
        title: { de: 'Akt 1 – Fortsetzen', en: 'Act 1 – Continue' },
        description: {
          de: 'Rosttal und Rohrviertel. Setzt am letzten Kollektor fort, sonst beginnt die Reise am Markt.',
          en: 'Rosttal and the Pipe Quarter. Continues at the last Collector, otherwise starts at the market.',
        },
      },
      {
        id: 'newgame',
        title: { de: 'Akt 1 – Neu beginnen', en: 'Act 1 – New game' },
        description: { de: 'Löscht den Spielstand und beginnt am Markt.', en: 'Deletes the save and starts at the market.' },
      },
      {
        id: 'run',
        title: { de: 'Würfel-Lauf', en: 'Dice run' },
        description: {
          de: 'Fünfzehn Räume aus dem Würfelbecher, drei Bosse. Gleiche Saat, gleicher Lauf. 15–30 Minuten.',
          en: 'Fifteen rooms from the dice cup, three bosses. Same seed, same run. 15–30 minutes.',
        },
      },
      {
        id: 'daily',
        title: { de: 'Tages-Lauf', en: 'Daily run' },
        description: { de: 'Ein fester Würfel-Lauf pro Tag – für alle derselbe.', en: 'One fixed dice run per day – the same for everyone.' },
      },
      {
        id: 'training',
        title: { de: 'Kollektor-Hof (Training)', en: 'Collector Yard (training)' },
        description: {
          de: 'Ein Raum, Rost-Spinner: das Kampfgefühl prüfen. Gegner kehren zurück.',
          en: 'One room, rust spinners: try the feel of the fight. Enemies come back.',
        },
      },
    ],
    sandbox: {
      groups: [
        {
          title: { de: 'Training und Hilfen', en: 'Training and aids' },
          fields: [
            { key: 'enemyCount', label: { de: 'Rost-Spinner gleichzeitig', en: 'Rust spinners at once' }, type: 'number', min: 1, max: 3, step: 1, default: 1 },
            { key: 'kills', label: { de: 'Ende nach Siegen (0 = nie)', en: 'End after kills (0 = never)' }, type: 'number', min: 0, max: 30, step: 1, default: 0 },
            { key: 'slowmo', label: { de: 'Zeitlupe (1 = normal)', en: 'Slow motion (1 = normal)' }, type: 'number', min: 0.25, max: 1, step: 0.05, default: 1 },
            { key: 'infiniteBreath', label: { de: 'Unendlich Atem', en: 'Infinite breath' }, type: 'bool', default: false },
            { key: 'showBoxes', label: { de: 'Trefferzonen zeigen', en: 'Show hitboxes' }, type: 'bool', default: false },
            { key: 'heroRig', label: { de: 'Held als Rig (Probe)', en: 'Hero as rig (preview)' }, type: 'bool', default: false },
          ],
        },
      ],
      presets: [
        { id: 'rudel', title: { de: 'Rudel', en: 'Pack' }, values: { enemyCount: 3 } },
        { id: 'lernen', title: { de: 'Lernen', en: 'Learn' }, values: { slowmo: 0.5, showBoxes: true } },
      ],
    },
  },
  /** Loaded on demand: the hub imports every game's `index.ts` up front to build its menu. */
  async mount(ctx: GameContext): Promise<GameInstance> {
    const { RsSoulsGame } = await import('./RsSoulsGame');
    const game = new RsSoulsGame(ctx);
    await game.init();
    return game;
  },
};

export default rssouls;
