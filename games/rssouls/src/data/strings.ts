import type { I18n } from '@pv/game-api';

/**
 * Short texts in the world (UEBERGABE §10): area titles on entering, signs as a silent tutorial,
 * item texts, death texts. Direct, never longer than a breath. `{x}` placeholders are filled with
 * the player's own button names by the game class.
 */

export interface AreaText {
  title: I18n;
  sub?: I18n;
}

/** Shown when a room of a new area is entered. Rooms without an entry belong to the area before. */
export const AREAS: Record<string, AreaText> = {
  'kollektor-hof': { title: { de: 'Rosttal · Kollektor-Hof', en: 'Rosttal · Collector Yard' }, sub: { de: '„Wer Lumen hat, kriegt Licht.“', en: '“Who has Lumen gets light.”' } },
  markt: { title: { de: 'Rosttal', en: 'Rosttal' }, sub: { de: '„Wer Lumen hat, kriegt Licht.“', en: '“Who has Lumen gets light.”' } },
  gasse: { title: { de: 'Seitengasse', en: 'Side Lane' } },
  hof: { title: { de: 'Kollektor-Hof', en: 'Collector Yard' } },
  dach: { title: { de: 'Dachweg', en: 'Roof Path' }, sub: { de: 'Je höher man steigt, desto dünner wird der Ruß.', en: 'The higher you climb, the thinner the soot.' } },
  speicher: { title: { de: 'Speicherhof', en: 'Storage Yard' } },
  nische: { title: { de: 'Brinas Nische', en: "Brina's Niche" } },
  schrott: { title: { de: 'Schrottplatz', en: 'Scrapyard' } },
  truemmer: { title: { de: 'Trümmerfeld 7', en: 'Debris Field 7' }, sub: { de: 'Etwas summt unter dem Schrott.', en: 'Something hums under the scrap.' } },
  yara: { title: { de: 'Yaras Unterschlupf', en: "Yara's Hideout" } },
  'rohr-eingang': { title: { de: 'Rohrviertel', en: 'Pipe Quarter' }, sub: { de: '„Alles hier führt irgendwohin zurück.“', en: '“Everything here leads back somewhere.”' } },
  gassen: { title: { de: 'Gassen', en: 'Alleys' } },
  schwarzmarkt: { title: { de: 'Vex’ Werkstatt', en: "Vex's Workshop" } },
  unterrohre: { title: { de: 'Unterrohre', en: 'Underpipes' }, sub: { de: '„Unter dem Viertel läuft, was oben abgestellt wurde.“', en: '“Under the quarter runs what was dumped above.”' } },
  pumpstation: { title: { de: 'Pumpstation', en: 'Pumping Station' } },
  kontrollposten: { title: { de: 'Kontrollposten', en: 'Checkpoint' } },
  'verwerter-arena': { title: { de: 'Verwertung', en: 'Processing' } },
  'unterrohre-ende': { title: { de: 'Unter dem Markt', en: 'Under the Market' } },
  masten: { title: { de: 'Schwarze Ader', en: 'The Black Vein' }, sub: { de: 'Ein Mund, aus dem die Nacht selbst quillt.', en: 'A mouth from which night itself wells up.' } },
  baumring: { title: { de: 'Versteinerter Baumring', en: 'Petrified Ring' }, sub: { de: 'Tote Zone', en: 'Dead zone' } },
  tuempel: { title: { de: 'Stiller Tümpel', en: 'Still Pool' } },
  'ader-rast': { title: { de: 'Ader-Rast', en: 'Vein Rest' } },
  schlund: { title: { de: 'Der Schlund', en: 'The Maw' } },
  steg: { title: { de: 'Ader-Steg', en: 'Vein Bridge' } },
  fluesterwald: { title: { de: 'Der Weg nach Ascheburg', en: 'The Road to Ascheburg' }, sub: { de: 'Flüsterwald – zum ersten Mal wieder reines Licht.', en: 'Whispering Wood – pure light, for the first time again.' } },
  lichtquell: { title: { de: 'Lichtquell', en: 'Lightspring' } },
  'schanze-weg': { title: { de: 'Weg zur Rauchschanze', en: 'Road to the Smoke Redoubt' } },
  schmuggler: { title: { de: 'Brinas Pfad', en: "Brina's Path" } },
  rauchschanze: { title: { de: 'Rauchschanze', en: 'Smoke Redoubt' } },
  maut: { title: { de: 'Tote Zone unter der Maut', en: 'Dead Zone under the Toll' } },
  tor: { title: { de: 'Ascheburg-Tor', en: 'Ascheburg Gate' }, sub: { de: 'Die Stadt ist schön. Die Brunnen hängen am Netz.', en: 'The city is beautiful. The fountains hang on the grid.' } },
  daecher: { title: { de: 'Ascheburg', en: 'Ascheburg' }, sub: { de: '„Die Stadt hat zehn Gesichter, und keins wartet auf dich.“', en: '“The city has ten faces, and none waits for you.”' } },
  verwaltung: { title: { de: 'Verwaltungskern', en: 'Administrative Core' } },
  arbeiter: { title: { de: 'Funkengeborene-Arbeiterviertel', en: 'Sparkborn Quarter' } },
  forschung: { title: { de: 'Sektor Forschung', en: 'Research Sector' } },
  archiv: { title: { de: 'Archiv', en: 'Archive' } },
  umspannwerk: { title: { de: 'Hauptumspannwerk', en: 'Main Substation' } },
  zugang: { title: { de: 'Unter der Stadt', en: 'Beneath the City' }, sub: { de: 'Wer hineingeht, kommt als Sieger heraus – oder gar nicht.', en: 'Whoever goes in comes out victorious – or not at all.' } },
  gang: { title: { de: 'Gang', en: 'Corridor' } },
  kesselraum: { title: { de: 'Kesselraum', en: 'Boiler Room' } },
  schmiede: { title: { de: 'Schmiede', en: 'Forge' } },
  kuehlung: { title: { de: 'Kühlsektion', en: 'Cooling Section' } },
  pods: { title: { de: 'Archiv der Subjekte', en: 'Archive of Subjects' } },
  reanimation: { title: { de: 'Reanimations-Kammer', en: 'Reanimation Chamber' } },
  labor: { title: { de: 'Labor', en: 'Laboratory' } },
};

