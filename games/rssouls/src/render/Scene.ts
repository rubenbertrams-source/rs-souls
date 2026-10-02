import * as THREE from 'three';
import { damp, disposeObject, easeInOutCubic, easeOutCubic, ParticlePool, type Rng } from '@pv/engine';
import { bodyRect, type Body } from '../core/body';
import { hitbox, phaseOf, recoveryElapsed, windupOf, type AttackRun } from '../core/attack';
import type { Enemy } from '../core/enemy';
import type { Hero } from '../core/hero';
import type { Sim } from '../core/sim';
import type { AttackDef, PropDef } from '../core/types';
import { hasFlag } from '../core/progress';
import { DEFAULT_STYLE, DEFAULT_THEME, ENEMY_STYLE, THEMES, type EnemyStyle } from './styles';
import { aspect, disposeImages, texture } from './images';
import { HERO_RIG, pickRigFrame } from './heroRig';

/**
 * The placeholder look: flat shapes in an orthographic side view, one world unit per pixel.
 *
 * The room is rebuilt whenever the sim changes rooms; hero, particles and camera persist. A
 * telegraph's marker is white when the attack can be parried and red when it must be dodged.
 * Nothing here feeds back into the sim.
 */

const C = {
  pure: '#5dff86',
  hero: '#d8d2c4',
  heroHurt: '#ff6b5a',
  visor: '#ffb347',
  blade: '#b9c2c9',
  bladeHot: '#ffd27a',
  parryGlint: '#c8ffd8',
  hpBack: '#2a1414',
  hp: '#d0503e',
  poise: '#e8c34a',
  hitbox: '#ff3b3b',
  hurtbox: '#4aa3ff',
  tar: '#1a1a1a',
};

function mat(color: string, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
}

function plane(w: number, h: number, color: string, opacity = 1): THREE.Mesh {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(color, opacity));
}

/** A unit plane anchored at its bottom-left corner, scaled to any rect each frame. */
function unitRect(color: string, opacity: number): THREE.Mesh {
  const g = new THREE.PlaneGeometry(1, 1);
  g.translate(0.5, 0.5, 0);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
}

/**
 * A flat-colour silhouette of a picture, drawn a touch larger behind it: the rim that keeps a dark
 * figure readable on a dark backdrop, and the channel for telegraphs and hit flashes.
 */
function rimMaterial(map: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, color: { value: new THREE.Color('#e8dcc8') }, opacity: { value: 0.3 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:
      'uniform sampler2D map; uniform vec3 color; uniform float opacity; varying vec2 vUv; void main() { float a = texture2D(map, vUv).a; if (a < 0.05) discard; gl_FragColor = vec4(color, a * opacity); }',
    transparent: true,
    depthWrite: false,
  });
}

/** A painted picture standing on its bottom edge, `h` tall; null if the picture does not exist. */
function picture(id: string, h: number): THREE.Mesh | null {
  const tex = texture(id);
  if (!tex) return null;
  const g = new THREE.PlaneGeometry(h * aspect(id), h);
  g.translate(0, h / 2, 0);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, depthWrite: false }));
}

/** The picture a pick-up shows. */
function itemPicture(item: string): THREE.Mesh | null {
  const [kind, arg] = item.split(':');
  if (kind === 'flask') return picture('obj_ampulle', 22);
  if (kind === 'slag') return picture('obj_schlacke', 18);
  if (kind === 'currency') return picture('obj_glutzelle', 24);
  if (kind === 'weapon' && arg) return picture(`wpn_${arg}`, 14);
  if (kind === 'flag' && arg === 'korro') return picture('npc_korro', 20);
  return null;
}

function lerpPos(b: Body, alpha: number) {
  return { x: b.px + (b.x - b.px) * alpha, y: b.py + (b.y - b.py) * alpha };
}

interface HeroView {
  root: THREE.Group;
  body: THREE.Mesh;
  /** Drawn height of the body (the sprite is a bit taller than the hurtbox). */
  h: number;
  sprite: boolean;
  bodyMat: THREE.MeshBasicMaterial;
  bladePivot: THREE.Group;
  blade: THREE.Mesh;
  bladeMat: THREE.MeshBasicMaterial;
  aura: THREE.Mesh;
  flask: THREE.Mesh;
  /** Weapon the blade mesh currently shows (rebuilt on a swap), and whether it is a picture. */
  weaponId: string;
  painted: boolean;
  /** The painted poses (idle, run, attack, block), or null when only one picture exists. */
  poses: Record<string, HeroPose> | null;
  pose: string;
  /** The front fist cut from the pose and drawn again over the grip: the hand closes on the weapon. */
  fist: THREE.Mesh | null;
  /** Where the grip sits in the body plane (its centre is the origin), from the pose. */
  handX: number;
  handY: number;
  /** Shown weapon angle (0 forward, up positive) and grip-to-tip length of the shown weapon. */
  angle: number;
  reach: number;
  /** The attack the swing curve belongs to, and the angle the weapon had when it began. */
  swingRun: AttackRun | null;
  swingFrom: number;
  /** The arc a swing leaves behind the blade, and how strongly it still shows. */
  trail: THREE.Mesh;
  trailGeo: THREE.BufferGeometry;
  trailA: number;
  trailFrom: number;
  trailTo: number;
  /** A blow just landed on the guard (1, fading to 0), and whether it was parried. */
  guardKick: number;
  guardParry: boolean;
  /** The Blender-rendered rig, when it is switched on (`useRig`); null draws the painted poses. */
  rig: RigView | null;
}

interface RigView {
  /** Turns and squashes like the painted body (a roll), around the figure's middle. */
  pivot: THREE.Group;
  body: THREE.Mesh;
  bodyMat: THREE.MeshBasicMaterial;
  /** The sword fist, drawn over the weapon. */
  hand: THREE.Mesh;
  handMat: THREE.MeshBasicMaterial;
  /** World units per frame pixel, and the action whose geometry is on the meshes. */
  unit: number;
  action: string;
  geos: Record<string, THREE.PlaneGeometry>;
}

interface HeroPose {
  geo: THREE.PlaneGeometry;
  tex: THREE.Texture;
  w: number;
  h: number;
  /** Where the hand is, as a share of the picture from its bottom-left corner. */
  hand: [number, number];
  /** The front fist: geometry cut from the picture and its centre in the body plane. */
  fistGeo: THREE.PlaneGeometry;
  fistX: number;
  fistY: number;
}

/**
 * The hero's poses: height relative to the standing picture, the centre of the sword fist (where the
 * grip sits) and the fist's rectangle [left, bottom, right, top], all as shares of the picture from
 * its bottom-left corner. Measured on the painted poses; the fist is drawn again over the weapon.
 *
 * The weapon is always in the **right** hand, the arm nearer to the camera: the attack and block
 * pictures only have that arm free. Standing, that is the fist at the back of the turned body;
 * running, the near arm swings back, so the weapon trails behind.
 */
const HERO_POSES: Record<string, { scale: number; hand: [number, number]; fist: [number, number, number, number] }> = {
  idle: { scale: 1, hand: [0.132, 0.432], fist: [0.034, 0.391, 0.222, 0.477] },
  run: { scale: 0.95, hand: [0.284, 0.561], fist: [0.226, 0.516, 0.35, 0.604] },
  attack: { scale: 0.93, hand: [0.876, 0.764], fist: [0.829, 0.715, 0.922, 0.8125] },
  // the block picture's open hands were replaced by the attack picture's fist, turned along the forearm
  block: { scale: 0.95, hand: [0.871, 0.742], fist: [0.81, 0.691, 0.936, 0.793] },
};

/**
 * Drawn length of each weapon picture, where the fist closes on it (`grip`, share of the length) and
 * how much of its back end is not drawn at all (`cut`): pommel and rear handle sit inside the fist.
 */
const WEAPON_DRAW: Record<string, { len: number; cut: number; grip: number }> = {
  'rost-klinge': { len: 50, cut: 0.16, grip: 0.205 },
  'verwerter-hammer': { len: 60, cut: 0.15, grip: 0.2 },
  'lumen-dolch': { len: 30, cut: 0.05, grip: 0.15 },
};

/**
 * How the weapon travels through an attack. Angles in radians, 0 = forward, up positive.
 * `wind` is reached during the wind-up (in pose `pose`), `strike` at the end of the active window
 * (in the attack pose), then the weapon eases back to rest.
 */
