import { h } from 'preact';
import type { Signal } from '@preact/signals';
import { Rng, SAMPLE_WAIT_MS, Shake, clamp, disposeObject, type PlayerInput } from '@pv/engine';
import { rule, type GameContext, type GameExit, type GameInstance, type I18n, type PlayerIndex } from '@pv/game-api';
import { Sim, type SimConfig } from './core/sim';
import { NO_COMMAND, SKILL2_STAGE, type Command } from './core/types';
import { hasFlag, levelCost, newProgress, nextGrade, readProgress, upgradeCost, type Progress, type Stat } from './core/progress';
import { HeroBot } from './ai/heroBot';
import { FEEL, SURVIVOR } from './data/feel';
import { ROST_KLINGE, WEAPON_BY_ID } from './data/weapons';
import { ENEMY_BY_ID } from './data/enemies';
import { TRAINING } from './data/rooms';
import { CAMPAIGN_GOAL, REINSTROM } from './data/world';
import { dailySeed, makeRun, runGoal } from './data/run';
import { MOD_CARDS } from './data/modifiers';
import { CLASSES, FOLKS, META_KEY, SURVIVOR_CLASS, heroOf, newMeta, unlockText, unlocked, type Meta } from './data/heroes';
import type { MenuItem as PickItem } from './ui/Hud';

/** One choice before the start: a title and options; `take` applies the chosen one. */
interface Pick {
  title: I18n;
  items: () => PickItem[];
  take(i: number): void;
}
import { AREAS, BOSS_LINES, SIGNS, SKILL_NAMES, TEXT, WEAPON_NAMES, deathText, itemText } from './data/strings';
import { SceneView } from './render/Scene';
import { RSS_HUD_CSS, RsSoulsHud, newHud, type HudData, type MapView, type MenuItem } from './ui/Hud';
import { layoutMap, type MapLayout } from './ui/map';
import { RSS_SFX } from './sfx';
import { Ambience } from './ambience';

/** Where the campaign is kept between sessions. */
export const SAVE_KEY = 'rssouls:progress';

/**
 * Samples from the shared library (`public/assets/generated/sfx`) for the sounds of the fight;
 * the ZzFX presets in sfx.ts stay as the fallback. Deliberately not used: `die`, `jump`, `hurt`
 * and `pickup` there are cartoon takes (slide whistle, boing) that break Reinstrom's tone.
 */
const SAMPLE_OF: Record<string, string> = {
  rssSwing: 'swing_sword',
  rssHit: 'hit_blade',
  rssHeavy: 'clash',
  rssParry: 'parry',
  rssBlock: 'block',
  rssLand: 'land',
  rssEnemyDie: 'body_thud',
  rssGuardBreak: 'break',
};

/** Seconds Select must be held to open the map instead of swapping weapons. */
const MAP_HOLD = 0.3;

/** Which track plays in which area (tools/assets/gen_music_rssouls.sh). */
const AREA_MUSIC: Record<string, string> = {
  rosttal: 'rss_rosttal',
  rohr: 'rss_rohr',
  unter: 'rss_rohr',
  pumpe: 'rss_rohr',
  ader: 'rss_ader',
  wald: 'rss_wald',
  schanze: 'rss_stadt',
  stadt: 'rss_stadt',
  labor: 'rss_labor',
};

type MenuAction =
  | { kind: 'stat'; stat: Stat }
  | { kind: 'smith'; weapon: string }
  | { kind: 'slot2' }
  | { kind: 'travel' }
  | { kind: 'goto'; room: string; id: string }
  | { kind: 'leave' };

/**
 * RS Souls: the hub's side of the game. Turns the pad into commands, plays the sim's events as
 * sound, light and text, runs the rest menu and keeps the save. The fight itself lives in `core/`.
 */
export class RsSoulsGame implements GameInstance {
  readonly onExit: Promise<GameExit>;
  /** Public so `e2e/rssouls.spec.ts` can watch the run through `window.pv.game.value`. */
  sim!: Sim;
  private resolveExit!: (e: GameExit) => void;
  private input: PlayerInput | null;
  private bot: HeroBot | null;
  private view!: SceneView;
  private shake = new Shake();
  private hud!: Signal<HudData>;
  private unmountUi: (() => void) | null = null;
  private styleEl: HTMLStyleElement | null = null;
  private mode: string;
  /** The story campaign (saved); runs and training are not. */
  private campaign: boolean;
  /** A dice run (`run`, `daily`): no save, a seed. */
  private isRun: boolean;
  private runSeed: number;
  /** Simulation speed for the sandbox's slow motion; the engine's own timeScale stays the hub's. */
  private slowmo: number;
  private slowAcc = 0;
  /** A short slow motion after a parry or a boss's fall: seconds left, and how slow. */
  private dramaT = 0;
  private dramaRate = 1;
  private title = '';
  private sub = '';
  private titleKey = 0;
  private toast = '';
  private toastKey = 0;
  private lastSign = '';
  private shownAreas = new Set<string>();
  private menuCursor = 0;
  /** Seconds Select has been held: a tap swaps the weapon, a hold shows the map. */
  private selectT = 0;
  private mapLayout: MapLayout | null = null;
  /** After a menu closes: ignore the pad until the buttons that closed it are let go. */
  private holdOff = false;
  private menuActions: MenuAction[] = [];
  private prevMenuY = 0;
  private saveT = 0;
  private overT = -1;
  private track = '';
  private ambience!: Ambience;
  /** The final boss was ended with the crystal (the purification ending). */
  private endedPure = false;
  /** Choices still to be made before play starts (folk, class, a run's card). */
  private picks: Pick[] = [];
  /** Across all saves: what unlocks classes. */
  private meta: Meta = newMeta();
  private folk = FOLKS[0]!;