/** Signs: the silent tutorial and the voices of the world. */
export const SIGNS: Record<string, I18n> = {
  move: { de: '{a} springen. Halten springt höher.', en: '{a} jumps. Hold to jump higher.' },
  attack: { de: '{x} schlägt. Achte auf das Aufblitzen, bevor sie zubeißen.', en: '{x} strikes. Watch for the flash before they bite.' },
  roll: { de: '{b} rollt – durch den Schlag hindurch, nicht davon weg.', en: '{b} rolls – through the blow, not away from it.' },
  rest: { de: 'Am Kollektor {y}: rasten. Heilt, füllt Ampullen. Die Gegner kehren zurück.', en: 'At a Collector {y}: rest. Heals, refills flasks. Enemies return.' },
  skill: { de: '{l} trinkt eine Glut-Ampulle. {y} (abseits von Dingen): Waffen-Fähigkeit.', en: '{l} drinks a Glut flask. {y} (away from things): weapon skill.' },
  abk: { de: 'Verriegelt. Von der anderen Seite.', en: 'Locked. From the other side.' },
  plunge: { de: 'Von oben trifft man, wo kein Schild ist. (in der Luft: unten + {x})', en: 'From above you hit where no shield is. (mid-air: down + {x})' },
  wall: { de: 'Dünnes Wellblech. Ein schwerer Schlag (halten) bricht es.', en: 'Thin sheet metal. A heavy blow (hold) breaks it.' },
  valve: { de: 'Die Ventile atmen im Takt. Warte auf die Pause.', en: 'The valves breathe in rhythm. Wait for the pause.' },
  parry: { de: '{r} im letzten Moment: Parieren. Weiße Raute: parierbar. Rote: ausweichen.', en: '{r} at the last moment: parry. White diamond: parry. Red: dodge.' },
  brina: { de: 'Brina: „Was du hier findest, hast du nicht von mir.“', en: 'Brina: “What you find here, you did not get from me.”' },
  yara: { de: 'Yara: „Wer das Licht besitzt, braucht keine Mauern. Wer es nicht besitzt, baut welche.“', en: 'Yara: “Who owns the light needs no walls. Who does not, builds them.”' },
  rohrtor: { de: 'Das Rohrtor. Von hier aus verklemmt.', en: 'The pipe gate. Stuck from this side.' },
  rohr: { de: 'NEBELWERK-Wachen gehen zu zweit. Ruft eine, kommt die andere.', en: 'NEBELWERK guards walk in pairs. If one calls, the other comes.' },
  gassen: { de: 'Oben: Vex. Unten: die Unterrohre.', en: 'Up: Vex. Down: the Underpipes.' },
  vex: { de: 'Vex: „Die Ader frisst Licht. Nimm den Dolch – schnell ist besser als stark, wenn du parierst.“', en: 'Vex: “The vein eats light. Take the dagger – quick beats strong when you parry.”' },
  unter: { de: 'Teer verklebt die Rolle. Parier den Klumpen zurück.', en: 'Tar glues your roll. Parry the glob back.' },
  boss: { de: 'Dahinter arbeitet der Verwerter. Rücken und Kopf sind seine Schwäche.', en: 'Beyond, the Processor works. Its back and head are its weakness.' },
  ende: { de: 'Der Hebel öffnet das Rohrtor. Der Weg nach Rosttal ist kurz.', en: 'The lever opens the pipe gate. The way to Rosttal is short.' },
  ader: { de: 'Sensoren orten reines Licht. Drohnen rufen, wenn sie dich sehen.', en: 'Sensors track pure light. Drones call when they see you.' },
  tot: { de: 'Tote Zone: Hier bricht die Magie zusammen. keine Fähigkeiten, langsamer Atem – außer man trägt reines Licht.', en: 'Dead zone: magic collapses here. No skills, slow breath – unless you carry pure light.' },
  tuempel: { de: 'Ein schwarzer Tümpel, der nichts spiegelt. Wer dort gräbt, weckt etwas.', en: 'A black pool that reflects nothing. Whoever digs there wakes something.' },
  riss: { de: 'Kommandantin Riss sichert die Ader. Sie pariert man – ihre Waffe nicht.', en: 'Commander Riss guards the vein. Parry her blade – not her gun.' },
  steg: { de: 'Die Ader liegt offen. Licht verletzt sie. Das ist der Beweis.', en: 'The vein lies open. Light wounds it. That is the proof.' },
  wald: { de: 'Reines Licht: der Atem kommt schneller, Fähigkeiten laden schneller.', en: 'Pure light: breath returns faster, skills recharge faster.' },
  juno: { de: 'Juno: „Korro singt. Hörst du es? Der Wald antwortet.“', en: 'Juno: “Korro sings. Do you hear it? The wood answers.”' },
  kern: { de: 'Der Runen-Kern. Wer ihn trägt, ist Verwahrer, nicht Besitzer. Juno nimmt ihn mit nach Ascheburg.', en: 'The rune core. Whoever carries it is a keeper, not an owner. Juno takes it to Ascheburg.' },
  brina2: { de: 'Brina: „Ohne Passierschein kommst du nicht durch die Schanze. Komm rein.“', en: 'Brina: “Without a pass you won’t get through. Come in.”' },
  brina3: { de: 'Brina: „Der Schein ist echt genug. Frag nicht, woher.“', en: 'Brina: “The pass is real enough. Don’t ask where from.”' },
  schranke: { de: 'Kontrolle. Ohne Passierschein kein Durchgang.', en: 'Checkpoint. No pass, no passage.' },
  stadt: { de: 'Glas, Licht, Kontrolle. Die Dächer sind der ruhigste Weg.', en: 'Glass, light, control. The roofs are the quiet way.' },
  heat: { de: 'In den Bezirken zählt jeder Kampf: Heat. Ab 4 Eliten, ab 7 ein Jäger. Am Kollektor kühlt es ab.', en: 'In the districts every fight counts: Heat. From 4 elites, from 7 a hunter. A Collector cools it.' },
  selin: { de: 'Selin: „NEBELWERK sorgt für Sicherheitsnebel. Atmen Sie ruhig.“', en: 'Selin: “NEBELWERK provides safety fog. Breathe calmly.”' },
  funken: { de: 'Die Funkengeborenen halten die Stadt am Laufen – ohne Zelle, wenn es sein muss.', en: 'The Sparkborn keep the city running – without a cell, if they must.' },
  ilv: { de: 'Ilv: „Asche hat alles aufgeschrieben. Wer das Netz mit reinem Licht flutet, flutet auch uns.“', en: 'Ilv: “Asche wrote it all down. Whoever floods the grid with pure light floods us too.”' },
  umspann: { de: 'Juno koppelt den Kern an das Netz. Das Reinigungs-Protokoll wird anspringen.', en: 'Juno couples the core to the grid. The purification protocol will wake.' },
  sahl: { de: 'Sahl, der Mechaniker: „Sie hat sie nicht alle retten können. Sie hat es versucht.“', en: 'Sahl, the mechanic: “She could not save them all. She tried.”' },
  wahl: { de: 'Links die Schmiede: kurz und hart. Rechts die Kühlsektion: lang und still.', en: 'Left the forge: short and hard. Right the cooling section: long and quiet.' },
  gewalt: { de: 'Der Gewalt-Pfad. Kein Weg zurück, nur nach vorn.', en: 'The path of force. No way back, only forward.' },
  rill: { de: 'Rill, die Archivarin: „Jede Probe hier war ein Mensch.“', en: 'Rill, the archivist: “Every sample here was a person.”' },
  kuehl: { de: 'Hinten in der Kühlung liegt etwas, das reines Licht hält.', en: 'Deep in the cooling lies something that holds pure light.' },
  gemaelde: { de: 'Ein Wandgemälde: Licht der Erde, die Schwarzen Adern, der Krieg, der Kern. Und eine Frau mit Kittel, die zusieht.', en: 'A mural: the Light of the Earth, the Black Veins, the war, the core. And a woman in a coat, watching.' },
  varrek: { de: 'Varrek, die Wache: „Geh nicht hinein. Oder geh – und bring es zu Ende.“', en: 'Varrek, the guard: “Don’t go in. Or go – and end it.”' },
};