interface Swing {
  wind: number;
  strike: number;
  pose: string;
  /** Pose for the first half of the recovery (default: the attack pose). */
  follow?: string;
  /** Pose for the active window (default: the attack pose). */
  hit?: string;
  thrust?: boolean;
  spin?: boolean;
}
const OVERHEAD: Swing = { wind: 2.2, strike: -1.0, pose: 'block' };
const RISING: Swing = { wind: -2.3, strike: 1.6, pose: 'idle', follow: 'block' };
const THRUST: Swing = { wind: 0.1, strike: 0, pose: 'idle', thrust: true };
const HEAVY: Swing = { wind: 2.6, strike: -1.15, pose: 'block' };
const SLAM: Swing = { wind: 2.8, strike: -1.45, pose: 'block' };
const AIR: Swing = { wind: 1.7, strike: -1.5, pose: 'block' };
const PLUNGE: Swing = { wind: -1.1, strike: -Math.PI / 2, pose: 'idle', hit: 'idle', follow: 'idle' };
const SWINGS: Record<string, Swing> = {
  // Rost-Klinge: down, back up, then the stab
  hieb1: OVERHEAD,
  hieb2: RISING,
  ladung: HEAVY,
  'rost-splitter': { wind: 2.4, strike: 2.4, pose: 'block', spin: true },
  // the hammer: overhead, then from below
  schlag1: HEAVY,
  schlag2: { wind: -2.5, strike: 0.5, pose: 'idle', follow: 'block' },
  bodenschlag: SLAM,
  schlagwelle: SLAM,
  bodenbrecher: SLAM,
  // the dagger's slash is short and quick
  dolch3: { wind: 1.5, strike: -0.9, pose: 'block' },
};

function swingOf(def: AttackDef): Swing {
  const s = SWINGS[def.id];
  if (s) return s;
  if (def.leap) return PLUNGE;
  if (def.kind === 'thrust') return THRUST;
  if (def.around) return SWINGS['rost-splitter']!;
  if (def.box.y > 25) return RISING;
  if (def.id.includes('luft')) return AIR;
  return def.kind === 'charge' ? HEAVY : OVERHEAD;
}

/** Segments of the swing arc, and how long it lingers after the cut (seconds of game time). */
const TRAIL_SEG = 16;
const TRAIL_FADE = 0.12;

interface EnemyView {
  root: THREE.Group;
  body: THREE.Group;
  sprite: boolean;
  rim: THREE.ShaderMaterial | null;
  /** A boss's wind-up picture next to its standing one: swapped in while it attacks. */
  pics: { shell: THREE.Mesh; rimMesh: THREE.Mesh; base: [THREE.PlaneGeometry, THREE.Texture, number]; tell: [THREE.PlaneGeometry, THREE.Texture, number] } | null;
  telling: boolean;
  shellMat: THREE.MeshBasicMaterial;
  legs: THREE.Mesh[];
  gear: THREE.Group | null;
  mark: THREE.Mesh;
  markMat: THREE.MeshBasicMaterial;
  hpBar: THREE.Group;
  hpFill: THREE.Mesh;
  poiseFill: THREE.Mesh;
  ring: THREE.Mesh;
  style: EnemyStyle;
  flash: number;
}

interface PropView {
  def: PropDef;
  obj: THREE.Object3D;
  parts: THREE.Mesh[];
}

export class SceneView {
  readonly root = new THREE.Group();
  readonly camera: THREE.OrthographicCamera;
  /** Show hit- and hurtboxes. */
  showBoxes = false;
  /** Multiplier on the view height: below 1 frames tighter (the hub tile's clips are recorded so). */
  framing = 1;
  private roomGroup = new THREE.Group();
  private roomId = '';
  private hero: HeroView;
  private enemies: EnemyView[] = [];
  private props: PropView[] = [];
  private cell: THREE.Mesh;
  private korro: THREE.Mesh | null = null;
  private doors: { lamp: THREE.MeshBasicMaterial; needs?: string }[] = [];
  private korroPos = { x: 0, y: 0 };
  private shotPool: THREE.Mesh[] = [];
  private boxes: THREE.Mesh[] = [];
  private sparks: ParticlePool;
  private sparkBase: Float32Array;
  private fade: THREE.Mesh;
  /** Darkness of a dark room: black everywhere but a ring of sight around the hero. */
  private dark: THREE.Mesh | null = null;
  /** Painted parallax layers of the room, with how much they follow the camera. */
  private layers: { obj: THREE.Object3D; follow: number; baseX: number; baseY: number }[] = [];
  private fadeT = 1;
  private camX: number;
  private camY: number;
  private t = 0;
  private readonly trailColor = new THREE.Color();

  constructor(
    sim: Sim,
    private fxRng: Rng,
  ) {
    const half = 190;
    this.camera = new THREE.OrthographicCamera(-half * (16 / 9), half * (16 / 9), half, -half, -1000, 1000);
    this.camX = sim.hero.body.x;
    this.camY = sim.hero.body.y + 80;
    this.root.add(this.roomGroup);
    this.hero = this.buildHero(sim.hero);

    this.cell = picture('obj_glutzelle', 26) ?? new THREE.Mesh(new THREE.CircleGeometry(9, 6), mat(C.pure));
    this.cell.position.z = 6;
    this.root.add(this.cell);
    // Korro, once found: a little drone of pure light that keeps near the hero
    this.korro = picture('npc_korro', 18);
    if (this.korro) {
      const glow = new THREE.Mesh(new THREE.CircleGeometry(26, 24), new THREE.MeshBasicMaterial({ color: C.pure, transparent: true, opacity: 0.12, depthWrite: false }));
      glow.position.set(0, 9, -0.5);
      this.korro.add(glow);
      this.korro.visible = false;
      this.korro.position.z = 7;
      this.root.add(this.korro);
    }

    this.sparks = new ParticlePool({
      capacity: 500,
      gravity: 700,
      drag: 2.2,
      material: new THREE.PointsMaterial({ size: 4, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false }),
      attributes: { color: 3 },
      onLive: (i, k) => {
        const c = this.sparks.array('color');
        for (let j = 0; j < 3; j++) c[i * 3 + j] = (this.sparkBase[i * 3 + j] ?? 1) * k;
      },
    });
    this.sparkBase = new Float32Array(this.sparks.capacity * 3);
    this.sparks.points.position.z = 20;
    this.root.add(this.sparks.points);

    // a black veil over everything for room changes, carried by the camera
    this.fade = plane(4000, 4000, '#000000', 1);
    (this.fade.material as THREE.MeshBasicMaterial).transparent = true;
    this.fade.position.z = 90;
    this.camera.add(this.fade);
    this.fade.position.set(0, 0, -10);
    this.root.add(this.camera);
    this.buildRoom(sim);
  }

  // ---------------------------------------------------------------- room

