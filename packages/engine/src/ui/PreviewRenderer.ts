import * as THREE from 'three';
import { disposeObject } from '../Engine';

/**
 * Draws small 3D previews (e.g. the lobby figure) into DOM-sized rectangles on a transparent
 * overlay canvas above the UI. One extra WebGL context, any number of slots via scissor viewports.
 */
export class PreviewRenderer {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  private slots = new Map<string, { el: HTMLElement; clips: HTMLElement[]; group: THREE.Group; spin: number; wantSpin: number; update?: (dt: number) => void; live: boolean }>();
  private raf = 0;
  private last = 0;
  private lookAt = new THREE.Vector3(0, 0.72, 0);

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    // width/height 100% are not redundant with inset 0: a canvas is a replaced element, and an
    // absolutely positioned replaced element does not stretch between its edges - it takes its
    // intrinsic size, which for a canvas is the drawing buffer. On a screen with a pixel ratio of
    // 2 or 3 (every phone, every tablet, a laptop at 125 %) that buffer is two or three times the
    // window, so the canvas hung out of the page and every figure was drawn at half size and off
    // its tile. At ratio 1 the two sizes coincide, which is why a desktop never showed it.
    Object.assign(this.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '20', display: 'none' });
    parent.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(2, 4, 3);
    this.scene.add(sun, new THREE.HemisphereLight(0xdde8ff, 0x556644, 1.1));
    this.camera.position.set(0, 1.1, 3.4);
  }

  /**
   * Show `group` (a figure with origin at its feet) inside element `el`. Replaces a previous figure
   * of the same key.
   *
   * `opts.fit` scales and lifts the group into the frame the camera is set up for, so a caller can
   * hand over a whole little scene without knowing the camera. `opts.update` runs every frame while
   * the slot is live, `opts.spin` sets the idle rotation (0 stands still).
   */
  set(key: string, el: HTMLElement, group: THREE.Group, opts: { fit?: boolean; update?: (dt: number) => void; spin?: number } = {}) {
    const prev = this.slots.get(key);
    // the same figure may be handed over again (a card that re-registered its element): keep it in
    // the scene, only swap element and options - disposing it here would throw away a live figure
    const same = prev?.group === group;
    if (prev && !same) {
      this.scene.remove(prev.group);
      disposeObject(prev.group);
    }
    if (!same) {
      if (opts.fit) fitToFrame(group);
      this.scene.add(group);
    }
    const spin = opts.spin ?? prev?.wantSpin ?? 0.4;
    this.slots.set(key, { el, clips: clippers(el), group, spin: prev?.spin ?? spin, wantSpin: spin, update: opts.update, live: true });
    this.start();
  }

  /** Idle rotation of one slot; the menu spins only what has the focus. */
  setSpin(key: string, v: number) {
    const s = this.slots.get(key);
    if (s) s.wantSpin = v;
  }

  /** Whether the slot's own animation runs (the menu freezes everything but the focused tile). */
  setLive(key: string, live: boolean) {
    const s = this.slots.get(key);
    if (s) s.live = live;
  }

  remove(key: string) {
    const s = this.slots.get(key);
    if (!s) return;
    this.scene.remove(s.group);
    disposeObject(s.group);
    this.slots.delete(key);
    if (!this.slots.size) this.stop();
  }

  clear() {
    for (const k of [...this.slots.keys()]) this.remove(k);
  }

  /** Manual rotation by pointer drag (dx in CSS pixels). Stops the auto-spin and leaves some inertia. */
  drag(key: string, dx: number) {
    const s = this.slots.get(key);
    if (!s) return;
    const step = dx * 0.012;
    s.group.rotation.y += step;
    s.wantSpin = 0;
    s.spin = step * 25; // inertia velocity (rad/s) for the next frames
  }

  private start() {
    if (this.raf) return;
    this.canvas.style.display = 'block';
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.draw(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.canvas.style.display = 'none';
  }

  private draw(dt: number) {
    // The canvas's own box, not the window: the two differ by a scrollbar, a collapsing browser
    // bar, or the safe area, and every rect below is measured against the page the canvas lies on.
    const cr = this.canvas.getBoundingClientRect();
    const W = Math.max(1, Math.round(cr.width));
    const H = Math.max(1, Math.round(cr.height));
    // browser zoom changes the pixel ratio after start-up; follow it, or the picture goes soft
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    if (pr !== this.renderer.getPixelRatio()) this.renderer.setPixelRatio(pr);
    if (this.canvas.width !== Math.floor(W * pr) || this.canvas.height !== Math.floor(H * pr)) this.renderer.setSize(W, H, false);
    this.renderer.setScissorTest(false);
    this.renderer.clear();
    this.renderer.setScissorTest(true);
    for (const s of this.slots.values()) {
      const r = s.el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      // auto-spin eases towards wantSpin; after a manual drag (wantSpin 0) the inertia decays
      s.spin = s.wantSpin === 0 ? s.spin * Math.exp(-4 * dt) : s.spin + (s.wantSpin - s.spin) * Math.min(1, dt * 3);
      // only this group visible for its viewport
      for (const o of this.slots.values()) o.group.visible = o === s;
      if (!reducedMotion()) {
        s.group.rotation.y += s.spin * dt;
        if (s.live) s.update?.(dt);
      }
      // CSS pixels: setViewport/setScissor apply the pixel ratio themselves (see Engine.draw).
      // Multiplying it in here as well squared it, and every preview on a HiDPI screen was drawn
      // oversized and off its tile.
      const x = Math.floor(r.left - cr.left);
      const y = Math.floor(cr.bottom - r.bottom);
      const w = Math.floor(r.width);
      const h = Math.floor(r.height);
      // The viewport is the whole tile - that is what places the figure - the scissor is only the
      // part of the tile that is actually on show. This canvas lies over the page and knows nothing
      // of the boxes below it, so a tile inside a scrolled list used to keep its figure painted at
      // full size after the list had scrolled it away: a lobby figure floating over the title bar.
      // Cutting the scissor down to the clipping ancestors makes the overlay obey them like any
      // other content, without moving the figure a pixel.
      let sx = r.left, sy = r.top, sr = r.right, sb = r.bottom;
      for (const c of s.clips) {
        const q = c.getBoundingClientRect();
        sx = Math.max(sx, q.left); sy = Math.max(sy, q.top);
        sr = Math.min(sr, q.right); sb = Math.min(sb, q.bottom);
      }
      if (sr - sx < 4 || sb - sy < 4) continue;
      this.renderer.setViewport(x, y, w, h);
      this.renderer.setScissor(Math.floor(sx - cr.left), Math.floor(cr.bottom - sb), Math.floor(sr - sx), Math.floor(sb - sy));
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(this.lookAt);
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    this.clear();
    this.renderer.dispose();
    this.canvas.remove();
  }
}

/**
 * The ancestors that would clip `el` if it were drawn by the page itself: everything up the chain
 * that does not let its content out. Looked up once per registration rather than per frame -
 * `getComputedStyle` in a render loop is exactly the kind of cost this overlay exists to avoid.
 */
function clippers(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
    const st = getComputedStyle(p);
    if (st.overflowX !== 'visible' || st.overflowY !== 'visible') out.push(p);
  }
  return out;
}

/** Respect the system setting – the same rule the boost overlay in the kart HUD follows. */
function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Scale and centre a group into the box the preview camera frames: about 1.5 units wide and
 * 1.5 tall, standing on y = 0. Callers can then build a scene in whatever units suit them.
 */
function fitToFrame(g: THREE.Group) {
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  if (!box.isEmpty()) {
    const size = box.getSize(new THREE.Vector3());
    const k = 1.5 / Math.max(size.x, size.y, size.z, 0.001);
    g.scale.multiplyScalar(k);
    const centre = box.getCenter(new THREE.Vector3()).multiplyScalar(k);
    g.position.x -= centre.x;
    g.position.z -= centre.z;
    g.position.y -= box.min.y * k;
  }
}