/** A line when a boss wakes (UEBERGABE §4): the voices of the story, short. */
export const BOSS_LINES: Record<string, I18n> = {
  'schrott-golem': { de: 'Er bewacht die Pumpen, als gehörten sie ihm.', en: 'It guards the pumps as if they were its own.' },
  'verwerter-konstrukt': { de: '„VERARBEITUNG BEGINNT.“', en: '“PROCESSING BEGINS.”' },
  'kommandantin-riss': { de: 'Riss: „Für Yaras Bruder hat sich niemand interessiert. Für dich auch nicht.“', en: 'Riss: “Nobody cared about Yara’s brother. Nobody cares about you.”' },
  'oel-leviathan': { de: 'Der Tümpel spiegelt nichts. Jetzt hat er Zähne.', en: 'The pool reflects nothing. Now it has teeth.' },
  'sezier-golem': { de: 'Asches Stimme: „Das Lied der Drohne. Ich muss es hören. Bring sie mir.“', en: 'Asche’s voice: “The drone’s song. I must hear it. Bring it to me.”' },
  exponat: { de: 'Asches Stimme: „Mein zweiter Versuch. Er war nicht freiwillig.“', en: 'Asche’s voice: “My second attempt. It was not voluntary.”' },
  schwarzkittel: { de: '„KERN AM NETZ. REINIGUNGS-PROTOKOLL AKTIV.“', en: '“CORE ON GRID. PURIFICATION PROTOCOL ACTIVE.”' },
  'doktor-asche': { de: 'Asche: „Ich konnte sie nicht alle retten. Vielleicht wenigstens dich – für die Forschung.“', en: 'Asche: “I could not save them all. Perhaps at least you – for research.”' },
};

