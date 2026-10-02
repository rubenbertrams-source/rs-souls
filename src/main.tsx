/**
 * The standalone host of RS Souls.
 *
 * RS Souls was built as one game of the Partyverse hub and still speaks the hub's contract
 * (`@pv/game-api`: a `GameModule` whose `mount(ctx)` gets engine, input, audio, save and an overlay
 * for its HUD). This file is the whole hub it needs: a title menu with the modes, pause, the end
 * screen, language and volume. Everything else lives in `games/rssouls`.
 *
 * URL parameters (as in the hub, so tests and probes keep working):
 *   ?mode=campaign|newgame|run|daily|training   start this mode right away
 *   ?humans=0&cpus=1                            the demo bot plays
 *   ?seed=4                                     fixed seed
 *   ?lang=de|en                                 language
 *   any other key=value                         becomes a rule (e.g. enemyCount=2, heroRig=true)
 */
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { AssetManager, AudioManager, Engine, InputManager, Save, Ticker } from '@pv/engine';
import { Menu, type MenuItem } from '@pv/engine/ui/Menu';
import { withDefaults, type GameContext, type GameInstance, type GameResults, type I18n, type Locale, type PlayerSlot } from '@pv/game-api';
import rssouls from '@pv/rssouls';
import './style.css';

type Route = { name: 'title' } | { name: 'play'; mode: string; run: number } | { name: 'results'; mode: string; results: unknown };

const canvas = document.getElementById('gl') as HTMLCanvasElement;
const q = new URLSearchParams(location.search);
const engine = new Engine({ canvas, shadows: false, stats: q.has('stats') });
const input = new InputManager();
const audio = new AudioManager();
const assets = new AssetManager();
const save = new Save();
const ticker = new Ticker();
const deps = { input, audio, ticker };

const route = signal<Route>({ name: 'title' });
const game = signal<GameInstance | null>(null);
const paused = signal(false);
const toastText = signal('');

if (q.get('lang') === 'de' || q.get('lang') === 'en') save.updateSettings({ locale: q.get('lang') as Locale });
audio.applySettings(save.settings.value);
input.applyBindings(save.settings.value.bindings as never);
const unlock = () => audio.unlock();
window.addEventListener('keydown', unlock);
window.addEventListener('pointerdown', unlock);
// one player: the first keyboard takes the seat, a gamepad that is picked up takes it over
input.ensureAnyPlayer();
input.adoptEnabled = true;

const locale = () => save.settings.value.locale;
const tr = (s: I18n | string) => (typeof s === 'string' ? s : (s[locale()] ?? s.de ?? Object.values(s)[0] ?? ''));
const L = (de: string, en: string) => (locale() === 'de' ? de : en);
let pauseResolve: ((a: 'resume' | 'restart' | 'quit') => void) | null = null;

engine.onUpdate = (dt) => {
  input.poll(dt);
  ticker.emit(dt);
  const g = game.value;
  if (g && !paused.value) g.update(dt);
};
engine.onRender = (alpha, dt) => {
  const g = game.value;
  if (g && !paused.value) g.render?.(alpha, dt);
};
input.on((e) => {
  if (e.type === 'pause' && game.value && !paused.value) void openPause().then(afterPause);
});
engine.start();

function openPause() {
  return new Promise<'resume' | 'restart' | 'quit'>((resolve) => {
    if (paused.value) return resolve('resume');
    pauseResolve = (a) => {
      paused.value = false;
      pauseResolve = null;
      resolve(a);
    };
    paused.value = true;
  });
}

function afterPause(a: 'resume' | 'restart' | 'quit') {
  const r = route.value;
  if (a === 'restart' && r.name === 'play') route.value = { name: 'play', mode: r.mode, run: Date.now() };
  else if (a === 'quit') route.value = { name: 'title' };
}

/** Rules from the URL on top of the game's defaults (as the hub's autoplay does). */
const META_KEYS = ['autoplay', 'game', 'humans', 'cpus', 'mode', 'seed', 'lang', 'stats'];
function rulesFromQuery() {
  const rules = withDefaults(rssouls.meta.sandbox, {});
  for (const [k, v] of q.entries()) {
    if (META_KEYS.includes(k)) continue;
    const num = Number(v);
    rules[k] = v === 'true' ? true : v === 'false' ? false : Number.isFinite(num) ? num : v;
  }
  return rules;
}