  private buildRoom(sim: Sim) {
    disposeObject(this.roomGroup);
    this.roomGroup = new THREE.Group();
    this.root.add(this.roomGroup);
    const r = sim.room;
    this.roomId = r.id;
    const th = THEMES[r.theme ?? ''] ?? DEFAULT_THEME;
    const g = this.roomGroup;

    const bg = plane(r.w + 3000, r.h + 3000, th.sky);
    bg.position.set(r.w / 2, r.h / 2, -60);
    g.add(bg);
    this.layers = [];
    const theme = r.theme ?? 'rosttal';
    const far = texture(`far_${theme}`);
    if (far) {
      // the painted far layer: dimmed so the fight in front stays the brightest thing on screen
      const h = Math.max(560, r.h * 0.75);
      const w = h * aspect(`far_${theme}`);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: far, color: '#7a7570', depthWrite: false }));
      m.position.set(r.w / 2, h / 2 - 60, -55);
      g.add(m);
      this.layers.push({ obj: m, follow: 0.85, baseX: r.w / 2, baseY: h / 2 - 60 });
    }
    const mid = texture(`mid_${theme}`);
    if (mid) {
      const h = 230;
      const w = h * aspect(`mid_${theme}`);
      const strip = new THREE.Group();
      for (let x = -w; x < r.w + w; x += w) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: mid, color: '#4a4440', transparent: true, opacity: 0.55, depthWrite: false }));
        m.position.set(x + w / 2, h / 2 - 20, 0);
        strip.add(m);
      }
      strip.position.z = -45;
      g.add(strip);
      this.layers.push({ obj: strip, follow: 0.6, baseX: 0, baseY: 0 });
    }
    // a far silhouette: stacked shacks, pipes, darker than the play space; seeded by the room id
    let seed = 0;
    for (const ch of r.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const n = far ? 0 : Math.ceil(r.w / 90) + 2;
    for (let i = 0; i < n; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const w = 50 + (seed % 80);
      const h = 80 + ((seed >>> 8) % 220);
      const m = plane(w, h, th.far);
      m.position.set(i * 90 - 40, h / 2 - 20, -50);
      g.add(m);
    }
    if (th.hazeOpacity > 0) {
      const haze = plane(r.w + 3000, r.h + 3000, th.haze, th.hazeOpacity);
      haze.position.set(r.w / 2, r.h / 2, 40);
      g.add(haze);
    }
    for (const s of r.smog ?? []) {
      const m = plane(s.w, s.h, '#8a8455', 0.1);
      m.position.set(s.x + s.w / 2, s.y + s.h / 2, -30);
      g.add(m);
    }
    // a tile texture per area, shared; the UVs are scaled so 128 px of world show one tile
    const TILE_OF: Record<string, string> = { rosttal: 'rosttal', rohr: 'rohr', unter: 'rohr', pumpe: 'rohr', ader: 'ader', wald: 'wald', schanze: 'stadt', stadt: 'stadt', labor: 'labor' };
    const tile = texture(`tile_${TILE_OF[theme] ?? 'rosttal'}`);
    if (tile) {
      tile.wrapS = tile.wrapT = THREE.RepeatWrapping;
    }
    for (const s of r.solids) {
      const m = plane(s.w, s.h, s.oneWay ? th.oneWay : th.solid);
      if (tile) {
        const uv = m.geometry.getAttribute('uv') as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * s.w) / 128, (uv.getY(i) * s.h) / 128);
        const mm = m.material as THREE.MeshBasicMaterial;
        mm.map = tile;
        mm.color.set(s.oneWay ? '#8a8078' : '#6a625a');
      }
      m.position.set(s.x + s.w / 2, s.y + s.h / 2, -10);
      const top = plane(s.w, 3, th.top);
      top.position.set(s.x + s.w / 2, s.y + s.h - 1.5, -9);
      g.add(m, top);
    }
    this.doors = [];
    for (const ex of r.exits ?? []) {
      if (ex.door) {
        // a door: a dark frame in the wall, a lamp above that says open or locked
        const cx = ex.rect.x + ex.rect.w / 2;
        const frame = plane(44, 74, '#3a332c');
        frame.position.set(cx, ex.rect.y + 37, -12);
        const hole = plane(34, 66, '#0c0b0a');
        hole.position.set(cx, ex.rect.y + 33, -11);
        const lamp = new THREE.Mesh(new THREE.CircleGeometry(4, 12), mat('#5dff86'));
        lamp.position.set(cx, ex.rect.y + 82, -10);
        g.add(frame, hole, lamp);
        this.doors.push({ lamp: lamp.material as THREE.MeshBasicMaterial, needs: ex.needs });
        continue;
      }
      // a faint light where the room goes on
      const m = plane(ex.rect.w, ex.rect.h, '#d8d2c4', 0.04);
      m.position.set(ex.rect.x + ex.rect.w / 2, ex.rect.y + ex.rect.h / 2, -20);
      g.add(m);
    }

    this.props = (r.props ?? []).map((p) => this.buildProp(p));
    this.dark = null;
    if (r.dark) {
      // a radial falloff painted once into a canvas; the plane follows the hero
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g2 = c.getContext('2d')!;
      const grd = g2.createRadialGradient(128, 128, 18, 128, 128, 128);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(0.55, 'rgba(0,0,0,0.55)');
      grd.addColorStop(1, 'rgba(0,0,0,0.94)');
      g2.fillStyle = grd;
      g2.fillRect(0, 0, 256, 256);
      const tex = new THREE.CanvasTexture(c);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(460, 460), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      m.position.z = 60;
      // beyond the ring: solid black, as four big planes around it
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const b = plane(dx ? 3000 : 460, dy ? 3000 : 460, '#000000', 0.94);
        b.position.set(dx * (230 + (dx ? 1500 : 0)), dy * (230 + (dy ? 1500 : 0)), 0);
        if (dx === 0) b.scale.x = 7;
        m.add(b);
      }
      g.add(m);
      this.dark = m;
    }
    this.enemies = sim.enemies.map((e) => this.buildEnemy(e));
    for (const s of this.shotPool) s.visible = false;
    for (const b of this.boxes) b.removeFromParent();
    this.boxes = [];
  }

  private buildProp(p: PropDef): PropView {
    const obj = new THREE.Group();
    const parts: THREE.Mesh[] = [];
    switch (p.type) {
      case 'rest': {
        // the Kollektor: its light circle shows how far "safe" reaches (UEBERGABE §5)
        const glow = new THREE.Mesh(new THREE.CircleGeometry(100, 48), new THREE.MeshBasicMaterial({ color: C.pure, transparent: true, opacity: 0.07, depthWrite: false }));
        glow.position.set(0, 20, -35);
        const pic = picture('obj_kollektor', 96);
        if (pic) {
          pic.position.set(0, 0, -30);
          obj.add(glow, pic);
          parts.push(glow, pic);
        } else {
          const pole = plane(10, 70, '#3b3f3a');
          pole.position.set(0, 35, -30);
          const lamp = plane(20, 20, C.pure);
          lamp.position.set(0, 78, -29);
          lamp.rotation.z = Math.PI / 4;
          obj.add(glow, pole, lamp);
          parts.push(glow, lamp);
        }
        obj.position.set(p.x, p.y, 0);
        break;
      }
      case 'lever': {
        const base = plane(18, 10, '#4a4a4a');
        base.position.set(0, 5, -5);
        const arm = plane(4, 28, '#c8692f');
        arm.geometry.translate(0, 14, 0);
        arm.position.set(0, 8, -4);
        obj.add(base, arm);
        parts.push(arm);
        obj.position.set(p.x, p.y, 0);
        break;
      }
      case 'gate': {
        const m = unitRect('#3a3f45', 1);
        m.scale.set(p.rect.w, p.rect.h, 1);
        const bars = unitRect('#6a737d', 1);
        bars.scale.set(4, p.rect.h, 1);
        bars.position.set(p.rect.w / 2 - 2, 0, 0.5);
        obj.add(m, bars);
        parts.push(m, bars);
        obj.position.set(p.rect.x, p.rect.y, -8);
        break;
      }
      case 'wall': {
        // corrugated sheet: a few vertical ribs
        const m = unitRect('#6a5a48', 1);
        m.scale.set(p.rect.w, p.rect.h, 1);
        obj.add(m);
        parts.push(m);
        for (let x = 4; x < p.rect.w; x += 8) {
          const rib = unitRect('#8a7458', 1);
          rib.scale.set(2, p.rect.h, 1);
          rib.position.set(x, 0, 0.2);
          obj.add(rib);
          parts.push(rib);
        }
        obj.position.set(p.rect.x, p.rect.y, -8);
        break;
      }
      case 'hazard': {
        const m = unitRect(p.period ? '#c8d6e0' : '#9a3a2a', 0.85);
        m.scale.set(p.rect.w, p.rect.h, 1);
        obj.add(m);
        parts.push(m);
        if (p.period) {
          const vent = unitRect('#3a3f45', 1);
          vent.scale.set(p.rect.w, 8, 1);
          vent.position.set(0, -8, 0.1);
          obj.add(vent);
        }
        obj.position.set(p.rect.x, p.rect.y, 2);
        break;
      }
      case 'pickup': {
        const pic = itemPicture(p.item);
        const m = pic ?? plane(12, 12, p.item.startsWith('weapon') ? '#ffd27a' : p.item === 'flask' ? '#ff9a5a' : C.pure);
        if (!pic) m.rotation.z = Math.PI / 4;
        m.position.y = pic ? 4 : 14;
        // a faint glow behind it, so a find reads from across the room
        const halo = new THREE.Mesh(new THREE.CircleGeometry(16, 20), new THREE.MeshBasicMaterial({ color: '#ffe8b0', transparent: true, opacity: 0.12, depthWrite: false }));
        halo.position.set(0, 14, -0.5);
        obj.add(halo, m);
        parts.push(m);
        obj.position.set(p.x, p.y, 3);
        break;
      }
      case 'npc': {
        const pic = picture(p.sprite, p.h);
        if (pic) obj.add(pic);
        obj.position.set(p.x, p.y, -4);
        break;
      }
      case 'sign': {
        const post = plane(4, 30, '#4a3b2e');
        post.position.y = 15;
        const board = plane(30, 16, '#6a5a48');
        board.position.y = 32;
        obj.add(post, board);
        obj.position.set(p.x, p.y, -6);
        break;
      }
    }
    this.roomGroup.add(obj);
    return { def: p, obj, parts };
  }

  private buildHero(h: Hero): HeroView {
    const root = new THREE.Group();
    const tex = texture('spr_hero');
    // the painted figure stands a little taller than its hurtbox, feet on the same line
    const dh = tex ? h.body.h * 1.32 : h.body.h;
    const dw = tex ? dh * aspect('spr_hero') : h.body.w;
    const body = tex
      ? new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, depthWrite: false }))
      : plane(h.body.w, h.body.h, C.hero);
    body.position.y = dh / 2;
    if (!tex) {
      const visor = plane(9, 5, C.visor);
      // child of the body plane, whose origin is its centre
      visor.position.set(h.body.w / 2 - 5, h.body.h / 2 - 12, 1);
      body.add(visor);
    }
    // the weapon hangs from the hand and turns around it; it is a child of the body plane (origin in
    // its centre), so a lean or a bob carries the hand and the weapon together
    const bladePivot = new THREE.Group();
    const handX = h.body.w / 2 - 4;
    const handY = h.body.h * 0.05;
    bladePivot.position.set(handX, handY, 2);
    const bladeMat = new THREE.MeshBasicMaterial({ color: C.blade });
    const bladeGeo = new THREE.PlaneGeometry(46, 4);
    bladeGeo.translate(23, 0, 0);
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    bladePivot.add(blade);
    body.add(bladePivot);
    // the arc behind a swing: a ring sector whose alpha fades towards its old end
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((TRAIL_SEG + 1) * 2 * 3), 3));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array((TRAIL_SEG + 1) * 2 * 4), 4));
    const idx: number[] = [];
    for (let i = 0; i < TRAIL_SEG; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    trailGeo.setIndex(idx);
    const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    trail.visible = false;
    trail.frustumCulled = false;
    body.add(trail);
    const aura = plane(h.body.w + 10, h.body.h + 10, C.pure, 0.35);
    aura.position.set(0, h.body.h / 2, -1);
    aura.visible = false;
    const flask = plane(8, 12, '#ff9a5a');
    flask.position.set(6, h.body.h - 8, 3);
    flask.visible = false;
    root.add(aura, body, flask);
    root.position.z = 5;
    this.root.add(root);
    // a set of poses replaces the single picture when the generator has made them
    let poses: Record<string, HeroPose> | null = null;
    let fist: THREE.Mesh | null = null;
    if (texture('spr_hero_idle')) {
      poses = {};
      const base = h.body.h * 1.32;
      for (const [name, p] of Object.entries(HERO_POSES)) {
        const id = texture(`spr_hero_${name}`) ? `spr_hero_${name}` : 'spr_hero_idle';
        const ph = base * p.scale;
        const pw = ph * aspect(id);
        const [l, b, r, t] = p.fist;
        const fistGeo = new THREE.PlaneGeometry((r - l) * pw, (t - b) * ph);
        const uv = fistGeo.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, l + uv.getX(i) * (r - l), b + uv.getY(i) * (t - b));
        poses[name] = {
          geo: new THREE.PlaneGeometry(pw, ph), tex: texture(id)!, w: pw, h: ph, hand: p.hand,
          fistGeo, fistX: -pw / 2 + ((l + r) / 2) * pw, fistY: -ph / 2 + ((b + t) / 2) * ph,
        };
      }
      fist = new THREE.Mesh(poses.idle!.fistGeo, new THREE.MeshBasicMaterial({ map: poses.idle!.tex, transparent: true, alphaTest: 0.04, depthWrite: false }));
      body.add(fist);
    }
    return {
      root, body, h: dh, sprite: !!tex, bodyMat: body.material as THREE.MeshBasicMaterial, bladePivot, blade, bladeMat, aura, flask,
      weaponId: '', painted: false, poses, pose: '', fist, handX, handY, angle: -0.7, reach: 46,
      swingRun: null, swingFrom: 0, trail, trailGeo, trailA: 0, trailFrom: 0, trailTo: 0, guardKick: 0, guardParry: false, rig: null,
    };
  }

  /** Which picture fits what the hero is doing. */
  private poseOf(h: Hero): string {
    if (h.state === 'block') return 'block';
    if (h.state === 'charge') return 'block';
    if (h.state === 'attack' && h.attack) {
      const run = h.attack;
      const s = swingOf(run.def);
      const ph = phaseOf(run);
      if (ph === 'windup') return s.pose;
      if (ph === 'active') return s.hit ?? 'attack';
      if (recoveryElapsed(run) < run.def.recovery * 0.5) return s.follow ?? 'attack';
      return 'idle';
    }
    if (h.state === 'roll' || h.state === 'dash') return 'run';
    if (!h.body.onGround && h.alive) return 'run';
    if (h.state === 'move' && Math.abs(h.body.vx) > 30) return 'run';
    return 'idle';
  }

  private setPose(v: HeroView, name: string) {
    const p = v.poses?.[name];
    if (!p || v.pose === name) return;
    v.pose = name;
    v.body.geometry = p.geo;
    v.bodyMat.map = p.tex;
    v.h = p.h;
    // the weapon moves with the hand, and the fist of this picture closes over its grip
    v.handX = -p.w / 2 + p.hand[0] * p.w;
    v.handY = -p.h / 2 + p.hand[1] * p.h;
    if (v.fist) {
      v.fist.geometry = p.fistGeo;
      (v.fist.material as THREE.MeshBasicMaterial).map = p.tex;
      v.fist.position.set(p.fistX, p.fistY, 3);
    }
  }

  /** Puts the hero's current weapon into the hand: its picture if there is one, else the line. */
  private dressWeapon(v: HeroView, id: string) {
    v.weaponId = id;
    const tex = texture(`wpn_${id}`);
    const d = WEAPON_DRAW[id];
    v.painted = !!tex && !!d;
    if (!tex || !d) {
      v.blade.geometry.dispose();
      const g = new THREE.PlaneGeometry(46, 4);
      g.translate(23, 0, 0);
      v.blade.geometry = g;
      v.bladeMat.map = null;
      v.bladeMat.transparent = false;
      v.bladeMat.needsUpdate = true;
      v.reach = 46;
      return;
    }
    // only the part in front of the cut is drawn; the grip point sits on the pivot
    const visible = d.len * (1 - d.cut);
    const g = new THREE.PlaneGeometry(visible, d.len / aspect(`wpn_${id}`));
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, d.cut + uv.getX(i) * (1 - d.cut));
    g.translate(visible / 2 + (d.cut - d.grip) * d.len, 0, 0);
    v.blade.geometry.dispose();
    v.blade.geometry = g;
    v.bladeMat.map = tex;
    v.bladeMat.transparent = true;
    v.bladeMat.alphaTest = 0.04;
    v.bladeMat.needsUpdate = true;
    v.reach = d.len * (1 - d.grip);
  }

  /**
   * The angle a weapon rests at in the current pose: down and forward, but never through the floor
   * (the hand's height and the weapon's reach decide how far down it may point).
   */
  private restAngle(v: HeroView): number {
    const above = v.handY + v.h / 2 - 3;
    return -Math.min(0.95, Math.asin(Math.max(0, Math.min(1, above / Math.max(1, v.reach)))));
  }

  /** Fills the swing arc from angle `a0` (faded) to `a1` (bright) around the hand. */
  private drawTrail(v: HeroView, a0: number, a1: number, alpha: number, color: THREE.Color) {
    const pos = v.trailGeo.attributes.position as THREE.BufferAttribute;
    const col = v.trailGeo.attributes.color as THREE.BufferAttribute;
    const rOut = v.reach * 1.04;
    const rIn = v.reach * 0.5;
    for (let i = 0; i <= TRAIL_SEG; i++) {
      const k = i / TRAIL_SEG;
      const a = a0 + (a1 - a0) * k;
      const c = Math.cos(a);
      const s = Math.sin(a);
      pos.setXYZ(i * 2, c * rIn, s * rIn, 0);
      pos.setXYZ(i * 2 + 1, c * rOut, s * rOut, 0);
      // bright along the blade's edge and at its newest end, soft towards the hand and the old end
      col.setXYZW(i * 2, color.r, color.g, color.b, alpha * 0.2 * k);
      col.setXYZW(i * 2 + 1, color.r, color.g, color.b, alpha * (0.15 + 0.85 * k * Math.sqrt(k)));
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    v.trail.position.set(v.bladePivot.position.x, v.bladePivot.position.y, 1.5);
    v.trail.visible = alpha > 0.01;
  }

  private buildEnemy(e: Enemy): EnemyView {
    const st = ENEMY_STYLE[e.def.id] ?? DEFAULT_STYLE;
    const root = new THREE.Group();
    const body = new THREE.Group();
    const w = e.def.w;
    const h = e.def.h;
    const legs: THREE.Mesh[] = [];
    let shell: THREE.Mesh;
    let rim: THREE.Mesh | null = null;
    let pics: EnemyView['pics'] = null;
    const tex = texture(`spr_${e.def.id}`);
    if (tex) {
      // the painted figure, fitted to the hurtbox: wide creatures by width, upright ones by height
      const a = aspect(`spr_${e.def.id}`);
      let dw = w * 1.35;
      let dh = dw / a;
      if (h >= w || dh < h) {
        dh = h * 1.25;
        dw = dh * a;
      }
      shell = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, depthWrite: false }));
      shell.position.y = dh / 2;
      rim = new THREE.Mesh(shell.geometry, rimMaterial(tex));
      rim.scale.set(1 + 6 / dw, 1 + 6 / dh, 1);
      rim.position.set(0, dh / 2, -0.2);
      body.add(rim, shell);
      const tellTex = texture(`spr_${e.def.id}_tell`);
      if (tellTex) {
        const th = dh;
        pics = {
          shell,
          rimMesh: rim,
          base: [shell.geometry as THREE.PlaneGeometry, tex, dh],
          tell: [new THREE.PlaneGeometry(th * aspect(`spr_${e.def.id}_tell`), th), tellTex, th],
        };
      }
    } else if (st.shape === 'legs') {
      shell = plane(w, h * 0.7, st.body);
      shell.position.y = h * 0.55;
      for (let i = 0; i < 4; i++) {
        const leg = plane(3, h * 0.55, st.accent);
        leg.position.set(-w / 2 + 6 + i * ((w - 12) / 3), h * 0.25, -0.5);
        legs.push(leg);
        body.add(leg);
      }
    } else if (st.shape === 'blob') {
      shell = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 20), mat(st.body));
      shell.scale.y = h / w;
      shell.position.y = h / 2;
    } else {
      shell = plane(w, h, st.body);
      shell.position.y = h / 2;
      const belt = plane(w, Math.max(4, h * 0.08), st.accent);
      belt.position.set(0, h * 0.45, 0.3);
      body.add(belt);
      if (st.shape === 'giant') {
        const core = plane(w * 0.3, w * 0.3, st.eye, 0.9);
        core.position.set(-w * 0.15, h * 0.6, 0.4);
        body.add(core);
      }
      for (let i = 0; i < 2; i++) {
        const leg = plane(w * 0.25, h * 0.2, st.accent);
        leg.position.set((i ? 1 : -1) * w * 0.22, h * 0.08, -0.4);
        legs.push(leg);
        body.add(leg);
      }
    }
    if (!tex) {
      body.add(shell);
      const eye = plane(Math.max(4, w * 0.12), Math.max(4, w * 0.12), st.eye);
      eye.position.set(w / 2 - Math.max(5, w * 0.15), h * 0.78, 1);
      body.add(eye);
    }

    let gear: THREE.Group | null = null;
    if (!tex && st.gear && st.gear !== 'none') {
      gear = new THREE.Group();
      gear.position.set(w / 2 - 4, h * 0.6, 2);
      if (st.gear === 'shield') {
        const sh = plane(10, h * 0.85, '#a88a5a');
        sh.position.set(8, -h * 0.15, 0);
        gear.add(sh);
      } else {
        const len = st.gear === 'hammer' ? h * 0.8 : h * 0.6;
        const shaft = new THREE.Mesh(new THREE.PlaneGeometry(len, st.gear === 'hammer' ? 8 : 5), mat('#5a5a5a'));
        shaft.geometry.translate(len / 2, 0, 0);
        gear.add(shaft);
        if (st.gear === 'hammer') {
          const head = plane(h * 0.22, h * 0.3, st.accent);
          head.position.set(len, 0, 0.2);
          gear.add(head);
        }
      }
      body.add(gear);
    }

    const markMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 1, depthWrite: false });
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), markMat);
    mark.rotation.z = Math.PI / 4;
    mark.position.set(0, h + 26, 3);
    mark.visible = false;
    // the ring under an "around" attack: how far the shockwave reaches
    const ring = unitRect('#ff3b3b', 0.18);
    ring.visible = false;
    ring.position.z = -2;
    const hpBar = new THREE.Group();
    const back = plane(40, 6, C.hpBack);
    const hpFill = unitRect(C.hp, 1);
    hpFill.scale.set(38, 3, 1);
    hpFill.position.set(-19, -1, 1);
    const poiseFill = unitRect(C.poise, 1);
    poiseFill.scale.set(38, 1.5, 1);
    poiseFill.position.set(-19, -2.6, 1.1);
    hpBar.add(back, hpFill, poiseFill);
    hpBar.position.set(0, h + 12, 3);
    root.add(body, mark, hpBar);
    root.position.z = 4;
    this.roomGroup.add(root, ring);
    return { root, body, sprite: !!tex, rim: rim ? (rim.material as THREE.ShaderMaterial) : null, pics, telling: false, shellMat: shell.material as THREE.MeshBasicMaterial, legs, gear, mark, markMat, hpBar, hpFill, poiseFill, ring, style: st, flash: 9 };
  }

  // ---------------------------------------------------------------- per frame

  /** The struck enemy blinks white for a moment. */
  flashEnemy(i: number) {
    const v = this.enemies[i];
    if (v) v.flash = 0;
  }

  /**
   * Draws the hero from the Blender rig (tools/assets/rssouls_rig) instead of the painted poses.
   * The weapon and its arc move into the rig's frame; the painted figure stays as the fallback.
   */
  useRig(on: boolean, heroBodyH: number) {
    const v = this.hero;
    if (!on || v.rig || !HERO_RIG || !texture('rig_hero_idle_body')) return;
    // the rig's standing figure is as tall as the painted one
    const unit = (heroBodyH * 1.32) / HERO_RIG.figurePx;
    const pivot = new THREE.Group();
    const bodyMat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.04, depthWrite: false });
    const handMat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.04, depthWrite: false });
    const body = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bodyMat);
    const hand = new THREE.Mesh(body.geometry, handMat);
    hand.position.z = 3;
    body.add(hand, v.bladePivot, v.trail);
    pivot.add(body);
    v.root.add(pivot);
    v.body.visible = false;
    v.rig = { pivot, body, bodyMat, hand, handMat, unit, action: '', geos: {} };
  }

  /** The hero's guard took a blow: it gives way a little, or (parried) snaps forward. */
  guardHit(parried: boolean) {
    this.hero.guardKick = 1;
    this.hero.guardParry = parried;
  }

  burst(x: number, y: number, color: string, count: number, speed: number, up = 0) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const a = this.fxRng.range(0, Math.PI * 2);
      const s = this.fxRng.range(speed * 0.4, speed);
      const idx = this.sparks.spawn(x, y, 0, Math.cos(a) * s, Math.sin(a) * s + up, 0, this.fxRng.range(0.2, 0.5));
      this.sparkBase[idx * 3] = c.r;
      this.sparkBase[idx * 3 + 1] = c.g;
      this.sparkBase[idx * 3 + 2] = c.b;
    }
  }

  update(sim: Sim, alpha: number, dt: number, shake: { x: number; y: number }) {
    this.t += dt;
    if (sim.room.id !== this.roomId || this.enemies.length !== sim.enemies.length) {
      this.buildRoom(sim);
      this.fadeT = 0;
      // the camera jumps with the hero instead of sliding across the cut
      this.camX = sim.hero.body.x + sim.hero.facing * 60;
      this.camY = sim.hero.body.y + 80;
    }
    this.fadeT = Math.min(1, this.fadeT + dt * 4);
    (this.fade.material as THREE.MeshBasicMaterial).opacity = 1 - this.fadeT;
    this.fade.visible = this.fadeT < 1;

    this.updateHero(sim.hero, alpha, dt);
    if (this.korro) {
      const k = this.korro;
      k.visible = hasFlag(sim.progress, 'korro') && sim.hero.alive;
      if (k.visible) {
        const h = sim.hero;
        const tx = h.body.x - h.facing * 34;
        const ty = h.body.y + 74 + Math.sin(this.t * 2.6) * 5;
        this.korroPos.x += (tx - this.korroPos.x) * Math.min(1, dt * 4);
        this.korroPos.y += (ty - this.korroPos.y) * Math.min(1, dt * 4);
        if (Math.abs(this.korroPos.x - tx) > 400) this.korroPos = { x: tx, y: ty };
        k.position.x = this.korroPos.x;
        k.position.y = this.korroPos.y;
        k.scale.x = h.facing;
      }
    }
    if (this.dark) {
      const p = lerpPos(sim.hero.body, alpha);
      this.dark.position.x = p.x;
      this.dark.position.y = p.y + 30;
      // the ring breathes a little, like a lamp
      this.dark.scale.setScalar((sim.hero.traits?.darkSight ? 1.9 : 1) * (1 + Math.sin(this.t * 2.3) * 0.02));
    }
    sim.enemies.forEach((e, i) => {
      const v = this.enemies[i];
      if (v) this.updateEnemy(e, v, alpha, dt);
    });
    this.updateProps(sim);
    this.updateShots(sim);
    this.updateBoxes(sim);
    this.sparks.update(dt);
    this.updateCamera(sim, alpha, dt, shake);
  }

  private updateProps(sim: Sim) {
    const p = sim.progress;
    for (const d of this.doors) d.lamp.color.set(!d.needs || hasFlag(p, d.needs) ? '#5dff86' : '#ff3b2a');
    for (const v of this.props) {
      const d = v.def;
      if (d.type === 'lever') v.parts[0]!.rotation.z = hasFlag(p, `pulled:${d.id}`) ? -0.9 : 0.9;
      if (d.type === 'gate') v.obj.visible = sim.gateClosed(d);
      if (d.type === 'wall') v.obj.visible = !hasFlag(p, `broken:${d.id}`);
      if (d.type === 'pickup') {
        v.obj.visible = !hasFlag(p, `got:${d.id}`);
        v.parts[0]!.position.y = (v.parts[0]!.material as THREE.MeshBasicMaterial).map ? 4 + Math.sin(this.t * 3) * 3 : 14 + Math.sin(this.t * 3) * 3;
      }
      if (d.type === 'hazard') v.obj.visible = sim.hazardOn(d) || !d.period;
      if (d.type === 'rest') {
        const lit = hasFlag(p, `lit:${d.id}`);
        const lamp = v.parts[1]!.material as THREE.MeshBasicMaterial;
        if (lamp.map) lamp.color.setRGB(lit ? 1.15 : 0.45, lit ? 1.15 : 0.5, lit ? 1.15 : 0.45);
        else lamp.color.set(lit ? C.pure : '#2f5a3a');
        (v.parts[0]!.material as THREE.MeshBasicMaterial).opacity = lit ? 0.08 + Math.sin(this.t * 2) * 0.02 : 0.02;
      }
    }
    const cell = p.cell;
    this.cell.visible = !!cell && cell.room === sim.room.id;
    if (cell) {
      const painted = !!(this.cell.material as THREE.MeshBasicMaterial).map;
      this.cell.position.set(cell.x, cell.y + (painted ? 4 : 16) + Math.sin(this.t * 4) * 3, 6);
      if (!painted) this.cell.rotation.z = this.t;
      if (Math.floor(this.t * 10) % 3 === 0 && this.cell.visible) this.burst(cell.x, cell.y + 16, C.pure, 1, 30, 40);
    }
  }

  private updateShots(sim: Sim) {
    sim.shots.forEach((s, i) => {
      let m = this.shotPool[i];
      if (!m) {
        m = new THREE.Mesh(new THREE.CircleGeometry(1, 10), mat('#ffffff'));
        m.position.z = 8;
        this.shotPool.push(m);
        this.root.add(m);
      }
      m.visible = true;
      m.scale.set(s.w / 2, s.h / 2, 1);
      m.position.x = s.x;
      m.position.y = s.y;
      (m.material as THREE.MeshBasicMaterial).color.set(s.owner < 0 ? C.pure : s.effect === 'tar' ? C.tar : '#a08a6a');
    });
    for (let i = sim.shots.length; i < this.shotPool.length; i++) this.shotPool[i]!.visible = false;
  }

  private updateHero(h: Hero, alpha: number, dt: number) {
    const v = this.hero;
    if (v.weaponId !== h.weapon.id) this.dressWeapon(v, h.weapon.id);
    if (v.poses) this.setPose(v, this.poseOf(h));
    const p = lerpPos(h.body, alpha);
    v.root.position.x = p.x;
    v.root.position.y = p.y;
    v.root.scale.x = h.facing;
    v.body.rotation.z = 0;
    v.body.scale.set(1, 1, 1);
    v.body.position.y = v.h / 2;
    // the blade shows its upgrade: amber accent at +1, glut lines at +2, a glow at +3
    const stage = h.upgrades[h.weapon.id] ?? 0;
    if (v.painted) v.bladeMat.color.set(stage >= 3 ? '#ffe8b0' : stage === 2 ? '#ffc890' : stage === 1 ? '#f0e0c8' : '#ffffff');
    else v.bladeMat.color.set(stage >= 3 ? '#ffe2a0' : stage === 2 ? '#ffb070' : stage === 1 ? '#d8c09a' : C.blade);
    const hurt = h.state === 'hurt' || h.state === 'guardBreak';
    if (v.sprite) {
      // a painted figure is tinted, not recoloured: >1 brightens, a channel below 1 tints
      if (hurt) v.bodyMat.color.setRGB(2, 0.55, 0.5);
      else if (h.tarT > 0) v.bodyMat.color.setRGB(0.45, 0.45, 0.45);
      else if (h.burnT > 0 && Math.sin(this.t * 30) > 0) v.bodyMat.color.setRGB(1.8, 1.1, 0.5);
      else v.bodyMat.color.setRGB(1.15, 1.15, 1.15);
    } else v.bodyMat.color.set(hurt ? C.heroHurt : h.tarT > 0 ? '#8a8578' : h.burnT > 0 && Math.sin(this.t * 30) > 0 ? '#ffb347' : C.hero);
    v.aura.visible = h.riposteT > 0 || h.wardT > 0;
    (v.aura.material as THREE.MeshBasicMaterial).color.set(h.riposteT > 0 ? C.pure : '#c8692f');
    v.bladePivot.visible = true;
    v.flask.visible = h.state === 'drink';
    if (v.fist) (v.fist.material as THREE.MeshBasicMaterial).color.copy(v.bodyMat.color);
    const weaponLen = v.painted ? 1 : h.weapon.moveset.block === null ? 0.85 : h.weapon.id === 'lumen-dolch' ? 0.55 : 1;
    v.blade.scale.y = !v.painted && h.weapon.moveset.block === null ? 3 : 1;
    v.body.position.x = 0;

    // Outside an attack the weapon follows a target angle with a little lag, so a change of pose
    // never snaps it; inside an attack it follows the swing curve exactly.
    const rest = this.restAngle(v);
    let target = rest;
    let reach = 1;
    let swinging = false;
    if (h.state === 'roll') {
      const k = h.stateT / h.feel.roll.time;
      v.body.scale.set(1.1, 0.55, 1);
      v.body.position.y = v.h * 0.28;
      v.body.rotation.z = -k * Math.PI * 2;
      v.bladePivot.visible = false;
    } else if (h.state === 'block') {
      // the guard: blade up and leaning towards the threat, in front of the face
      target = 1.25;
      if (h.parryOpen) v.bladeMat.color.set(C.parryGlint);
    } else if (h.state === 'rest') {
      v.body.scale.set(1, 0.7, 1);
      v.body.position.y = v.h * 0.35;
    } else if (h.state === 'charge') {
      const ready = h.chargeT >= h.weapon.moveset.chargeTime;
      target = 2.5 + (ready ? Math.sin(this.t * 45) * 0.04 : 0);
      v.bladeMat.color.set(ready ? C.bladeHot : C.blade);
      v.body.position.y = v.h / 2 - (ready ? 3 + Math.sin(this.t * 40) : 2);
    } else if (h.state === 'attack' && h.attack) {
      const run = h.attack;
      const def = run.def;
      const sw = swingOf(def);
      const ph = phaseOf(run);
      const w = windupOf(run);
      if (v.swingRun !== run) {
        v.swingRun = run;
        // into the wind-up the short way round (a trailing weapon goes up over the back)
        let from = v.angle;
        while (from - sw.wind > Math.PI) from -= Math.PI * 2;
        while (sw.wind - from > Math.PI) from += Math.PI * 2;
        v.swingFrom = from;
      }
      swinging = true;
      if (ph === 'windup') {
        // anticipation: most of the lift happens early, then the weapon hangs at the top
        const k = easeOutCubic(run.t / Math.max(0.01, w));
        v.angle = v.swingFrom + (sw.wind - v.swingFrom) * k;
        v.body.position.x = (sw.thrust ? -3 : -1.5) * k;
      } else if (ph === 'active') {
        const k = Math.min(1, (run.t - w) / def.active);
        // the cut itself: fast out of the wind-up, braking into the strike
        const e = 1 - (1 - k) * (1 - k);
        if (sw.spin) v.angle = sw.wind - e * Math.PI * 4;
        else v.angle = sw.wind + (sw.strike - sw.wind) * e;
        if (!sw.thrust && !def.leap) {
          // the arc trails the blade over the last part of its way
          v.trailFrom = sw.spin ? v.angle + 2.4 : sw.wind + (sw.strike - sw.wind) * Math.max(0, e - 0.55);
          v.trailTo = v.angle;
          v.trailA = 0.8;
        }
        reach = sw.thrust && !v.painted ? 1.35 : 1;
        v.body.position.x = 2.5;
        v.bladeMat.color.set(def.kind === 'charge' || h.attackIsSkill ? C.bladeHot : '#ffffff');
      } else {
        // follow-through: the weapon stays where the blow ended for a moment, then eases home
        const end = sw.spin ? sw.wind : sw.strike;
        const re = recoveryElapsed(run);
        const k = Math.max(0, (re / def.recovery - 0.25) / 0.75);
        // the arc of the finished cut fades by the clock, not by frames, so it shows at any frame rate
        if (!sw.thrust && !def.leap && re < TRAIL_FADE) {
          v.trailFrom = sw.spin ? sw.wind + 2.4 : sw.wind + (sw.strike - sw.wind) * 0.45;
          v.trailTo = end;
          v.trailA = 0.8 * (1 - re / TRAIL_FADE);
        }
        v.angle = end + (rest - end) * easeInOutCubic(Math.min(1, k));
        v.body.position.x = 2.5 * (1 - Math.min(1, k * 2));
      }
    } else if (h.state === 'dead') {
      v.body.rotation.z = Math.PI / 2;
      v.body.position.y = v.sprite ? v.h * 0.18 : h.body.w / 2;
      v.bladePivot.visible = false;
    } else if (v.pose === 'run') {
      // running: the weapon trails behind, low, and swings with the stride
      target = (h.body.onGround ? -2.65 : -2.4) + Math.sin(this.t * 14) * (h.body.onGround ? 0.08 : 0);
    }
    if (!swinging) {
      v.swingRun = null;
      // a weapon that spun or swung far comes home the short way
      while (v.angle - target > Math.PI) v.angle -= Math.PI * 2;
      while (target - v.angle > Math.PI) v.angle += Math.PI * 2;
      v.angle = damp(v.angle, target, 16, dt);
    }
    // a blow on the guard knocks blade and body back for a moment; a parry snaps the blade forward
    v.guardKick = Math.max(0, v.guardKick - dt * 7);
    let kickA = 0;
    if (v.guardKick > 0 && (h.state === 'block' || (v.guardParry && h.state !== 'attack' && h.state !== 'roll' && h.state !== 'dead'))) {
      const k = v.guardKick * v.guardKick;
      kickA = v.guardParry ? -0.35 * k : 0.45 * k;
      v.body.position.x -= (v.guardParry ? -1.5 : 3) * k;
      v.body.rotation.z += (v.guardParry ? -0.03 : 0.07) * k;
      if (v.guardKick > 0.55) v.bladeMat.color.set(v.guardParry ? C.parryGlint : '#ffffff').multiplyScalar(1.6);
    }
    let gripX = v.handX;
    let gripY = v.handY;
    let shown = v.angle;
    if (v.rig) {
      const g = this.updateRig(v, v.rig, h);
      if (g) {
        gripX = g.x;
        gripY = g.y;
        if (g.angle !== null) shown = g.angle;
      }
    }
    // raised back over the shoulder the weapon passes behind the figure; the fist stays in front
    const back = Math.cos(shown) < -0.3 && Math.sin(shown) > 0.2;
    v.bladePivot.position.set(gripX, gripY, back ? -1 : 2);
    v.bladePivot.rotation.z = shown + kickA;
    v.blade.scale.x = reach * weaponLen;
    if (v.trailA > 0 && v.bladePivot.visible) {
      this.drawTrail(v, v.trailFrom, v.trailTo, v.trailA, this.trailColor.set(h.attackIsSkill || h.attack?.def.kind === 'charge' ? C.bladeHot : '#fff6e6'));
    } else v.trail.visible = false;
    v.trailA = 0;

    // life for a still picture: a step bob when running, a lean into the blow, a stretch in the air
    if (v.sprite && h.state !== 'roll' && h.state !== 'dead' && h.state !== 'rest') {
      const speed = Math.abs(h.body.vx);
      if (h.body.onGround && speed > 20 && h.state === 'move') {
        const step = this.t * 14;
        v.body.position.y += Math.abs(Math.sin(step)) * 3;
        v.body.rotation.z = -0.07 * Math.min(1, speed / 175);
      }
      if (!h.body.onGround) v.body.scale.set(0.94, 1.06, 1);
      if (h.state === 'attack' && h.attack && phaseOf(h.attack) === 'active') v.body.rotation.z = -0.14;
      if (h.state === 'attack' && h.attack && phaseOf(h.attack) === 'windup') v.body.rotation.z = 0.08;
      if (h.state === 'block') v.body.rotation.z = 0.06;
    }
  }

  /**
   * Shows the rig frame for what the hero is doing and returns where the grip is (in the rig body's
   * space) and the blade angle the frame was drawn with (null: the rig has no action for this state,
   * the weapon keeps its own angle). Sets the swing arc of a cut from the frames' blade angles.
   */
  private updateRig(v: HeroView, r: RigView, h: Hero): { x: number; y: number; angle: number | null } | null {
    const rig = HERO_RIG!;
    const pick = pickRigFrame(rig, h, this.t);
    const name = pick?.action ?? 'idle';
    const a = rig.actions[name]!;
    const frame = pick?.frame ?? 0;
    if (r.action !== name) {
      r.action = name;
      let geo = r.geos[name];
      if (!geo) {
        geo = new THREE.PlaneGeometry(a.w * r.unit, a.h * r.unit);
        // the figure's foot point sits on the origin
        geo.translate((a.w / 2 - a.anchor[0]) * r.unit, (a.anchor[1] - a.h / 2) * r.unit, 0);
        r.geos[name] = geo;
      }
      r.body.geometry = geo;
      r.hand.geometry = geo;
      r.bodyMat.map = texture(`rig_hero_${name}_body`);
      r.handMat.map = texture(`rig_hero_${name}_hand`);
      for (const m of [r.bodyMat.map, r.handMat.map]) m?.repeat.set(1 / a.frames, 1);
      r.bodyMat.needsUpdate = true;
      r.handMat.needsUpdate = true;
    }
    for (const m of [r.bodyMat.map, r.handMat.map]) m?.offset.set(frame / a.frames, 0);
    r.bodyMat.color.copy(v.bodyMat.color);
    r.handMat.color.copy(v.bodyMat.color);
    // the rig animates the body itself; the painted body's turn and squash only where it has no action
    const mid = (rig.figurePx / 2) * r.unit;
    const turn = !pick || pick.turn;
    r.pivot.position.set(v.body.position.x, mid + (turn ? v.body.position.y - v.h / 2 : 0), 0);
    r.pivot.rotation.z = turn ? v.body.rotation.z : 0;
    if (turn) r.pivot.scale.copy(v.body.scale);
    else r.pivot.scale.set(1, 1, 1);
    r.body.position.y = -mid;
    const [gx, gy] = a.grip[frame]!;
    if (pick?.cutting && h.attack) {
      v.trailFrom = a.unwrapped[pick.cutFrom]!;
      v.trailTo = a.unwrapped[frame]!;
      v.trailA = 0.8;
    } else if (pick && h.attack && a.phases && phaseOf(h.attack) === 'recovery') {
      const re = recoveryElapsed(h.attack);
      if (re < TRAIL_FADE) {
        v.trailFrom = a.unwrapped[Math.max(0, a.phases[0] - 1)]!;
        v.trailTo = a.unwrapped[a.phases[1] - 1]!;
        v.trailA = 0.8 * (1 - re / TRAIL_FADE);
      } else v.trailA = 0;
    } else if (pick) v.trailA = 0;
    return { x: (gx - a.anchor[0]) * r.unit, y: (a.anchor[1] - gy) * r.unit, angle: pick ? a.grip[frame]![2] : null };
  }

  private updateEnemy(e: Enemy, v: EnemyView, alpha: number, dt: number) {
    const p = lerpPos(e.body, alpha);
    v.root.visible = e.body.y > -1000;
    v.ring.visible = false;
    if (!v.root.visible) return;
    v.root.position.x = p.x;
    v.root.position.y = p.y;
    v.body.scale.x = e.facing;
    v.body.rotation.z = 0;
    v.body.position.y = 0;
    v.flash += dt;
    v.mark.visible = false;
    v.hpBar.visible = !e.def.boss && e.alive && (e.hp < e.maxHp || e.poise < e.def.poise);
    v.hpFill.scale.x = Math.max(0.001, 38 * (e.hp / e.maxHp));
    v.poiseFill.scale.x = Math.max(0.001, 38 * (e.poise / e.def.poise));
    if (v.gear) v.gear.rotation.z = -0.6;

    // a boss shows its wind-up in its pose as well as in its colour
    const tell = e.state === 'attack' && !!e.attack && phaseOf(e.attack) !== 'recovery' && phaseOf(e.attack) !== 'done';
    if (v.pics && tell !== v.telling) {
      v.telling = tell;
      const [geo, map] = tell ? v.pics.tell : v.pics.base;
      v.pics.shell.geometry = geo;
      v.pics.rimMesh.geometry = geo;
      v.shellMat.map = map;
      (v.pics.rimMesh.material as THREE.ShaderMaterial).uniforms.map!.value = map;
    }
    let color = v.style.body;
    const moving = Math.abs(e.body.vx) > 5 ? 1 : 0;
    if (v.sprite && e.alive && moving && e.state !== 'attack') {
      // a painted enemy bobs in step with its speed
      v.body.position.y = Math.abs(Math.sin(this.t * (e.state === 'chase' ? 16 : 9))) * Math.min(4, e.def.h * 0.06);
      v.body.rotation.z = -0.05;
    }
    if (v.sprite && e.def.flying) v.body.position.y = Math.sin(this.t * 3 + e.spawn.x) * 4;
    const legWave = Math.sin(this.t * (e.state === 'chase' ? 30 : 14)) * moving;
    v.legs.forEach((l, i) => (l.rotation.z = legWave * (i % 2 ? 0.4 : -0.4)));

    if (e.state === 'attack' && e.attack) {
      const run = e.attack;
      const ph = phaseOf(run);
      if (ph === 'windup') {
        // the telegraph: crouch, blink, and a marker that says parry (white) or dodge (red)
        const k = run.t / Math.max(0.01, windupOf(run));
        v.body.position.y = -3 * k;
        v.body.rotation.z = 0.1 * k;
        color = Math.sin(this.t * 38) > 0 ? (run.def.parryable ? '#ffe9a8' : '#ff8a7a') : v.style.body;
        v.mark.visible = true;
        v.markMat.color.set(run.def.parryable ? '#ffffff' : '#ff3b3b');
        v.mark.scale.setScalar(0.8 + k * 0.6);
        if (v.gear) v.gear.rotation.z = 0.4 + k * 1.4;
        if (run.def.around) {
          const hb = hitbox(e.body, e.facing, run.def);
          v.ring.visible = true;
          v.ring.position.set(hb.x, hb.y, -2);
          v.ring.scale.set(hb.w, hb.h, 1);
          (v.ring.material as THREE.MeshBasicMaterial).opacity = 0.08 + k * 0.2;
        }
      } else if (ph === 'active') {
        v.body.rotation.z = -0.15;
        if (v.gear) v.gear.rotation.z = -1.4;
      } else if (v.gear) v.gear.rotation.z = -1.2;
    } else if (e.state === 'stagger') {
      v.body.rotation.z = 0.3 + Math.sin(this.t * 22) * 0.1;
      color = '#b06a40';
      if (Math.floor(this.t * 12) % 3 === 0) this.burst(p.x, p.y + e.body.h + 8, C.poise, 1, 40, 30);
    } else if (e.state === 'dead') {
      v.body.rotation.z = e.def.h > e.def.w ? Math.PI / 2 : Math.PI;
      v.body.position.y = e.def.h > e.def.w ? e.def.w / 2 : e.def.h * 0.8;
      v.root.visible = e.stateT < 1.2 || Math.floor(this.t * 8) % 2 === 0;
      if (e.stateT > 2) v.root.visible = false;
      color = '#2a2420';
    } else if (e.state === 'idle') {
      color = v.style.body;
    }
    if (e.enraged) color = Math.sin(this.t * 6) > 0.6 ? '#ff6b2a' : color;
    if (v.flash < 0.08) color = '#ffffff';
    if (v.sprite) this.tintSprite(v, e, color);
    else v.shellMat.color.set(color);
  }

  /** The painted enemy keeps its colours; meaning comes as a tint over them and its rim. */
  private tintSprite(v: EnemyView, e: Enemy, flatColor: string) {
    const m = v.shellMat.color;
    if (v.rim) {
      const u = v.rim.uniforms;
      const c = u.color!.value as THREE.Color;
      const tell = e.state === 'attack' && e.attack && phaseOf(e.attack) === 'windup';
      if (v.flash < 0.1) {
        c.set('#ffffff');
        u.opacity!.value = 1;
      } else if (tell) {
        c.set(e.attack!.def.parryable ? '#ffffff' : '#ff3b2a');
        u.opacity!.value = 0.55 + 0.45 * Math.abs(Math.sin(this.t * 20));
      } else if (e.state === 'stagger') {
        c.set('#e8c34a');
        u.opacity!.value = 0.7;
      } else if (e.elite) {
        c.set('#ff9a3a');
        u.opacity!.value = 0.45;
      } else {
        c.set(e.def.boss ? '#ffd8b0' : '#e8dcc8');
        u.opacity!.value = e.state === 'dead' ? 0 : 0.3;
      }
    }
    if (v.flash < 0.08) m.setRGB(3, 3, 3);
    else if (e.state === 'attack' && e.attack && phaseOf(e.attack) === 'windup') {
      const on = Math.sin(this.t * 38) > 0;
      if (!on) m.setRGB(1, 1, 1);
      else if (e.attack.def.parryable) m.setRGB(2.2, 2.2, 2);
      else m.setRGB(2.4, 0.7, 0.6);
    } else if (e.state === 'stagger') m.setRGB(1.4, 1.2, 0.7);
    else if (e.state === 'dead') m.setRGB(0.35, 0.33, 0.32);
    else if (e.enraged && flatColor === '#ff6b2a') m.setRGB(1.8, 0.9, 0.5);
    else m.setRGB(1, 1, 1);
  }

  private updateBoxes(sim: Sim) {
    for (const b of this.boxes) b.visible = false;
    if (!this.showBoxes) return;
    let n = 0;
    const show = (r: { x: number; y: number; w: number; h: number }, color: string) => {
      let m = this.boxes[n];
      if (!m) {
        m = unitRect(color, 0.35);
        m.position.z = 30;
        this.boxes.push(m);
        this.roomGroup.add(m);
      }
      (m.material as THREE.MeshBasicMaterial).color.set(color);
      m.position.x = r.x;
      m.position.y = r.y;
      m.scale.set(r.w, r.h, 1);
      m.visible = true;
      n++;
    };
    const h = sim.hero;
    show(bodyRect(h.body), C.hurtbox);
    if (h.state === 'attack' && h.attack && phaseOf(h.attack) === 'active') show(hitbox(h.body, h.facing, h.attack.def), C.hitbox);
    for (const e of sim.enemies) {
      if (!e.alive) continue;
      show(bodyRect(e.body), C.hurtbox);
      if (e.state === 'attack' && e.attack && phaseOf(e.attack) === 'active') show(hitbox(e.body, e.facing, e.attack.def), C.hitbox);
    }
  }

  private updateCamera(sim: Sim, alpha: number, dt: number, shake: { x: number; y: number }) {
    const cam = this.camera;
    const h = sim.hero;
    const r = sim.room;
    const p = lerpPos(h.body, alpha);
    // camera profiles (UEBERGABE §9): a hall leads ahead, a shaft looks up and down, an arena
    // frames the boss together with the hero
    const prof = r.camera ?? 'hall';
    const half = (prof === 'chamber' ? 165 : prof === 'arena' || prof === 'shaft' ? 215 : 190) * this.framing;
    if (Math.abs(cam.top - half) > 0.5) {
      const k = Math.min(1, dt * 3);
      const nh = cam.top + (half - cam.top) * k;
      const aspect = (cam.right - cam.left) / (cam.top - cam.bottom);
      cam.top = nh;
      cam.bottom = -nh;
      cam.left = -nh * aspect;
      cam.right = nh * aspect;
      cam.updateProjectionMatrix();
    }
    let wantX = p.x + h.facing * (prof === 'hall' ? 60 : 30);
    let wantY = p.y + (prof === 'shaft' ? 40 : 80);
    const boss = sim.bossFight();
    if (boss && prof === 'arena') {
      wantX = (p.x + boss.body.x) / 2;
      wantY = Math.max(p.y, boss.body.y) + 90;
    }
    this.camX = damp(this.camX, wantX, 4, dt);
    this.camY = damp(this.camY, wantY, 5, dt);
    const halfW = (cam.right - cam.left) / 2;
    const halfH = (cam.top - cam.bottom) / 2;
    const x = r.w <= halfW * 2 ? r.w / 2 : Math.min(Math.max(this.camX, halfW), r.w - halfW);
    const y = r.h <= halfH * 2 - 30 ? halfH - 30 : Math.min(Math.max(this.camY, halfH - 30), r.h - halfH);
    cam.position.set(x + shake.x, y + shake.y, 100);
    // parallax: a layer that follows the camera by `follow` seems that much farther away
    for (const l of this.layers) {
      l.obj.position.x = l.baseX + (x - r.w / 2) * l.follow;
      l.obj.position.y = l.baseY + (y - halfH) * l.follow * 0.9;
    }
  }

  dispose() {
    disposeImages();
    this.sparks.dispose();
    this.camera.remove(this.fade);
    disposeObject(this.fade);
  }
}