/** Weapon names for the screen (the data keeps the German one as its id-like name). */
export const WEAPON_NAMES: Record<string, I18n> = {
  'rost-klinge': { de: 'Rost-Klinge', en: 'Rust Blade' },
  'verwerter-hammer': { de: 'Verwerter-Hammer', en: 'Processor Hammer' },
  'lumen-dolch': { de: 'Lumen-Dolch', en: 'Lumen Dagger' },
};

export const SKILL_NAMES: Record<string, I18n> = {
  'rost-splitter': { de: 'Rost-Splitter', en: 'Rust Shards' },
  schlagwelle: { de: 'Schlagwelle', en: 'Shockwave' },
  'licht-schnitt': { de: 'Licht-Schnitt', en: 'Light Cut' },
  rostwand: { de: 'Rostwand', en: 'Rust Wall' },
  bodenbrecher: { de: 'Bodenbrecher', en: 'Groundbreaker' },
  lichtfaecher: { de: 'Lichtfächer', en: 'Light Fan' },
};

/** Item texts: what a pick-up is, in one line (Tunic principle). */
export function itemText(item: string): I18n {
  const [kind, arg] = item.split(':');
  if (kind === 'flask') return { de: 'Ampullen-Splitter. Eine Glut-Ampulle mehr.', en: 'Flask shard. One more Glut flask.' };
  if (kind === 'slag') return { de: `Schlacke ×${arg ?? 1}. Am Kollektor wird daraus eine bessere Klinge.`, en: `Slag ×${arg ?? 1}. At a Collector it becomes a better blade.` };
  if (kind === 'currency') return { de: `Eine Glut-Zelle: ${arg} Glut.`, en: `A Glut cell: ${arg} Glut.` };
  if (kind === 'weapon' && arg === 'verwerter-hammer') return { de: 'Verwerter-Hammer. „Zwei Schläge leeren den Atem. Der dritte kommt nicht.“', en: 'Processor Hammer. “Two blows empty the breath. The third never comes.”' };
  if (kind === 'weapon' && arg === 'lumen-dolch') return { de: 'Lumen-Dolch. „Zweimal zustechen, bevor der Rost einmal fällt.“', en: 'Lumen Dagger. “Stab twice before the rust falls once.”' };
  if (kind === 'flag' && arg === 'korro') return { de: 'Korro – eine kaputte Drohne mit einer reinen Zelle. Sie summt ein altes Lied.', en: 'Korro – a broken drone with a pure cell. It hums an old song.' };
  if (kind === 'ability' && arg === 'doppelsprung') return { de: 'Doppelsprung. Vex’ Federstiefel: in der Luft noch einmal {a}.', en: 'Double jump. Vex’s spring boots: {a} once more mid-air.' };
  if (kind === 'ability' && arg === 'luftdash') return { de: 'Luft-Dash. Das Öl gibt ein Stück Leichtigkeit frei: in der Luft {b}.', en: 'Air dash. The oil lets go of some lightness: {b} mid-air.' };
  if (kind === 'ability' && arg === 'wandsprung') return { de: 'Wandsprung. Gegen eine Wand drücken und {a}.', en: 'Wall jump. Press into a wall and {a}.' };
  if (kind === 'flag' && arg === 'passierschein') return { de: 'Ein Passierschein für die Rauchschanze. Fast echt.', en: 'A pass for the Smoke Redoubt. Almost real.' };
  if (kind === 'flag' && arg === 'kristall') return { de: 'Glut-Resonanz-Kristall. Er hält reines Licht – genug für einen Wurf.', en: 'Glut resonance crystal. It holds pure light – enough for one throw.' };
  if (kind === 'flag' && arg === 'akt1') return { de: 'Das Bild eines Bruders, gestempelt: VERARBEITET.', en: 'A picture of a brother, stamped: PROCESSED.' };
  return { de: item, en: item };
}

