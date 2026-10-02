import { signal, type Signal } from '@preact/signals';

/**
 * Life, Atem, flasks and Glut top left; weapons bottom left; a boss bar at the bottom; one line of
 * world text in the middle; a prompt near things to use; the rest menu at a Kollektor.
 * Rewritten a few times a second by the game class, never every frame.
 */

export interface MenuItem {
  label: string;
  detail: string;
  enabled: boolean;
}

export interface HudData {
  hp: number;
  hpMax: number;
  stamina: number;
  staminaMax: number;
  flasks: number;
  flasksMax: number;
  currency: number;
  /** The riposte window after a parry is open. */
  riposte: boolean;
  /** Status effects shown under the bars. */
  status: string;
  weapons: { name: string; active: boolean; skill: string; ready: number }[];
  boss: { name: string; hp: number; max: number } | null;
  /** Heat 0–10 in Ascheburg, -1 elsewhere. */
  heat: number;
  title: string;
  sub: string;
  /** Bumped with every new title so the fade restarts. */
  titleKey: number;
  /** A short line near the bottom (item found, lever pulled). */
  toast: string;
  toastKey: number;
  prompt: string;
  /** Kills counter (training only). */
  kills: string;
  hints: string;
  menu: { title: string; items: MenuItem[]; cursor: number; footer: string } | null;
  /** The map while Select is held: rooms seen, where the hero is, lit Kollektors, the dropped cell. */
  map: MapView | null;
  labels: { hp: string; stamina: string; currency: string };
}

export interface MapView {
  title: string;
  rooms: { x: number; y: number; here: boolean; rest: boolean; cell: boolean; boss: boolean; name: string }[];
  links: [number, number, number, number][];
  legend: string;
}

export function newHud(init: HudData): Signal<HudData> {
  return signal(init);
}

