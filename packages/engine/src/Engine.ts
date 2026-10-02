import * as THREE from 'three';

export interface Viewport {
  /** Normalised rect (0..1), origin bottom-left like WebGL. */
  x: number;
  y: number;
  w: number;
  h: number;
  camera: THREE.Camera;
  scene?: THREE.Scene;
  /** CSS-pixel rect of the viewport, updated every frame (for HUD placement). */
  css: { left: number; top: number; width: number; height: number };
}

export type Quality = 'low' | 'medium' | 'high';

/** One step down the quality ladder; null at the bottom. */
function below(q: Quality): Quality | null {
  return q === 'high' ? 'medium' : q === 'medium' ? 'low' : null;
}

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  fixedDt?: number;
  maxSubSteps?: number;
  shadows?: boolean;
  stats?: boolean;
}

/**
 * Renderer + fixed-step loop + split-screen viewports.
 * Games register `update` (fixed) and `render` (per frame) callbacks.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  readonly scene = new THREE.Scene();
  readonly fixedDt: number;
  readonly maxSubSteps: number;
  viewports: Viewport[] = [];
  /** Convenience default camera (viewport list empty → full-screen render with it). */
  defaultCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  onUpdate: ((dt: number) => void) | null = null;
  /** Lockstep hook: return false to hold the simulation (render keeps running) until inputs for the next tick are there. */
  canStep: (() => boolean) | null = null;
  /** Online: ticks to give back this frame because we run ahead of a peer (0 or 1, see TimeSync). */
  dropTicks: (() => number) | null = null;
  onRender: ((alpha: number, dt: number) => void) | null = null;
  /** 0 = paused (loop keeps rendering, no simulation). */
  timeScale = 1;
  running = false;
  frame = 0;
  simTime = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private statsEl: HTMLDivElement | null = null;
  private fpsAcc = 0;
  private fpsN = 0;
  private resizeObs: ResizeObserver | null = null;
  /**
   * Frames have been slow for a while (see `checkPace`). `lowered` names the level the engine
   * dropped to by itself, or is null when it was already at the bottom and the rest is up to the
   * player (a browser that composites in software is the usual cause and nothing in here fixes it).
   */
  onSlow: ((pace: { avgMs: number; fastMs: number; lowered: Quality | null }) => void) | null = null;
  /** The engine lowered the level by itself; `chosen` is what the player has set in the menu. */
  onQuality: ((active: Quality, chosen: Quality) => void) | null = null;
  /** True once a game has been running slowly long enough for `onSlow` (reset when the viewports change). */
  slow = false;
  /** Last two-second window: average frame time and the fastest tenth (ms), for the stats line. */
  pace = { avgMs: 0, fastMs: 0, slowWindows: 0 };
  private paceDts: number[] = [];
  private paceT = 0;
  private slowWindows = 0;
  /** Windows still to be skipped after a step down – the level needs to settle before it is judged again. */
  private paceCooldown = 0;
  /** The player's setting, straight from the menu. Never written by the engine itself. */
  quality: Quality = 'high';
  /** What is really rendered: the setting, or a step below it after `checkPace` gave up on the machine. */
  activeQuality: Quality = 'high';
  /** `onSlow` has spoken once about this machine; only a further step down is worth saying again. */
  private told = false;

  constructor(opts: EngineOptions) {
    this.canvas = opts.canvas;
    this.fixedDt = opts.fixedDt ?? 1 / 60;
    // Simulation catches up with up to 10 steps per frame so slow renderers do not slow the game itself (a lower cap made a slow renderer dilate game time).
    this.maxSubSteps = opts.maxSubSteps ?? 10;
    this.renderer = new THREE.WebGLRenderer({
      canvas: opts.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = !!opts.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setScissorTest(true);
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(this.canvas.parentElement ?? document.body);
    this.resize();
    this.watchContext();
    if (opts.stats) this.enableStats();
  }

  /**
   * A lost WebGL context used to end the picture without a word.
   *
   * The browser drops it on a driver reset, when the machine wakes from sleep, or simply when too
   * many tabs each hold one – and a canvas whose context is gone just stops painting. Everything
   * else keeps running: the menu reacts, sounds play, the simulation ticks on. From the outside
   * that looks like the game broke, and there is nothing on screen or in the console to say
   * otherwise. Now it says so, and it comes back by itself when the browser hands the context
   * back, which it usually does within a second or two.
   */
  private watchContext() {
    const say = (text: string, keep: boolean) => {
      let el = document.getElementById('pv-gl-note');
      if (!keep) { el?.remove(); return; }
      if (!el) {
        el = document.createElement('div');
        el.id = 'pv-gl-note';
        el.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:9999;padding:10px 16px;text-align:center;'
          + 'background:rgba(20,10,40,.92);color:#fff;font:600 14px/1.4 system-ui,sans-serif';
        document.body.appendChild(el);
      }
      el.textContent = text;
    };
    this.canvas.addEventListener('webglcontextlost', (e) => {
      // without preventDefault the browser never restores it
      e.preventDefault();
      this.contextLost = true;
      say('Die Grafikausgabe wurde vom Browser angehalten. Sie kommt gleich von selbst zurück – hilft das nicht, hilft ein Neuladen der Seite.', true);
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      say('', false);
      this.resize();
    });
  }

  /** True while the browser has taken the WebGL context away; `draw` is a no-op then. */
  contextLost = false;

  get width() {
    return this.canvas.clientWidth;
  }
  get height() {
    return this.canvas.clientHeight;
  }

  /**
   * The player's choice from the menu. Takes back every step the engine took off by itself: an
   * explicit choice is newer information than an old measurement, and a player who picks 'high'
   * after the engine dropped to 'medium' must actually get 'high'.
   */
  setQuality(q: Quality) {
    this.quality = q;
    this.paceCooldown = 0;
    this.slowWindows = 0;
    this.applyQuality(q);
  }

  /**
   * Render resolution per quality level, as a cap on the device pixel ratio. 'high' renders at up
   * to 2× (a 4K screen at DPR 2 is 8 million pixels with 4× MSAA – heavy for an integrated GPU);
   * 'medium' at the CSS pixel size, 'low' at three quarters of it. Games read `activeQuality` for
   * the rest (the kart thins out its scatter, see Environment).
   */
  private applyQuality(q: Quality) {
    this.activeQuality = q;
    this.renderer.setPixelRatio(this.pixelRatioFor(q));
    this.resize();
  }

  private pixelRatioFor(q: Quality) {
    return Math.min(window.devicePixelRatio, q === 'high' ? 2 : q === 'medium' ? 1 : 0.75);
  }

  resize() {
    const parent = this.canvas.parentElement ?? document.body;
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.updateCameras();
  }

  /**
   * Has anything moved the drawing buffer out from under us? `resize` is driven by a
   * `ResizeObserver` on the parent, and that covers every case we know of – but a picture that
   * renders into the wrong rectangle is a whole-screen fault the player sees instantly, while the
   * check costs two comparisons. So the loop asks again every fifteenth frame and puts it right
   * itself, whatever moved it (P-0039: the user had it happen once in a real game).
   *
   * The two reads are `clientWidth`/`clientHeight` on the parent, which flush pending layout. That
   * is the actual cost and the reason this is not done every frame; measured at well under 0.01 ms
   * per check on the hub, i.e. below 0.001 ms per frame spread over fifteen.
   */
  private checkSize() {
    const parent = this.canvas.parentElement ?? document.body;
    const pr = this.renderer.getPixelRatio();
    // same arithmetic as resize() → setSize(): canvas.width = floor(cssWidth * pixelRatio)
    const w = Math.floor(Math.max(1, parent.clientWidth) * pr);
    const h = Math.floor(Math.max(1, parent.clientHeight) * pr);
    if (this.canvas.width !== w || this.canvas.height !== h) this.resize();
  }

  /**
   * Standard split-screen layouts: 1 full, 2 top/bottom, 3–4 as a 2×2 grid, and from five on a grid
   * that stays as close to square as it can – 5–6 in three columns, 7–8 in four, always two rows.
   *
   * Up to four the rectangles are exactly the ones we always had (with three, the third sits bottom
   * left and the fourth quadrant stays empty). Beyond that a short last row is centred, so seven
   * players do not leave a hole in a corner.
   *
   * Cameras beyond the ones laid out here used to be dropped silently – a player with no rectangle
   * simply had no picture, and the kart HUD then read `undefined.css` and took the whole overlay
   * down. Every camera now gets a rectangle.
   */
  setSplitScreen(cameras: THREE.Camera[], scene?: THREE.Scene) {
    const n = cameras.length;
    const mk = (x: number, y: number, w: number, h: number, camera: THREE.Camera): Viewport => ({
      x, y, w, h, camera, scene, css: { left: 0, top: 0, width: 0, height: 0 },
    });
    const cams = cameras;
    if (n <= 1) this.viewports = [mk(0, 0, 1, 1, cams[0] ?? this.defaultCamera)];
    else if (n === 2) this.viewports = [mk(0, 0.5, 1, 0.5, cams[0]!), mk(0, 0, 1, 0.5, cams[1]!)];
    else if (n <= 4) {
      this.viewports = [mk(0, 0.5, 0.5, 0.5, cams[0]!), mk(0.5, 0.5, 0.5, 0.5, cams[1]!), mk(0, 0, 0.5, 0.5, cams[2]!)];
      if (n >= 4) this.viewports.push(mk(0.5, 0, 0.5, 0.5, cams[3]!));
    } else {
      const cols = n <= 6 ? 3 : 4;
      const rows = Math.ceil(n / cols);
      const w = 1 / cols;
      const h = 1 / rows;
      this.viewports = cams.map((camera, i) => {
        const row = Math.floor(i / cols);
        const inRow = Math.min(cols, n - row * cols); // the last row can be short
        const x = (1 - inRow * w) / 2 + (i % cols) * w;
        return mk(x, 1 - (row + 1) * h, w, h, camera); // y counts from the bottom, row 0 is on top
      });
    }
    this.updateCameras();
  }

  clearViewports() {
    this.viewports = [];
    this.updateCameras();
  }

  private updateCameras() {
    const W = this.width;
    const H = this.height;
    const list = this.viewports.length ? this.viewports : [{ x: 0, y: 0, w: 1, h: 1, camera: this.defaultCamera, css: { left: 0, top: 0, width: 0, height: 0 } } as Viewport];
    for (const v of list) {
      const w = Math.floor(v.w * W);
      const h = Math.floor(v.h * H);
      v.css = { left: Math.floor(v.x * W), top: Math.floor((1 - v.y - v.h) * H), width: w, height: h };
      const cam = v.camera;
      if (cam instanceof THREE.PerspectiveCamera) {
        cam.aspect = w / Math.max(1, h);
        cam.updateProjectionMatrix();
      } else if (cam instanceof THREE.OrthographicCamera) {
        const aspect = w / Math.max(1, h);
        const half = (cam.top - cam.bottom) / 2;
        cam.left = -half * aspect;
        cam.right = half * aspect;
        cam.updateProjectionMatrix();
      }
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25; // tab was hidden
      this.acc += dt * this.timeScale;
      // online: a peer that runs ahead of the others gives back single ticks (TimeSync). The
      // accumulator may go negative so a whole tick is really lost, not just delayed.
      const drop = this.dropTicks?.() ?? 0;
      if (drop > 0) this.acc -= drop * this.fixedDt;
      let steps = 0;
      while (this.acc >= this.fixedDt && steps < this.maxSubSteps) {
        if (this.canStep && !this.canStep()) {
          // stalled: keep the backlog bounded so the catch-up after the stall stays within maxSubSteps
          this.acc = Math.min(this.acc, this.fixedDt * this.maxSubSteps);
          break;
        }
        this.onUpdate?.(this.fixedDt);
        this.simTime += this.fixedDt;
        this.acc -= this.fixedDt;
        steps++;
      }
      if (steps === this.maxSubSteps) this.acc = 0;
      const alpha = this.timeScale > 0 ? Math.max(0, this.acc / this.fixedDt) : 1;
      this.onRender?.(alpha, dt);
      if (this.frame % 15 === 0) this.checkSize();
      this.draw();
      this.frame++;
      this.checkPace(dt);
      if (this.statsEl) {
        this.fpsAcc += dt;
        this.fpsN++;
        if (this.fpsAcc >= 0.5) {
          const info = this.renderer.info.render;
          this.statsEl.textContent = `${Math.round(this.fpsN / this.fpsAcc)} fps · ${info.calls} calls · ${(info.triangles / 1000).toFixed(0)}k tris · ${this.pace.avgMs.toFixed(1)}/${this.pace.fastMs.toFixed(1)} ms${this.slow ? ' · slow' : ''}`;
          this.fpsAcc = 0;
          this.fpsN = 0;
        }
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /**
   * Is the picture keeping up? Every two seconds the frame times of a running game are compared
   * with their own fastest tenth: on a healthy machine both are the display's refresh interval,
   * a 30 Hz screen has both at 33 ms, and only a machine that keeps dropping frames has an
   * average well above its quick frames. Three such windows in a row raise `onSlow` once; so does
   * a machine where even the quick frames are slow (average above 45 ms – a 30 Hz screen sits at 33).
   * Measured case: Firefox with hardware acceleration switched off composites the 4K window in
   * software – 33–50 ms frames next to 16.7 ms ones, whatever the canvas resolution.
   *
   * The answer is one step down the quality ladder (`applyQuality`), with hysteresis on both ends:
   * three slow windows in a row before a step (six seconds of evidence, not one bad frame), then
   * three windows of silence afterwards, because the frames right after the switch were still
   * rendered at the old resolution and would otherwise be counted against the new one. Two steps
   * therefore lie at least twelve seconds apart, and 'low' is the floor.
   *
   * It never goes back up on its own. The measurement can only say "we are slow now"; the only way
   * to find out whether the higher level would work again is to switch there and see – which is
   * exactly the stutter that was just removed, over and over, on a machine whose load swings hard
   * anyway (eight karts in the first corner, one alone on the back straight). A step down is cheap
   * and nearly invisible, an oscillation between two resolutions is neither. The way back up is the
   * next start: this is a runtime measure, `quality` (the player's setting) is never written and
   * never saved, so the menu still says what the player chose and the next game begins there.
   */
  private checkPace(dt: number) {
    if (!this.viewports.length || this.timeScale <= 0) {
      if (!this.viewports.length) { this.slow = false; this.slowWindows = 0; }
      this.paceDts.length = 0;
      this.paceT = 0;
      return;
    }
    this.paceDts.push(dt);
    this.paceT += dt;
    if (this.paceT < 2) return;
    const dts = this.paceDts.slice().sort((a, b) => a - b);
    const fast = dts[Math.floor(dts.length * 0.1)] ?? dt;
    const avg = this.paceT / this.paceDts.length;
    this.paceDts.length = 0;
    this.paceT = 0;
    if (this.paceCooldown > 0) {
      this.paceCooldown--;
      this.slowWindows = 0;
      this.pace = { avgMs: avg * 1000, fastMs: fast * 1000, slowWindows: 0 };
      return;
    }
    this.slowWindows = (avg > fast * 1.4 && avg > 0.022) || avg > 0.045 ? this.slowWindows + 1 : 0;
    this.pace = { avgMs: avg * 1000, fastMs: fast * 1000, slowWindows: this.slowWindows };
    if (this.slowWindows < 3) return;
    this.slowWindows = 0;
    this.slow = true;
    // Skip a step that would change nothing this frame: on an ordinary 1× display 'high' and
    // 'medium' cap at the same pixel ratio, and stepping onto it would only buy another six seconds
    // of the same stutter before anything happens. The scene detail a level also stands for
    // (Environment) is decided when the venue is built, so it cannot help the race in progress.
    let next = below(this.activeQuality);
    while (next && below(next) && this.pixelRatioFor(next) === this.renderer.getPixelRatio()) next = below(next);
    if (next) {
      this.applyQuality(next);
      this.paceCooldown = 3;
      this.told = true;
      this.onSlow?.({ avgMs: avg * 1000, fastMs: fast * 1000, lowered: next });
      this.onQuality?.(next, this.quality);
    } else if (!this.told) {
      // already at the bottom: nothing left in here, so say it once and leave the player alone
      this.told = true;
      this.onSlow?.({ avgMs: avg * 1000, fastMs: fast * 1000, lowered: null });
    }
  }

  /**
   * `setViewport`/`setScissor` take **CSS pixels** and multiply by the renderer's pixel ratio
   * themselves (three does the same in its own `setSize`). Handing them `canvas.width` – which is
   * already the device-pixel buffer – applied the ratio a second time, so the rectangle the picture
   * was drawn into was the buffer times the ratio *squared*.
   *
   * At ratio 1 that is exactly right, which is why it stood for so long. It only shows once the
   * ratio is not 1, and the visible half of it is the ratio *below* 1: quality 'low' caps at 0.75,
   * and `checkPace` steps a slow machine down to it by itself after six seconds. The picture then
   * covers 0.75 × 0.75 of the canvas, sitting in the bottom-left corner because that is where the
   * GL origin is – on a 1861 × 1100 window a 1396 × 825 picture with hard edges at x = 1396 and
   * y = 275, the rest the black of `#stage`. That is the report in P-0039, down to the pixel.
   * Above 1 (a HiDPI screen at 'high') it went the other way and rendered oversized and cropped.
   *
   * `width`/`height` are the canvas' CSS size, the same numbers `updateCameras` puts into `v.css`
   * for the HUD – so the rectangle the renderer draws into and the rectangle the overlay places
   * itself in now come from one source and cannot drift apart again.
   */
  draw() {
    if (this.contextLost) return; // nothing to draw into; see watchContext
    const r = this.renderer;
    // a canvas that is hidden or not laid out yet reports 0 – never hand the GL a null rectangle
    const W = Math.max(1, this.width);
    const H = Math.max(1, this.height);
    if (this.viewports.length === 0) {
      r.setViewport(0, 0, W, H);
      r.setScissor(0, 0, W, H);
      r.render(this.scene, this.defaultCamera);
      return;
    }
    // one world-matrix pass for all rectangles: render() would otherwise walk the whole scene
    // graph once per viewport, and nothing moves between the rectangles of one frame
    const scene = this.scene;
    const auto = scene.matrixWorldAutoUpdate;
    scene.updateMatrixWorld();
    scene.matrixWorldAutoUpdate = false;
    try {
      for (const v of this.viewports) {
        const x = Math.floor(v.x * W);
        const y = Math.floor(v.y * H);
        const w = Math.floor(v.w * W);
        const h = Math.floor(v.h * H);
        r.setViewport(x, y, w, h);
        r.setScissor(x, y, w, h);
        r.render(v.scene ?? scene, v.camera);
      }
    } finally {
      scene.matrixWorldAutoUpdate = auto;
    }
  }

  /**
   * Compile the shader programs of objects that only become visible later (boost flames, shields,
   * particle clouds). Three links a program on the first draw of a material, and with
   * `debug.checkShaderErrors` on that link is a synchronous stall of tens of milliseconds. Paid
   * mid-race it costs a frame, and the fixed-step loop then catches up several ticks at once, which
   * is what a player feels as a stutter. `renderer.compile` only walks *visible* objects, so they
   * are shown for the length of the call and hidden again – nothing is drawn.
   */
  warmUp(objects: THREE.Object3D[], camera: THREE.Camera) {
    const was = objects.map((o) => o.visible);
    for (const o of objects) o.visible = true;
    this.renderer.compile(this.scene, camera);
    // `compile` builds the GL programs, but the expensive part is the first *draw* with a pipeline
    // state that has not been used yet (blending, depth-write off): measured at ~240 ms for the
    // boost flames, and a 1×1 scissor was not enough to trigger it. So draw one full frame. It is
    // overwritten by the next frame before anything reaches the screen, and it happens while the
    // loading screen is still up.
    const W = this.width, H = this.height; // CSS pixels – setViewport applies the ratio, see draw()
    this.renderer.setViewport(0, 0, W, H);
    this.renderer.setScissor(0, 0, W, H);
    this.renderer.render(this.scene, camera);
    objects.forEach((o, i) => (o.visible = was[i] ?? false));
  }

  /** Run one step manually (tests / fast-forward). */
  step(n = 1) {
    for (let i = 0; i < n; i++) {
      this.onUpdate?.(this.fixedDt);
      this.simTime += this.fixedDt;
    }
  }

  enableStats() {
    if (this.statsEl) return;
    const el = document.createElement('div');
    el.className = 'pv-stats';
    Object.assign(el.style, {
      position: 'fixed', left: '6px', bottom: '6px', font: '11px/1.4 ui-monospace, monospace',
      color: '#fff', background: 'rgba(0,0,0,.55)', padding: '2px 6px', borderRadius: '4px', zIndex: '9999',
      pointerEvents: 'none',
    });
    document.body.appendChild(el);
    this.statsEl = el;
  }

  dispose() {
    this.stop();
    this.resizeObs?.disconnect();
    this.renderer.dispose();
    this.statsEl?.remove();
  }
}

/** Dispose a subtree's geometries/materials/textures – all but the shared ones (`markShared`). */
export function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      for (const k of Object.keys(mat)) {
        const v = (mat as any)[k];
        if (v && v.isTexture && !v.userData.shared) v.dispose();
      }
      if (!mat.userData.shared) mat.dispose();
    }
  });
  root.parent?.remove(root);
}