  constructor(readonly ctx: GameContext) {
    this.onExit = new Promise((r) => (this.resolveExit = r));
    this.mode = ctx.mode ?? 'campaign';
    this.isRun = this.mode === 'run' || this.mode === 'daily';
    this.campaign = !this.isRun && this.mode !== 'training';
    this.runSeed = this.mode === 'daily' ? dailySeed() : ctx.seed >>> 0;
    this.slowmo = clamp(rule(ctx.rules, 'slowmo', 1), 0.1, 1);
    const p = ctx.players[0];
    this.input = p?.input ?? null;
    this.bot = this.input ? null : new HeroBot();
  }

  private get isTraining() {
    return this.mode === 'training';
  }

  private config(): SimConfig {
    const r = this.ctx.rules;
    const base = {
      hero: SURVIVOR,
      feel: FEEL,
      weapons: WEAPON_BY_ID,
      enemies: ENEMY_BY_ID,
      startWeapon: ROST_KLINGE.id,
      kills: clamp(Math.round(rule(r, 'kills', 0)), 0, 999),
      infiniteStamina: rule(r, 'infiniteBreath', false) as boolean,
    };
    if (this.mode === 'training') {
      return { ...base, level: TRAINING, enemyCount: clamp(Math.round(rule(r, 'enemyCount', 1)), 1, 3), respawnInPlace: true };
    }
    if (this.isRun) {
      const level = makeRun(this.runSeed);
      return { ...base, level, goal: runGoal(level) };
    }
    return { ...base, level: REINSTROM, goal: CAMPAIGN_GOAL };
  }