/** Injected into a <style> by the game class and removed again in `dispose()`. */
export const RSS_HUD_CSS = `
.rss-hud { position:absolute; inset:0; pointer-events:none; color:#e9e2d4; font: 600 14px/1.2 Georgia, 'Times New Roman', serif; }
.rss-bars { position:absolute; top:18px; left:20px; display:flex; flex-direction:column; gap:6px; }
.rss-bar { display:flex; align-items:center; gap:8px; }
.rss-bar label { width:56px; font-size:11px; letter-spacing:.08em; text-transform:uppercase; opacity:.75; }
.rss-track { position:relative; height:10px; background:rgba(10,8,8,.7); border:1px solid rgba(255,255,255,.18); }
.rss-fill { position:absolute; left:0; top:0; bottom:0; transition: width .12s linear; }
.rss-hp .rss-fill { background:#c4473a; }
.rss-st .rss-fill { background:#e0b84a; }
.rss-st.low .rss-fill { background:#8a6a2a; }
.rss-row { display:flex; gap:14px; margin-left:64px; font-size:13px; align-items:center; }
.rss-flask { color:#ff9a5a; letter-spacing:.1em; }
.rss-glut { color:#5dff86; }
.rss-status { margin-left:64px; font-size:12px; color:#ffb347; letter-spacing:.06em; }
.rss-riposte { margin-left:64px; font-size:12px; color:#5dff86; letter-spacing:.1em; }
.rss-weapons { position:absolute; left:20px; bottom:38px; display:flex; gap:8px; }
.rss-weapon { padding:5px 9px; background:rgba(10,8,8,.6); border:1px solid rgba(255,255,255,.12); font-size:12px; opacity:.55; }
.rss-weapon.on { opacity:1; border-color:#c8692f; }
.rss-weapon small { display:block; font-size:10px; opacity:.75; margin-top:2px; }
.rss-heat { position:absolute; top:18px; right:22px; display:flex; gap:3px; align-items:center; font-size:11px; letter-spacing:.1em; }
.rss-heat i { display:block; width:9px; height:14px; background:rgba(255,255,255,.12); }
.rss-heat i.on { background:#e8c34a; }
.rss-heat i.hot { background:#ff5a3a; }
.rss-kills { position:absolute; top:18px; right:22px; font-size:13px; letter-spacing:.06em; opacity:.85; }
.rss-boss { position:absolute; left:28%; right:28%; top:16px; text-align:center; }
.rss-boss b { display:block; font-size:16px; letter-spacing:.08em; margin-bottom:5px; text-shadow:0 2px 0 rgba(0,0,0,.6); }
.rss-boss .rss-track { width:100%; height:12px; }
.rss-boss .rss-fill { background:#b8392e; }
.rss-title { position:absolute; left:0; right:0; top:17%; text-align:center; text-shadow:0 2px 0 rgba(0,0,0,.6); }
.rss-title b { display:block; font-size:30px; font-weight:600; letter-spacing:.04em; }
.rss-title span { display:block; margin-top:6px; font-size:16px; font-style:italic; opacity:.85; }
@keyframes rss-fade { 0% { opacity:0 } 12% { opacity:1 } 75% { opacity:1 } 100% { opacity:0 } }
.rss-title > div { animation: rss-fade 3.6s ease-out forwards; }
.rss-toast { position:absolute; left:0; right:0; bottom:120px; text-align:center; font-size:15px; font-style:italic; text-shadow:0 2px 0 rgba(0,0,0,.7); }
.rss-toast > div { animation: rss-fade 4.5s ease-out forwards; }
.rss-prompt { position:absolute; left:0; right:0; bottom:96px; text-align:center; font: 600 13px/1.2 system-ui, sans-serif; }
.rss-prompt span { background:rgba(10,8,8,.7); padding:5px 10px; border:1px solid rgba(255,255,255,.2); }
.rss-hints { position:absolute; left:0; right:0; bottom:12px; text-align:center; font: 500 12px/1.2 system-ui, sans-serif; opacity:.5; }
.rss-menu { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); min-width:340px; padding:18px 22px; background:rgba(8,10,9,.88); border:1px solid rgba(93,255,134,.35); box-shadow:0 0 40px rgba(93,255,134,.08); }
.rss-menu h2 { margin:0 0 12px; font-size:18px; font-weight:600; color:#5dff86; letter-spacing:.06em; }
.rss-item { display:flex; justify-content:space-between; gap:20px; padding:7px 8px; font-size:15px; }
.rss-item.off { opacity:.4; }
.rss-item.sel { background:rgba(93,255,134,.12); outline:1px solid rgba(93,255,134,.4); }
.rss-item small { font-size:12px; opacity:.75; }
.rss-map { position:absolute; inset:8% 10%; background:rgba(8,9,10,.9); border:1px solid rgba(232,220,200,.25); padding:14px 18px; }
.rss-map h2 { margin:0 0 8px; font-size:17px; font-weight:600; letter-spacing:.06em; }
.rss-map svg { width:100%; height:calc(100% - 52px); }
.rss-map footer { font: 500 12px/1.3 system-ui, sans-serif; opacity:.65; }
.rss-menu footer { margin-top:12px; font: 500 12px/1.3 system-ui, sans-serif; opacity:.6; }
`;