export function deathText(cause: string, heat = false): I18n {
  if (heat && cause !== 'fall') return { de: 'In Ascheburg stirbt man zweimal.', en: 'In Ascheburg you die twice.' };
  if (cause === 'fall') return { de: 'In die Tiefe gestürzt. Die Glut bleibt liegen.', en: 'Fell into the depths. The Glut stays behind.' };
  if (cause === 'hazard') return { de: 'Verbrüht. Die Glut bleibt liegen.', en: 'Scalded. The Glut stays behind.' };
  if (cause === 'Doktor Asche') return { de: 'Doktor Asche notiert: Subjekt verstorben.', en: 'Doctor Asche notes: subject deceased.' };
  if (cause === 'Kommandantin Riss') return { de: 'Kommandantin Riss hat dich verarbeitet.', en: 'Commander Riss processed you.' };
  if (cause === 'Verwerter-Konstrukt') return { de: 'Das Verwerter-Konstrukt hat dich zerbrochen.', en: 'The Processor Construct broke you.' };
  return { de: `Von einem ${cause} erschlagen.`, en: `Slain by a ${cause}.` };
}

export const TEXT = {
  respawn: { de: 'Am Kollektor erwacht. Die Gegner sind zurückgekehrt.', en: 'Woke at the Collector. The enemies have returned.' },
  restFirst: { de: 'Kollektor entzündet', en: 'Collector lit' },
  rest: { de: 'Geheilt, Ampullen gefüllt, Gegner sind zurückgekehrt.', en: 'Healed, flasks refilled, enemies have returned.' },
  cellDropped: { de: 'Die Glut bleibt liegen. Ein Versuch, sie zu holen.', en: 'The Glut stays behind. One attempt to recover it.' },
  cellLost: { de: 'Die alte Glut ist erloschen.', en: 'The old Glut has gone out.' },
  cellRecovered: { de: 'Die Glut-Zelle ist sicher.', en: 'The Glut cell is safe.' },
  lever: { de: 'Ein Riegel springt auf. Irgendwo ist ein Weg frei.', en: 'A bolt springs open. Somewhere a way is clear.' },
  wallBroken: { de: 'Das Blech gibt nach.', en: 'The sheet metal gives way.' },
  wallHolds: { de: 'Das Blech hält. Ein schwererer Schlag.', en: 'The sheet holds. A heavier blow.' },
  locked: { de: 'Verriegelt.', en: 'Locked.' },
  bossDied: { de: 'BESIEGT', en: 'VANQUISHED' },
  phase: { de: 'Der Panzer platzt.', en: 'The armour bursts.' },
  wave: { de: 'Failsafe ausgelöst – Welle', en: 'Failsafe triggered – wave' },
  heat: { de: 'Heat steigt:', en: 'Heat rising:' },
  hunter: { de: 'Der Riot-Kommandeur ist auf deiner Spur.', en: 'The Riot Commander is on your trail.' },
  ended: { de: '„Es funktioniert. Endlich.“', en: '“It works. At last.”' },
  wavesDone: { de: 'Der Schlund schweigt.', en: 'The maw falls silent.' },
  korro: { de: 'Korros reine Zelle summt: Hier hält dein Atem.', en: 'Korro’s pure cell hums: your breath holds here.' },
  menuTitle: { de: 'Kollektor', en: 'Collector' },
  vit: { de: 'Vitalität', en: 'Vitality' },
  breath: { de: 'Atem', en: 'Breath' },
  power: { de: 'Kraft', en: 'Power' },
  slot2: { de: 'Zweite Waffe', en: 'Second weapon' },
  smith: { de: 'Schmieden', en: 'Smith' },
  skill2Opens: { de: '2. Fähigkeit', en: '2nd skill' },
  map: { de: 'Karte', en: 'Map' },
  travel: { de: 'Reisen (zu einem Kollektor)', en: 'Travel (to a Collector)' },
  here: { de: 'hier', en: 'here' },
  slag: { de: 'Schlacke', en: 'Slag' },
  maxed: { de: 'vollendet', en: 'perfected' },
  leave: { de: 'Weiter', en: 'Continue' },
  none: { de: '—', en: '—' },
  over: { de: 'Doktor Asche ist gefallen.', en: 'Doctor Asche has fallen.' },
  run: { de: 'Würfel-Lauf', en: 'Dice Run' },
  grade: { de: 'Glut-Grad', en: 'Glut Grade' },
  gradeRules: [
    { de: 'Die Gegner sind zäher.', en: 'Enemies are tougher.' },
    { de: 'Die Kollektoren heilen nur noch zur Hälfte.', en: 'Collectors heal only half.' },
    { de: 'Der Zonenhauch nagt überall am Atem.', en: 'The zone gnaws at your breath everywhere.' },
    { de: 'Nur noch ein Kollektor brennt.', en: 'Only one Collector still burns.' },
  ] as I18n[],
  daily: { de: 'Tages-Lauf', en: 'Daily Run' },
  seed: { de: 'Saat', en: 'Seed' },
  runOver: { de: 'Lauf geschafft', en: 'Run complete' },
  overSub: { de: 'Gewalt-Pfad: Die letzte Glut-Welle bricht. Das Netz gehört jetzt dem, der es trägt – und Juno hat noch nicht gewählt.', en: 'Path of force: the last glut wave breaks. The grid belongs to whoever carries it – and Juno has not chosen yet.' },
  overPure: { de: 'Reinigungs-Pfad: Der Kristall singt in ihren Händen. „Es funktioniert. Endlich.“ Zum ersten Mal seit dem Krieg der Adern ist das Licht frei.', en: 'Path of purification: the crystal sings in her hands. “It works. At last.” For the first time since the War of the Veins the light is free.' },
};