  async init() {
    const ctx = this.ctx;
    ctx.audio.registerSfx(RSS_SFX);
    // soulslike on the mouse: left click strikes, right click blocks (a binding of the player's own wins)
    ctx.input.mouseDefaults = { x: ['Mouse0'], r: ['Mouse2'] };
    this.ambience = new Ambience(ctx.audio);
    // the fight's samples decode while the loader is still up, not on the first blow
    await ctx.audio.preloadWithin(Object.values(SAMPLE_OF), SAMPLE_WAIT_MS);
    let progress: Progress | undefined;
    if (this.mode === 'campaign') progress = readProgress(await ctx.save.get<unknown>(SAVE_KEY, null)) ?? undefined;
    if (this.mode === 'newgame') await ctx.save.remove(SAVE_KEY);
    // a save from an older layout of the world may name rooms that are gone: start fresh then
    if (progress?.rest && !REINSTROM.rooms[progress.rest.room]) progress = undefined;
    // a finished playthrough continues as the next Glut-Grad
    if (progress && hasFlag(progress, CAMPAIGN_GOAL)) progress = nextGrade(progress);
    this.sim = new Sim(this.config(), ctx.seed >>> 0, progress ?? (this.mode === 'training' ? undefined : newProgress(ROST_KLINGE.id)));

    this.view = new SceneView(this.sim, new Rng((ctx.seed ^ 0x2545f491) >>> 0));
    this.view.showBoxes = rule(ctx.rules, 'showBoxes', false) as boolean;
    // the hero drawn from the Blender rig instead of the painted poses (being built; off by default)
    this.view.useRig(rule(ctx.rules, 'heroRig', false) as boolean, this.sim.hero.body.h);
    ctx.engine.scene.add(this.view.root);
    ctx.engine.setSplitScreen([this.view.camera]);

    this.styleEl = document.createElement('style');
    this.styleEl.textContent = RSS_HUD_CSS;
    document.head.appendChild(this.styleEl);
    this.hud = newHud(this.hudData());
    this.unmountUi = ctx.ui.mount(h(RsSoulsHud, { hud: this.hud }));
    this.meta = { ...newMeta(), ...(await ctx.save.get<Meta>(META_KEY, newMeta())) };
    this.announceRoom(this.sim.room.id);
    this.setupBuild();
    const grade = this.sim.progress.grade ?? 0;
    if (this.campaign && grade > 0) this.say(`${this.t(TEXT.grade)} ${grade}`, this.t(TEXT.gradeRules[grade - 1]!));
    if (this.isRun) {
      // three cards from the run's own seed: the daily run offers everybody the same three
      const rng = new Rng(this.runSeed ^ 0xca4d5);
      const pool = [...MOD_CARDS];
      const cards: typeof MOD_CARDS = [];
      for (let i = 0; i < 3 && pool.length; i++) cards.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!);
      this.picks.push({
        title: { de: 'Wähle eine Karte', en: 'Choose a card' },
        items: () => cards.map((c) => ({ label: this.t(c.name), detail: this.t(c.text), enabled: true })),
        take: (i) => {
          const card = cards[i]!;
          this.sim.addMod(card.mod);
          this.note(`${this.t(card.name)} – ${this.t(card.text)}`);
        },
      });
      this.meta.runs++;
      this.saveMeta();
    }
    this.menuCursor = 0;
    // the demo player takes the first of everything
    if (!this.input) while (this.picks.length) this.takePick(0);
    if (this.isRun) this.say(this.t(this.mode === 'daily' ? TEXT.daily : TEXT.run), `${this.t(TEXT.seed)} ${this.runSeed.toString(36).toUpperCase()}`);
    this.music();
  }

  /** The area's track, the boss track while a boss is awake; only switches when it changes. */
  private music() {
    const boss = this.sim.bossFight();
    this.ambience.set(this.sim.room.theme ?? 'rosttal');
    const name = boss ? (boss.def.id === 'doktor-asche' ? 'rss_finale' : 'rss_boss') : (AREA_MUSIC[this.sim.room.theme ?? 'rosttal'] ?? 'rss_rosttal');
    if (name === this.track) return;
    this.track = name;
    const audio = this.ctx.audio;
    if (audio.hasMusic(name)) void audio.musicNamed(name, { volume: boss ? 0.5 : 0.38, fade: 1.5 });
    else void audio.music(null, { fade: 1.5 });
  }

  // ------------------------------------------------------------------ input

  private command(): Command {
    const i = this.input;
    if (!i) return this.bot ? this.bot.think(this.sim) : NO_COMMAND;
    if (this.sim.hero.state === 'rest') {
      this.menuInput(i);
      return NO_COMMAND;
    }
    if (this.holdOff) {
      if (i.held.a || i.held.b || i.held.y || i.held.x) return NO_COMMAND;
      this.holdOff = false;
    }
    const y = i.held.up ? 1 : i.held.down ? -1 : i.y;
    // Y does double duty: with something to use in reach it uses it, otherwise it is the skill
    const use = !!this.sim.interactable();
    return {
      x: i.x,
      y,
      jump: i.held.a,
      roll: i.held.b,
      attack: i.held.x,
      block: i.held.r,
      interact: use && i.held.y,
      skill: !use && i.held.y,
      heal: i.held.l,
      swap: this.selectTap(i),
    };
  }

  /** Select: a short tap swaps the weapon (on release), holding it opens the map. */
  private selectTap(i: PlayerInput): boolean {
    const tap = i.released.select && this.selectT < MAP_HOLD;
    this.selectT = i.held.select ? this.selectT + 1 / 60 : 0;
    return tap;
  }

  private get mapOpen() {
    return this.selectT >= MAP_HOLD && !!this.input;
  }

  private mapView(): MapView {
    const level = this.sim.cfg.level;
    this.mapLayout ??= layoutMap(level);
    const p = this.sim.progress;
    const seen = (id: string) => hasFlag(p, `seen:${id}`) || id === this.sim.room.id;
    const de = this.ctx.locale === 'de';
    const rooms = Object.values(this.mapLayout.cells)
      .filter((c) => seen(c.id))
      .map((c) => {
        const room = level.rooms[c.id]!;
        const rest = room.props?.some((q) => q.type === 'rest' && hasFlag(p, `lit:${q.id}`)) ?? false;
        const boss = room.enemies.some((e) => this.sim.cfg.enemies[e.kind]?.boss && !hasFlag(p, `boss:${e.kind}@${room.id}`));
        return { x: c.x, y: c.y, here: c.id === this.sim.room.id, rest, cell: p.cell?.room === c.id, boss, name: this.t(AREAS[c.id]?.title ?? { de: c.id, en: c.id }) };
      });
    const links = this.mapLayout.links
      .filter(([a, b]) => seen(a) && seen(b))
      .map(([a, b]) => {
        const ca = this.mapLayout!.cells[a]!;
        const cb = this.mapLayout!.cells[b]!;
        return [ca.x, ca.y, cb.x, cb.y] as [number, number, number, number];
      });
    return {
      title: this.t(AREAS[this.sim.room.id]?.title ?? TEXT.map),
      rooms,
      links,
      legend: de ? 'Grün: hier · Punkt: Kollektor · Raute: Boss · Orange: deine Glut-Zelle' : 'Green: here · dot: Collector · diamond: boss · orange: your Glut cell',
    };
  }

  private menuInput(i: PlayerInput) {
    const n = this.menuActions.length;
    if (!n) return;
    const stickY = i.y > 0.6 ? 1 : i.y < -0.6 ? -1 : 0;
    const upP = i.pressed.up || (stickY === 1 && this.prevMenuY !== 1);
    const downP = i.pressed.down || (stickY === -1 && this.prevMenuY !== -1);
    this.prevMenuY = stickY;
    if (upP) this.menuCursor = (this.menuCursor + n - 1) % n;
    if (downP) this.menuCursor = (this.menuCursor + 1) % n;
    if (i.pressed.b || i.pressed.y) return this.leaveRest();
    if (!i.pressed.a) return;
    const act = this.menuActions[this.menuCursor];
    if (!act) return;
    if (act.kind === 'leave') return this.leaveRest();
    if (act.kind === 'travel') {
      // the list of lit Kollektors replaces the menu; B goes back to the rest
      this.menuActions = [...this.sim.litRests().map((r) => ({ kind: 'goto' as const, ...r })), { kind: 'leave' }];
      this.menuCursor = 0;
      this.refreshHud();
      return;
    }
    if (act.kind === 'goto') {
      if (this.sim.travel(act.room, act.id)) {
        this.snd('rssRest', 0.7);
        this.handleEvents();
        this.openMenu();
        this.save();
      }
      this.refreshHud();
      return;
    }
    if (act.kind === 'stat') {
      if (this.sim.levelUp(act.stat)) {
        this.snd('rssLevel', 0.7);
        this.save();
      } else this.snd('rssBlock', 0.4);
    }
    if (act.kind === 'smith') {
      if (this.sim.upgrade(act.weapon)) {
        this.snd('rssLever', 0.8);
        this.snd('rssLevel', 0.6);
        this.save();
      } else this.snd('rssBlock', 0.4);
    }
    if (act.kind === 'slot2') {
      const p = this.sim.progress;
      const options = [null, ...p.weapons.filter((w) => w !== p.slots[0])];
      const at = options.indexOf(p.slots[1]);
      this.sim.equip(1, options[(at + 1) % options.length] ?? null);
      this.snd('rssSwing', 0.4);
    }
    this.refreshHud();
  }

  /**
   * Folk and class: chosen at a new start (campaign or run), restored from the save otherwise. The
   * training yard keeps the plain survivor.
   */
  private setupBuild() {
    if (this.isTraining) return;
    const p = this.sim.progress;
    const known = p.cls ? CLASSES.find((c) => c.id === p.cls) : undefined;
    const folk = p.folk ? FOLKS.find((f) => f.id === p.folk) : undefined;
    if (known && folk) {
      this.applyBuild(folk.id, known.id);
      return;
    }
    const de = this.ctx.locale === 'de';
    this.picks.push({
      title: { de: 'Wähle dein Volk', en: 'Choose your folk' },
      items: () => FOLKS.map((f) => ({ label: this.t(f.name), detail: this.t(f.text), enabled: true })),
      take: (i) => {
        this.folk = FOLKS[i] ?? FOLKS[0]!;
      },
    });
    this.picks.push({
      title: { de: 'Wähle deine Klasse', en: 'Choose your class' },
      items: () =>
        CLASSES.map((c) => {
          const open = unlocked(c, this.meta);
          return {
            label: `${this.t(c.name)}  ${open ? `${heroOf(c).def.hp}/${c.atem}/${c.dmg}` : ''}`,
            detail: open ? this.t(c.signature) : `${de ? 'gesperrt: ' : 'locked: '}${unlockText(c, de)}`,
            enabled: open,
          };
        }),
      take: (i) => {
        const c = CLASSES[i] && unlocked(CLASSES[i]!, this.meta) ? CLASSES[i]! : SURVIVOR_CLASS;
        this.applyBuild(this.folk.id, c.id);
        this.note(`${this.t(this.folk.name)} · ${this.t(c.name)}`);
      },
    });
  }

  private applyBuild(folkId: string, classId: string) {
    const folk = FOLKS.find((f) => f.id === folkId) ?? FOLKS[0]!;
    const cls = CLASSES.find((c) => c.id === classId) ?? SURVIVOR_CLASS;
    const { def, mod } = heroOf(cls);
    this.sim.progress.folk = folk.id;
    this.sim.progress.cls = cls.id;
    this.sim.setBuild(def, [folk.mod, mod]);
  }

  private saveMeta() {
    void this.ctx.save.set(META_KEY, { ...this.meta });
  }

  private takePick(i: number) {
    const pick = this.picks.shift();
    if (!pick) return;
    pick.take(i);
    this.holdOff = true;
    this.menuCursor = 0;
    if (!this.picks.length) this.save();
    this.refreshHud();
  }

  private pickInput(i: PlayerInput) {
    const pick = this.picks[0];
    const items = pick?.items() ?? [];
    const n = items.length;
    const stickY = i.y > 0.6 ? 1 : i.y < -0.6 ? -1 : 0;
    if (i.pressed.up || (stickY === 1 && this.prevMenuY !== 1)) this.menuCursor = (this.menuCursor + n - 1) % n;
    if (i.pressed.down || (stickY === -1 && this.prevMenuY !== -1)) this.menuCursor = (this.menuCursor + 1) % n;
    this.prevMenuY = stickY;
    if (i.pressed.a && items[this.menuCursor]?.enabled) {
      this.snd('rssLevel', 0.7);
      this.takePick(this.menuCursor);
    }
    this.refreshHud();
  }

  private leaveRest() {
    this.holdOff = true;
    this.sim.leaveRest();
    this.save();
    this.refreshHud();
  }

  // ------------------------------------------------------------------ loop

  update(dt: number) {
    if (this.sim.over) {
      // let the last moment be seen before the results screen
      if (this.overT < 0) this.overT = this.sim.won && !this.isTraining ? 5 : 1.6;
      this.overT -= dt;
      if (this.overT <= 0) this.finish();
      return;
    }
    if (this.picks.length) {
      // play waits for the choices
      if (this.input) this.pickInput(this.input);
      return;
    }
    const cmd = this.command();
    // slow motion steps the sim on a fraction of the engine's ticks, so its dt stays the fixed one
    this.dramaT = Math.max(0, this.dramaT - dt);
    this.slowAcc += this.slowmo * (this.dramaT > 0 ? this.dramaRate : 1);
    if (this.slowAcc < 1) return;
    this.slowAcc -= 1;
    this.sim.step(cmd, dt);
    this.handleEvents();
    if (this.campaign) {
      this.saveT += dt;
      if (this.saveT > 20) this.save();
    }
  }

  private save() {
    this.saveT = 0;
    if (!this.campaign) return;
    void this.ctx.save.set(SAVE_KEY, JSON.parse(JSON.stringify(this.sim.progress)) as Progress);
  }

  private t(s: I18n) {
    return this.ctx.t(s);
  }

  /** A sound by its RS Souls name: the recorded sample if there is one, the preset otherwise. */
  private snd(name: string, volume: number) {
    const sample = SAMPLE_OF[name];
    this.ctx.audio.sfx(sample ?? name, { volume, fallback: name });
  }

  private weaponName(id: string) {
    return WEAPON_NAMES[id] ? this.t(WEAPON_NAMES[id]) : (WEAPON_BY_ID[id]?.name ?? id);
  }

  /** Slows the world for a moment (real seconds, share of normal speed). */
  private drama(seconds: number, rate: number) {
    this.dramaT = Math.max(this.dramaT, seconds);
    this.dramaRate = rate;
  }

  private say(title: string, sub = '') {
    this.title = title;
    this.sub = sub;
    this.titleKey++;
  }

  private note(text: string) {
    this.toast = text;
    this.toastKey++;
  }

  private announceRoom(id: string) {
    const area = AREAS[id];
    if (!area || this.shownAreas.has(id)) return;
    this.shownAreas.add(id);
    this.say(this.t(area.title), area.sub ? this.t(area.sub) : '');
  }

  private handleEvents() {
    const v = this.view;
    const pad = this.input;
    for (const ev of this.sim.events) {
      switch (ev.type) {
        case 'swing':
          if (ev.who === 'hero') this.snd('rssSwing', 0.55);
          else this.snd('rssEnemySwing', 0.35);
          break;
        case 'telegraph':
          this.snd(ev.parryable ? 'rssTell' : 'rssTellRed', 0.45);
          break;
        case 'hit':
          if (ev.target === 'hero') {
            this.snd('rssHurt', 0.8);
            v.burst(ev.x, ev.y, '#ff5a4a', 14, 220);
            pad?.vibrate(90, 0.6);
          } else {
            v.flashEnemy(ev.target);
            this.snd(ev.heavy ? 'rssHeavy' : 'rssHit', 0.8);
            v.burst(ev.x, ev.y, ev.riposte ? '#5dff86' : '#ffb347', ev.heavy ? 22 : 12, ev.heavy ? 320 : 220);
            pad?.vibrate(ev.heavy ? 80 : 40, ev.heavy ? 0.7 : 0.35);
            // screenshake only for the heavy ones (UEBERGABE §6.3): 2–4 px
            if (ev.heavy) this.shake.add(1);
          }
          break;
        case 'blocked':
          this.snd('rssBlock', 0.7);
          v.burst(ev.x, ev.y, '#d8d2c4', 10, 180);
          v.guardHit(false);
          pad?.vibrate(50, 0.4);
          break;
        case 'parry':
          this.snd('rssParry', 0.9);
          this.drama(0.3, 0.35);
          v.guardHit(true);
          v.burst(ev.x, ev.y, '#5dff86', 30, 360);
          pad?.vibrate(70, 0.8);
          this.shake.add(1);
          break;
        case 'guardBreak':
          this.snd('rssGuardBreak', 0.9);
          pad?.vibrate(160, 0.8);
          this.shake.add(0.8);
          break;
        case 'dodge':
          this.snd('rssDodge', 0.4);
          break;
        case 'stagger':
          this.snd('rssStagger', 0.7);
          v.burst(ev.x, ev.y + 20, '#e8c34a', 16, 160, 120);
          break;
        case 'enemyDied':
          this.snd('rssEnemyDie', 0.7);
          v.burst(ev.x, ev.y, '#8a4b2a', 26, 260, 80);
          break;
        case 'reward':
          v.burst(ev.x, ev.y + 10, '#5dff86', 10, 120, 160);
          break;
        case 'heroDied':
          this.drama(0.9, 0.3);
          this.snd('rssDeath', 0.9);
          pad?.vibrate(300, 1);
          this.say(this.t(deathText(ev.cause, !!this.sim.room.heat)));
          break;
        case 'cellDropped':
          this.note(this.t(TEXT.cellDropped));
          break;
        case 'cellLost':
          this.note(this.t(TEXT.cellLost));
          break;
        case 'cellRecovered':
          this.snd('rssPickup', 0.7);
          this.note(`${this.t(TEXT.cellRecovered)} +${ev.amount}`);
          break;
        case 'respawn':
          this.music();
          this.say('', '');
          this.note(this.t(TEXT.respawn));
          this.save();
          break;
        case 'room': {
          const theme = this.sim.room.theme ?? 'rosttal';
          if (!this.isTraining && !this.meta.areas.includes(theme)) {
            this.meta.areas.push(theme);
            this.saveMeta();
          }
          this.announceRoom(ev.room);
          this.music();
          if (this.sim.room.deadZone && this.sim.progress.flags.includes('korro')) this.note(this.t(TEXT.korro));
          this.save();
          break;
        }
        case 'rest':
          this.snd('rssRest', 0.7);
          if (ev.first) this.say(this.t(TEXT.restFirst));
          this.openMenu();
          this.save();
          break;
        case 'heal':
          this.snd('rssHeal', 0.6);
          v.burst(this.sim.hero.body.x, this.sim.hero.body.y + 30, '#ff9a5a', 12, 90, 120);
          break;
        case 'pickup':
          this.snd('rssPickup', 0.7);
          this.note(this.fillButtons(this.t(itemText(ev.item))));
          this.save();
          break;
        case 'lever':
          this.snd('rssLever', 0.8);
          this.note(this.t(TEXT.lever));
          this.save();
          break;
        case 'locked':
          this.snd('rssBlock', 0.4);
          this.note(this.t(TEXT.locked));
          break;
        case 'wallBroken':
          this.snd('rssHeavy', 0.9);
          v.burst(ev.x, ev.y, '#8a7458', 30, 300, 100);
          this.shake.add(1);
          this.note(this.t(TEXT.wallBroken));
          break;
        case 'wallHolds':
          this.snd('rssBlock', 0.6);
          this.note(this.t(TEXT.wallHolds));
          break;
        case 'bossAwake':
          this.snd('rssBoss', 0.8);
          {
            const line = BOSS_LINES[this.sim.enemies[ev.enemy]?.def.id ?? ''];
            this.say(ev.name, line ? this.t(line) : '');
          }
          this.music();
          break;
        case 'bossDied': {
          const kind = ev.id.slice(5, ev.id.indexOf('@'));
          if (!this.isTraining && !this.meta.bosses.includes(kind)) {
            this.meta.bosses.push(kind);
            this.saveMeta();
          }
          this.snd('rssBossDie', 1);
          this.drama(1.2, 0.25);
          this.music();
          this.shake.add(1);
          this.say(this.t(TEXT.bossDied));
          this.save();
          break;
        }
        case 'phase':
          this.snd('rssPhase', 0.9);
          this.shake.add(1);
          this.note(this.t(TEXT.phase));
          break;
        case 'wave':
          this.snd('rssPhase', 0.8);
          this.say(`${this.t(TEXT.wave)} ${ev.n}/${ev.of}`);
          break;
        case 'wavesDone':
          this.snd('rssBossDie', 0.8);
          this.say(this.t(TEXT.wavesDone));
          this.save();
          break;
        case 'heat':
          if (ev.heat === 4 || ev.heat === 7 || ev.heat === 9) this.note(this.t(TEXT.heat) + ` ${ev.heat}`);
          break;
        case 'hunter':
          this.snd('rssCall', 0.9);
          this.note(this.t(TEXT.hunter));
          break;
        case 'ended':
          this.endedPure = true;
          this.snd('rssParry', 1);
          this.shake.add(1);
          this.say(this.t(TEXT.ended));
          break;
        case 'call':
          this.snd('rssCall', 0.6);
          break;
        case 'skill':
          this.snd('rssSkill', 0.7);
          break;
        case 'swap':
          this.snd('rssSwing', 0.3);
          break;
        case 'hazard':
          this.snd('rssHiss', 0.6);
          break;
        case 'shot':
          v.burst(ev.x, ev.y, '#6a6a6a', 6, 120);
          break;
        case 'roll':
          this.snd('rssRoll', 0.5);
          break;
        case 'jump':
          this.snd('rssJump', 0.35);
          break;
        case 'land':
          this.snd('rssLand', 0.3);
          break;
        case 'over':
          if (this.sim.won && this.campaign) this.say(this.t(TEXT.over), this.t(this.endedPure ? TEXT.overPure : TEXT.overSub));
          if (this.sim.won && this.isRun) this.say(this.t(TEXT.runOver));
          this.save();
          break;
        default:
          break;
      }
    }
  }

  // ------------------------------------------------------------------ rest menu

  private openMenu() {
    this.menuCursor = 0;
    this.menuActions = [{ kind: 'stat', stat: 'vit' }, { kind: 'stat', stat: 'breath' }, { kind: 'stat', stat: 'power' }];
    for (const w of this.sim.progress.slots) if (w) this.menuActions.push({ kind: 'smith', weapon: w });
    if (this.sim.progress.weapons.length > 1) this.menuActions.push({ kind: 'slot2' });
    if (this.campaign && this.sim.litRests().length > 1) this.menuActions.push({ kind: 'travel' });
    this.menuActions.push({ kind: 'leave' });
    // the demo player does not shop: it gets up again at once
    if (!this.input) this.sim.leaveRest();
  }

  private menu(): HudData['menu'] {
    const pick = this.picks[0];
    if (pick && this.input) {
      const de = this.ctx.locale === 'de';
      const a = this.ctx.input.buttonHintFor(this.input, 'a', this.ctx.locale);
      return { title: this.t(pick.title), items: pick.items(), cursor: this.menuCursor, footer: `${a} ${de ? 'nehmen' : 'take'}` };
    }
    if (this.sim.hero.state !== 'rest' || !this.input) return null;
    if (!this.menuActions.length) this.openMenu();
    const p = this.sim.progress;
    const cost = levelCost(p);
    const items: MenuItem[] = this.menuActions.map((a) => {
      if (a.kind === 'stat') {
        const name = this.t(TEXT[a.stat]);
        return { label: `${name}  ${p.levels[a.stat]}`, detail: `${cost} Glut`, enabled: p.currency >= cost };
      }
      if (a.kind === 'smith') {
        const name = this.weaponName(a.weapon);
        const stage = p.upgrades?.[a.weapon] ?? 0;
        const c = upgradeCost(p, a.weapon);
        if (!c) return { label: `${this.t(TEXT.smith)}: ${name} +${stage}`, detail: this.t(TEXT.maxed), enabled: false };
        return {
          label: `${this.t(TEXT.smith)}: ${name} +${stage} → +${stage + 1}${stage + 1 === SKILL2_STAGE && WEAPON_BY_ID[a.weapon]?.skill2 ? ` (${this.t(TEXT.skill2Opens)})` : ''}`,
          detail: `${c.currency} Glut · ${c.slag} ${this.t(TEXT.slag)}`,
          enabled: p.currency >= c.currency && (p.slag ?? 0) >= c.slag,
        };
      }
      if (a.kind === 'travel') return { label: this.t(TEXT.travel), detail: `${this.sim.litRests().length}`, enabled: true };
      if (a.kind === 'goto') {
        const here = a.room === this.sim.room.id;
        return { label: this.t(AREAS[a.room]?.title ?? { de: a.room, en: a.room }), detail: here ? this.t(TEXT.here) : '', enabled: !here };
      }
      if (a.kind === 'slot2') {
        const w = p.slots[1] ? this.weaponName(p.slots[1]) : this.t(TEXT.none);
        return { label: this.t(TEXT.slot2), detail: w, enabled: true };
      }
      return { label: this.t(TEXT.leave), detail: '', enabled: true };
    });
    const hint = (b: 'a' | 'b') => this.ctx.input.buttonHintFor(this.input, b, this.ctx.locale);
    const de = this.ctx.locale === 'de';
    return {
      title: this.t(TEXT.menuTitle),
      items,
      cursor: this.menuCursor,
      footer: `${hint('a')} ${de ? 'wählen' : 'choose'} · ${hint('b')} ${de ? 'aufstehen' : 'get up'} · Glut ${p.currency} · ${this.t(TEXT.slag)} ${p.slag ?? 0}`,
    };
  }

  // ------------------------------------------------------------------ HUD

  private fillButtons(s: string): string {
    return s.replace(/\{(\w+)\}/g, (_m, b: string) => this.ctx.input.buttonHintFor(this.input, b as never, this.ctx.locale));
  }

  private prompt(): string {
    if (!this.input) return '';
    const it = this.sim.interactable();
    const de = this.ctx.locale === 'de';
    const y = this.ctx.input.buttonHintFor(this.input, 'y', this.ctx.locale);
    if (it) {
      const what = { rest: de ? 'Rasten' : 'Rest', lever: de ? 'Hebel ziehen' : 'Pull lever', door: de ? 'Durchgehen' : 'Go through', locked: de ? 'Verriegelt' : 'Locked', end: de ? 'Den Kristall werfen' : 'Throw the crystal' }[it.kind];
      return it.kind === 'locked' ? what : `${y} ${what}`;
    }
    const sign = this.sim.signNear();
    if (sign && SIGNS[sign]) return this.fillButtons(this.t(SIGNS[sign]));
    return '';
  }

  private hudData(): HudData {
    const { hero, progress } = this.sim;
    const de = this.ctx.locale === 'de';
    const boss = this.sim.bossFight();
    const ward = hero.wardT > 0 ? `${this.t(SKILL_NAMES.rostwand!)} ${Math.ceil(hero.wardT)} s` : '';
    const status = [hero.tarT > 0 ? (de ? 'Verklebt' : 'Tarred') : '', hero.burnT > 0 ? (de ? 'Brennt' : 'Burning') : '', ward].filter(Boolean).join(' · ');
    const skillName = (id: string) => this.t(SKILL_NAMES[id] ?? { de: id, en: id });
    const weapons = hero.weapons.flatMap((w, i) => {
      if (!w) return [];
      const stage = progress.upgrades?.[w.id] ?? 0;
      // the second ability shows once it is open, with its own cooldown
      const two = w.skill2 && stage >= SKILL2_STAGE ? ` · ↑ ${skillName(w.skill2.id)}${(hero.skillCd[`${w.id}#2`] ?? 0) > 0 ? ` ${Math.ceil(hero.skillCd[`${w.id}#2`] ?? 0)} s` : ''}` : '';
      return [{ name: `${this.weaponName(w.id)}${stage ? ` +${stage}` : ''}`, active: i === hero.slot, skill: w.skill ? skillName(w.skill.attack.id) + two : '', ready: hero.skillCd[w.id] ?? 0 }];
    });
    return {
      hp: hero.hp,
      hpMax: hero.maxHp,
      stamina: hero.stamina,
      staminaMax: hero.maxStamina,
      flasks: hero.flasks,
      flasksMax: hero.flasksMax,
      currency: progress.currency,
      riposte: hero.riposteT > 0,
      status,
      weapons,
      boss: boss ? { name: boss.def.name, hp: boss.hp, max: boss.maxHp } : null,
      heat: this.sim.room.heat ? this.sim.heat : -1,
      title: this.title,
      sub: this.sub,
      titleKey: this.titleKey,
      toast: this.toast,
      toastKey: this.toastKey,
      prompt: this.prompt(),
      kills: !this.isTraining ? '' : `${de ? 'Besiegt' : 'Defeated'}: ${progress.kills}${this.sim.cfg.kills > 0 ? ` / ${this.sim.cfg.kills}` : ''}`,
      hints: this.input ? '' : de ? 'Vorführung' : 'Demo',
      menu: this.menu(),
      map: this.mapOpen ? this.mapView() : null,
      labels: de ? { hp: 'Leben', stamina: 'Atem', currency: 'Glut' } : { hp: 'Life', stamina: 'Breath', currency: 'Glut' },
    };
  }

  private refreshHud() {
    this.hud.value = this.hudData();
  }

  render(alpha: number, dt: number) {
    this.shake.update(dt);
    this.view.update(this.sim, alpha, dt, { x: this.shake.x * 24, y: this.shake.y * 24 });
    // a new sign under the feet shows at once, the rest a few times a second
    const sign = this.sim.signNear() ?? '';
    if (sign !== this.lastSign) {
      this.lastSign = sign;
      this.refreshHud();
      return;
    }
    if ((this.ctx.engine.frame & 3) !== 0) return;
    this.ambience.tick();
    this.refreshHud();
  }

  private finish() {
    if (this.overT === -999) return;
    this.overT = -999;
    const de = this.ctx.locale === 'de';
    const seat = (this.ctx.players[0]?.index ?? 0) as PlayerIndex;
    const p = this.sim.progress;
    const min = Math.floor(p.time / 60);
    const lines: Record<number, string> = {
      [seat]: this.campaign || this.isRun
        ? `${min} min · ${p.deaths} ${de ? 'Tode' : 'deaths'} · ${p.kills} ${de ? 'besiegt' : 'defeated'}`
        : `${p.kills} ${de ? 'besiegt' : 'defeated'} · ${p.deaths} ${de ? 'Tode' : 'deaths'}`,
    };
    this.resolveExit({
      reason: 'finished',
      results: { placements: [[seat]], lines: lines as never, title: this.campaign ? TEXT.over : this.isRun ? TEXT.runOver : { de: 'Kollektor-Hof', en: 'Collector Yard' } },
    });
  }

  dispose() {
    this.ctx.input.mouseDefaults = null;
    this.save();
    this.ctx.audio.stopMusic();
    this.ambience.dispose();
    this.unmountUi?.();
    this.styleEl?.remove();
    this.view.dispose();
    disposeObject(this.view.root);
    this.ctx.engine.clearViewports();
  }
}