export function RsSoulsHud({ hud }: { hud: Signal<HudData> }) {
  const d = hud.value;
  const hpPct = (100 * d.hp) / d.hpMax;
  const stPct = (100 * d.stamina) / d.staminaMax;
  return (
    <div class="rss-hud">
      <div class="rss-bars">
        <div class="rss-bar rss-hp">
          <label>{d.labels.hp}</label>
          <div class="rss-track" style={{ width: `${d.hpMax * 2}px` }}>
            <div class="rss-fill" style={{ width: `${hpPct}%` }} />
          </div>
        </div>
        <div class={`rss-bar rss-st${stPct < 25 ? ' low' : ''}`}>
          <label>{d.labels.stamina}</label>
          <div class="rss-track" style={{ width: `${d.staminaMax * 2}px` }}>
            <div class="rss-fill" style={{ width: `${stPct}%` }} />
          </div>
        </div>
        <div class="rss-row">
          <span class="rss-flask">{'◆'.repeat(d.flasks) + '◇'.repeat(Math.max(0, d.flasksMax - d.flasks))}</span>
          <span class="rss-glut">
            {d.labels.currency} {d.currency}
          </span>
        </div>
        {d.status && <div class="rss-status">{d.status}</div>}
        {d.riposte && <div class="rss-riposte">RIPOSTE</div>}
      </div>
      {d.kills && <div class="rss-kills">{d.kills}</div>}
      {d.heat >= 0 && (
        <div class="rss-heat">
          <span style={{ marginRight: '6px' }}>HEAT</span>
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} class={i < d.heat ? (i >= 6 ? 'on hot' : 'on') : ''} />
          ))}
        </div>
      )}
      <div class="rss-weapons">
        {d.weapons.map((w, i) => (
          <div key={i} class={`rss-weapon${w.active ? ' on' : ''}`}>
            {w.name}
            {w.skill && (
              <small>
                {w.skill}
                {w.ready > 0 ? ` · ${Math.ceil(w.ready)} s` : ''}
              </small>
            )}
          </div>
        ))}
      </div>
      {d.boss && (
        <div class="rss-boss">
          <b>{d.boss.name}</b>
          <div class="rss-track">
            <div class="rss-fill" style={{ width: `${(100 * d.boss.hp) / d.boss.max}%` }} />
          </div>
        </div>
      )}
      <div class="rss-title">
        {d.title && (
          <div key={d.titleKey}>
            <b>{d.title}</b>
            {d.sub && <span>{d.sub}</span>}
          </div>
        )}
      </div>
      <div class="rss-toast">{d.toast && <div key={d.toastKey}>{d.toast}</div>}</div>
      {d.prompt && !d.menu && (
        <div class="rss-prompt">
          <span>{d.prompt}</span>
        </div>
      )}
      {d.menu && (
        <div class="rss-menu">
          <h2>{d.menu.title}</h2>
          {d.menu.items.map((it, i) => (
            <div key={i} class={`rss-item${it.enabled ? '' : ' off'}${i === d.menu!.cursor ? ' sel' : ''}`}>
              <span>{it.label}</span>
              <small>{it.detail}</small>
            </div>
          ))}
          <footer>{d.menu.footer}</footer>
        </div>
      )}
      {d.map && <RssMap map={d.map} />}
      <div class="rss-hints">{d.hints}</div>
    </div>
  );
}

function RssMap({ map }: { map: MapView }) {
  const xs = map.rooms.map((r) => r.x);
  const ys = map.rooms.map((r) => r.y);
  const minX = Math.min(...xs, 0) - 1;
  const minY = Math.min(...ys, 0) - 1;
  const w = Math.max(...xs, 0) - minX + 2;
  const h = Math.max(...ys, 0) - minY + 2;
  const S = 40;
  const cx = (x: number) => (x - minX) * S;
  const cy = (y: number) => (y - minY) * S;
  return (
    <div class="rss-map">
      <h2>{map.title}</h2>
      <svg viewBox={`0 0 ${w * S} ${h * S}`} preserveAspectRatio="xMidYMid meet">
        {map.links.map(([ax, ay, bx, by], i) => (
          <line key={`l${i}`} x1={cx(ax)} y1={cy(ay)} x2={cx(bx)} y2={cy(by)} stroke="rgba(232,220,200,.35)" stroke-width="2" />
        ))}
        {map.rooms.map((r, i) => (
          <g key={`r${i}`}>
            <rect x={cx(r.x) - 15} y={cy(r.y) - 9} width="30" height="18" rx="3" fill={r.here ? '#2f6b45' : '#2a2724'} stroke={r.here ? '#5dff86' : 'rgba(232,220,200,.5)'} stroke-width={r.here ? 2 : 1}>
              <title>{r.name}</title>
            </rect>
            {r.rest && <circle cx={cx(r.x) - 8} cy={cy(r.y)} r="3.5" fill="#5dff86" />}
            {r.boss && <rect x={cx(r.x) + 4} y={cy(r.y) - 4} width="8" height="8" fill="#c4473a" transform={`rotate(45 ${cx(r.x) + 8} ${cy(r.y)})`} />}
            {r.cell && <circle cx={cx(r.x)} cy={cy(r.y) - 12} r="4" fill="#ffb347" />}
          </g>
        ))}
      </svg>
      <footer>{map.legend}</footer>
    </div>
  );
}