function Play({ mode, run }: { mode: string; run: number }) {
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    let instance: GameInstance | null = null;
    const gameUi = document.getElementById('game-ui')!;
    const bot = q.get('humans') === '0' && Number(q.get('cpus') ?? '0') > 0;
    const players: PlayerSlot[] = [{
      index: 0, profileId: 'p1', name: L('Spieler', 'Player'), color: '#e8c34a', characterId: 'default', headId: 'default',
      kind: bot ? 'cpu' : 'human', input: bot ? undefined : input.inputs[0],
    }];
    const ctx: GameContext = {
      engine, input, audio, assets, save, players, mode,
      rules: rulesFromQuery(),
      ui: {
        mount(node) {
          const host = document.createElement('div');
          host.style.cssText = 'position:absolute;inset:0;pointer-events:none';
          gameUi.appendChild(host);
          render(node as never, host);
          return () => {
            render(null, host);
            host.remove();
          };
        },
        toast: (t) => {
          toastText.value = t;
          setTimeout(() => toastText.value === t && (toastText.value = ''), 2500);
        },
      },
      locale: locale(),
      t: tr,
      seed: q.get('seed') ? Number(q.get('seed')) : (Math.random() * 2 ** 31) | 0,
      query: q,
      pause: openPause,
    };
    const finish = (exit: { reason: string; results?: unknown }) => {
      if (disposed) return;
      disposed = true;
      game.value = null;
      instance?.dispose();
      gameUi.replaceChildren();
      paused.value = false;
      route.value = exit.reason === 'finished' ? { name: 'results', mode, results: exit.results } : { name: 'title' };
    };
    rssouls
      .mount(ctx)
      .then((inst) => {
        if (disposed) return inst.dispose();
        instance = inst;
        game.value = inst;
        inst.onExit.then(finish, (e) => finish({ reason: 'error', results: e }));
      })
      .catch((e) => {
        console.error(e);
        setError(String(e));
      });
    return () => {
      if (disposed) return;
      disposed = true;
      game.value = null;
      instance?.dispose();
      gameUi.replaceChildren();
      paused.value = false;
    };
  }, [mode, run]);

  if (error) return <div class="screen"><h1>RS Souls</h1><p class="err">{error}</p></div>;
  if (!paused.value) return null;
  const s = save.settings.value;
  const vol = (key: 'master' | 'music' | 'sfx', label: string): MenuItem => ({
    label,
    value: `${Math.round(s[key] * 100)} %`,
    onLeft: () => setVolume(key, s[key] - 0.1),
    onRight: () => setVolume(key, s[key] + 0.1),
  });
  return (
    <div class="screen dim">
      <Menu
        title={L('Pause', 'Paused')}
        deps={deps}
        onBack={() => pauseResolve?.('resume')}
        items={[
          { label: L('Weiter', 'Resume'), onSelect: () => pauseResolve?.('resume') },
          { label: L('Neu starten', 'Restart'), onSelect: () => pauseResolve?.('restart') },
          vol('master', L('Lautstärke', 'Volume')),
          vol('music', L('Musik', 'Music')),
          vol('sfx', L('Effekte', 'Effects')),
          { label: L('Zum Titel', 'Quit to title'), onSelect: () => pauseResolve?.('quit') },
        ]}
      />
    </div>
  );
}

function setVolume(key: 'master' | 'music' | 'sfx', v: number) {
  save.updateSettings({ [key]: Math.max(0, Math.min(1, +v.toFixed(2))) });
  audio.applySettings(save.settings.value);
}

function Title() {
  const [, force] = useState(0);
  const [controls, setControls] = useState(false);
  const meta = rssouls.meta;
  if (controls) {
    return (
      <div class="screen">
        <Menu title={L('Steuerung', 'Controls')} deps={deps} onBack={() => setControls(false)}
          items={[{ label: L('Zurück', 'Back'), onSelect: () => setControls(false) }]}>
          <table class="controls">
            <tr><th /><th>{L('Tastatur', 'Keyboard')}</th><th>Gamepad</th></tr>
            {(meta.controls ?? []).map((c) => (
              <tr><td>{tr(c.action)}</td><td>{c.keyboard1}</td><td>{c.gamepad}</td></tr>
            ))}
          </table>
        </Menu>
      </div>
    );
  }
  const items: MenuItem[] = [
    ...meta.modes.map((m) => ({ label: tr(m.title), hint: m.description ? tr(m.description) : undefined, onSelect: () => (route.value = { name: 'play', mode: m.id, run: Date.now() }) })),
    { label: L('Steuerung', 'Controls'), onSelect: () => setControls(true) },
    {
      label: L('Sprache', 'Language'),
      value: locale() === 'de' ? 'Deutsch' : 'English',
      onLeft: () => toggleLang(force),
      onRight: () => toggleLang(force),
    },
  ];
  return (
    <div class="screen">
      <h1 class="logo">RS Souls</h1>
      <p class="tag">{tr(meta.description)}</p>
      <Menu deps={deps} items={items} />
    </div>
  );
}

function toggleLang(force: (f: (n: number) => number) => void) {
  save.updateSettings({ locale: locale() === 'de' ? 'en' : 'de' });
  document.documentElement.lang = locale();
  force((n) => n + 1);
}

function Results({ results }: { results: unknown }) {
  const r = (results ?? {}) as GameResults;
  const lines = Object.values(r.lines ?? {}).filter(Boolean) as string[];
  return (
    <div class="screen">
      <Menu title={r.title ? tr(r.title) : L('Ende', 'The end')} deps={deps}
        items={[{ label: L('Zum Titel', 'Back to title'), onSelect: () => (route.value = { name: 'title' }) }]}>
        {lines.map((l) => <p class="tag">{l}</p>)}
      </Menu>
    </div>
  );
}

function App() {
  const r = route.value;
  return (
    <>
      {r.name === 'title' && <Title />}
      {r.name === 'play' && <Play mode={r.mode} run={r.run} />}
      {r.name === 'results' && <Results results={r.results} />}
      {toastText.value && <div class="toast">{toastText.value}</div>}
    </>
  );
}

// for tests and probes: the same handles the hub exposes
(window as unknown as { pv: unknown }).pv = { engine, input, audio, assets, save, route, game, paused };

(async () => {
  await assets.loadManifest();
  const av = assets.manifest.generatedAt;
  audio.registerSamples(assets.manifest.files, undefined, av);
  audio.registerMusic(assets.manifest.files, undefined, av);
  document.documentElement.lang = locale();
  const mode = q.get('mode');
  if (mode && rssouls.meta.modes.some((m) => m.id === mode)) route.value = { name: 'play', mode, run: Date.now() };
  render(<App />, document.getElementById('ui')!);
})();
