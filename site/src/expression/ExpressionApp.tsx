import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { validateJourney } from '@epilogos/oi-design-system/expressions-engine/shell/model.mjs';
import { PublicField } from '../library/native-player.mjs';

/* The Expression page: one published member of the essay's Expression layer, rendered in full.
   The index is read from ./essay/expressions/index.json, the journey body is fetched, its SHA-256 is
   checked against the digest the index published, and only then is it validated and given to the field.
   Nothing is rendered from an unverified body, and nothing is invented when a step fails. */

type Theme = 'light' | 'dark';
type IndexScene = { id: string; name: string; character: string };
type Entry = {
  id: string; title: string; summary: string; collection: string; group: string;
  scenes: IndexScene[]; nodes: string[]; digest: string; bytes: number; journey: string; cover: string;
};
type ExpressionIndex = { schema: string; collections: { id: string; label: string; count: number }[]; entries: Entry[] };
type TextItem = { id: string; visible?: boolean; kicker?: string; title?: string; italic?: string; body?: string };
type Scene = { id: string; name: string; character?: string; field?: { background?: string }; text?: TextItem[] };
type Journey = { id: string; name: string; scenes: Scene[] };
type Failure = { kind: 'no-expression' | 'not-published' | 'index' | 'journey' | 'integrity' | 'invalid'; title: string; detail: string };
type Loaded = { entry: Entry; journey: Journey; collection: string };
type Load = { status: 'loading' } | { status: 'ready'; data: Loaded } | { status: 'failed'; failure: Failure };

const BASE = './essay/expressions/';
const NODE_CAP = 12;
const MAX_ZOOM = 5;
const MIN_ZOOM = 0.25;

const params = () => new URLSearchParams(location.search);
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

export function initialTheme(): Theme {
  const asked = params().get('theme');
  if (asked === 'light' || asked === 'dark') return asked;
  try { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; }
}

class FailureError extends Error {
  constructor(readonly failure: Failure) { super(failure.detail); }
}

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((v) => v.toString(16).padStart(2, '0')).join('');

async function load(id: string): Promise<Loaded> {
  let index: ExpressionIndex;
  try {
    const response = await fetch(`${BASE}index.json`, { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    index = await response.json();
    if (index.schema !== 'oi.essay-expressions/v1' || !Array.isArray(index.entries)) throw new Error('unexpected index schema');
  } catch (error) {
    throw new FailureError({ kind: 'index', title: 'The Expression index is unavailable.', detail: `The essay's index of published Expressions could not be read (${error instanceof Error ? error.message : String(error)}).` });
  }
  const entry = index.entries.find((candidate) => candidate.id === id);
  if (!entry) throw new FailureError({ kind: 'not-published', title: 'Not published.', detail: `No Expression named “${id}” is published in the essay.` });
  const match = /^sha256:([a-f0-9]{64})$/i.exec(entry.digest || '');
  if (!match || typeof entry.journey !== 'string' || entry.journey.startsWith('/') || entry.journey.split('/').includes('..')) {
    throw new FailureError({ kind: 'invalid', title: 'The published record is malformed.', detail: 'The index entry for this Expression has no usable journey path or digest, so nothing was loaded.' });
  }
  let bytes: ArrayBuffer;
  try {
    const response = await fetch(`${BASE}${entry.journey}`, { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    bytes = await response.arrayBuffer();
  } catch (error) {
    throw new FailureError({ kind: 'journey', title: 'The Expression body is unavailable.', detail: `The journey file named by the index could not be read (${error instanceof Error ? error.message : String(error)}).` });
  }
  const actual = hex(await crypto.subtle.digest('SHA-256', bytes));
  if (actual !== match[1].toLowerCase()) {
    throw new FailureError({ kind: 'integrity', title: 'Integrity check failed.', detail: `The journey file does not match the digest the essay published for it (expected sha256:${match[1].slice(0, 12)}…, received sha256:${actual.slice(0, 12)}…). Nothing was rendered.` });
  }
  let journey: Journey;
  try {
    journey = validateJourney(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (error) {
    throw new FailureError({ kind: 'invalid', title: 'The Expression is not a valid journey.', detail: error instanceof Error ? error.message : String(error) });
  }
  const collection = index.collections?.find((c) => c.id === entry.collection)?.label ?? entry.collection;
  return { entry, journey, collection };
}

function useLoad(id: string | null): Load {
  const [state, setState] = useState<Load>({ status: 'loading' });
  useEffect(() => {
    if (!id) { setState({ status: 'failed', failure: { kind: 'no-expression', title: 'No Expression chosen.', detail: 'Expressions are opened from the essay.' } }); return; }
    let cancelled = false;
    setState({ status: 'loading' });
    load(id).then(
      (data) => { if (!cancelled) setState({ status: 'ready', data }); },
      (error) => {
        if (cancelled) return;
        const failure = error instanceof FailureError ? error.failure : { kind: 'journey' as const, title: 'The Expression could not be loaded.', detail: error instanceof Error ? error.message : String(error) };
        setState({ status: 'failed', failure });
      },
    );
    return () => { cancelled = true; };
  }, [id]);
  return state;
}

function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin) return;
      const data = event.data as { type?: unknown; theme?: unknown } | null;
      if (data && data.type === 'oi-theme' && (data.theme === 'light' || data.theme === 'dark')) setTheme(data.theme);
    };
    window.addEventListener('message', onMessage);
    let media: MediaQueryList | null = null;
    const onScheme = () => { if (media) setTheme(media.matches ? 'dark' : 'light'); };
    const asked = params().get('theme');
    if (asked !== 'light' && asked !== 'dark') {
      try { media = matchMedia('(prefers-color-scheme: dark)'); media.addEventListener('change', onScheme); } catch { media = null; }
    }
    return () => { window.removeEventListener('message', onMessage); media?.removeEventListener('change', onScheme); };
  }, []);
  return theme;
}

function useSceneParam(scenes: Scene[] | null): [string, (id: string) => void, string] {
  const read = () => params().get('scene') ?? '';
  const [asked, setAsked] = useState(read);
  const [stray, setStray] = useState('');
  useEffect(() => {
    const onPop = () => setAsked(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const known = scenes?.some((scene) => scene.id === asked) ?? false;
  const current = known ? asked : scenes?.[0]?.id ?? '';
  const select = useCallback((id: string) => {
    const next = params();
    next.set('scene', id);
    try { history.replaceState(history.state, '', `${location.pathname}?${next.toString()}${location.hash}`); } catch { /* the address is a convenience */ }
    setAsked(id);
    setStray('');
  }, []);
  // The essay's contents list is this Expression's scene list: it asks for a scene by message.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin) return;
      const data = event.data as { type?: unknown; scene?: unknown } | null;
      if (data && data.type === 'oi-scene' && typeof data.scene === 'string' && scenes?.some((scene) => scene.id === data.scene)) select(data.scene);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [scenes, select]);
  // A scene named in the address that the Expression does not have is shown as the first scene, said so, and corrected.
  useEffect(() => {
    if (scenes && asked && !known) { select(scenes[0].id); setStray(asked); }
  }, [scenes, asked, known, select]);
  return [current, select, stray];
}

function Stage({ journey, scene, playing, onPlaying }: { journey: Journey; scene: Scene; playing: boolean; onPlaying: (next: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const field = useRef<PublicField | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const composition = useMemo(() => ({ revision: 1, scenes: journey.scenes.map((s) => ({ scene_ref: s.id, entity_refs: [] as string[] })), entities: {} }), [journey]);
  const sceneMap = useMemo(() => Object.fromEntries(journey.scenes.map((s) => [s.id, s.id])), [journey]);
  const latest = useRef({ composition, sceneMap, journey, sceneId: scene.id, playing });
  latest.current = { composition, sceneMap, journey, sceneId: scene.id, playing };

  useEffect(() => {
    const node = canvas.current!;
    const resident = new PublicField(node, setError, () => setReady(true), () => {});
    field.current = resident;
    const now = latest.current;
    // Playing state first: a paused field settles the chosen scene on its first frame.
    resident.setPlaying(now.playing);
    resident.setScene(now.composition as never, now.sceneId, undefined, now.journey, now.sceneMap);
    resident.setActive(true);
    const wheel = (e: WheelEvent) => { e.preventDefault(); resident.view({ zoom: clamp(resident.camera.zoom * Math.exp(-e.deltaY * 0.001), MIN_ZOOM, MAX_ZOOM) }); };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => { node.removeEventListener('wheel', wheel); resident.dispose(); field.current = null; };
  }, [journey]);
  useEffect(() => { field.current?.setScene(composition as never, scene.id, undefined, journey, sceneMap); }, [composition, sceneMap, journey, scene.id]);
  useEffect(() => { field.current?.setPlaying(playing); }, [playing]);

  const zoom = (factor: number) => { const f = field.current; if (f) f.view({ zoom: clamp(f.camera.zoom * factor, MIN_ZOOM, MAX_ZOOM) }); };
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number; panX: number; panY: number; pan: boolean } | null>(null);
  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const f = field.current;
    if (!f || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '0'].includes(e.key)) return;
    e.preventDefault();
    if (e.key === '0') f.home();
    else if (e.key === '+' || e.key === '=') zoom(1.1);
    else if (e.key === '-') zoom(0.9);
    else f.view({ mode: '3d', yaw: f.camera.yaw + (e.key === 'ArrowLeft' ? -0.12 : e.key === 'ArrowRight' ? 0.12 : 0), pitch: clamp(f.camera.pitch + (e.key === 'ArrowUp' ? -0.12 : e.key === 'ArrowDown' ? 0.12 : 0), -1.4, 1.4) });
  };
  const ground = /^#[0-9a-f]{6}$/i.test(scene.field?.background ?? '') ? scene.field!.background : undefined;
  return (
    <div className="xp-stage" data-playing={playing ? 'true' : 'false'} data-scene={scene.id}>
      <div className="xp-field" style={ground ? { background: ground } : undefined}>
        <canvas
          ref={canvas} tabIndex={0} data-testid="field" aria-label="Expression field. Drag to orbit, shift-drag to pan, scroll or plus and minus to zoom, zero to restore."
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => { const f = field.current; if (!f) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, yaw: f.camera.yaw, pitch: f.camera.pitch, panX: f.camera.panX, panY: f.camera.panY, pan: e.shiftKey || e.button === 2 }; }}
          onPointerMove={(e) => { const d = drag.current, f = field.current; if (!d || !f) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (d.pan) f.view({ panX: d.panX + dx, panY: d.panY + dy }); else f.view({ mode: '3d', yaw: d.yaw + dx * 0.006, pitch: clamp(d.pitch + dy * 0.006, -1.4, 1.4) }); }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
          onKeyDown={onKeyDown}
        />
        {!ready && !error && <div className="xp-loading" role="status"><span />Opening the field…</div>}
        {error && (
          <div className="xp-fielderror" role="alert">
            <h2>The live field needs attention.</h2>
            <p>{error}</p>
            <button type="button" onClick={() => { setError(''); try { field.current?.recover(); } catch (e) { setError(String(e)); } }}>Recover field</button>
          </div>
        )}
        <div className="xp-controls" role="group" aria-label="Field controls">
          <button type="button" aria-pressed={playing} aria-label={playing ? 'Pause the field' : 'Play the field'} title={playing ? 'Pause' : 'Play'} data-control="play" onClick={() => onPlaying(!playing)}>
            {playing
              ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10M11 3v10" /></svg>
              : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l8 5-8 5z" /></svg>}
          </button>
          <span className="xp-sep" aria-hidden="true" />
          <button type="button" aria-label="Zoom out" title="Zoom out" data-control="zoom-out" onClick={() => zoom(0.8)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" /></svg></button>
          <button type="button" aria-label="Restore the scene view" title="Restore view" data-control="home" onClick={() => field.current?.home()}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3" /></svg></button>
          <button type="button" aria-label="Zoom in" title="Zoom in" data-control="zoom-in" onClick={() => zoom(1.2)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M8 3v10" /></svg></button>
        </div>
      </div>
    </div>
  );
}

function Editorial({ scene }: { scene: Scene }) {
  const items = (scene.text ?? []).filter((item) => item && item.visible !== false && (item.kicker || item.title || item.italic || item.body));
  if (!items.length) return <p className="xp-quiet">This scene carries no editorial text.</p>;
  let titled = false;
  return (
    <div className="xp-text" data-testid="editorial">
      {items.map((item, i) => {
        const heading = item.title ? (titled ? <h3 className="xp-title xp-title--minor">{item.title}</h3> : (titled = true, <h2 className="xp-title">{item.title}</h2>)) : null;
        const paragraphs = (item.body ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
        return (
          <section key={item.id || i} className="xp-item">
            {item.kicker && <p className="xp-kicker">{item.kicker}</p>}
            {heading}
            {item.italic && <p className="xp-italic">{item.italic}</p>}
            {paragraphs.map((p, j) => <p key={j} className="xp-body">{p}</p>)}
          </section>
        );
      })}
    </div>
  );
}

function SceneList({ scenes, current, onSelect }: { scenes: Scene[]; current: string; onSelect: (id: string) => void }) {
  const list = useRef<HTMLOListElement>(null);
  const index = Math.max(0, scenes.findIndex((s) => s.id === current));
  const move = (to: number) => {
    const next = clamp(to, 0, scenes.length - 1);
    onSelect(scenes[next].id);
    list.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowDown: index + 1, ArrowRight: index + 1, ArrowUp: index - 1, ArrowLeft: index - 1, Home: 0, End: scenes.length - 1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    move(keys[e.key]);
  };
  return (
    <nav className="xp-scenes" aria-label="Scenes">
      <h2 className="xp-label">Scenes</h2>
      <ol ref={list} onKeyDown={onKeyDown}>
        {scenes.map((scene, i) => (
          <li key={scene.id}>
            <button type="button" data-scene-id={scene.id} aria-current={scene.id === current ? 'step' : undefined} onClick={() => onSelect(scene.id)}>
              <span className="xp-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="xp-scene-name">{scene.name}</span>
              {scene.character && <span className="xp-scene-char">{scene.character}</span>}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

const slugHref = (slug: string) => `./essay/${slug.split('/').map(encodeURIComponent).join('/')}`;
const slugLabel = (slug: string) => { const last = slug.split('/').pop() || slug; try { return decodeURIComponent(last).replace(/-/g, ' '); } catch { return last; } };

function InTheEssay({ nodes }: { nodes: string[] }) {
  if (!nodes.length) return null;
  const shown = nodes.slice(0, NODE_CAP);
  const more = nodes.length - shown.length;
  return (
    <section className="xp-essay" aria-labelledby="xp-essay-h">
      <h2 className="xp-label" id="xp-essay-h">In the essay</h2>
      <ul>
        {shown.map((slug) => <li key={slug}><a href={slugHref(slug)} target="_top" title={slug} onClick={(event) => {
          // inside the essay field a page opens as a tangent beside the Expression, not over it
          if (window.parent !== window && !(event.metaKey || event.ctrlKey || event.shiftKey)) { event.preventDefault(); window.parent.postMessage({ type: 'oi-open', slug }, location.origin); }
        }}>{slugLabel(slug)}</a></li>)}
      </ul>
      {more > 0 && <p className="xp-more">+{more} more</p>}
    </section>
  );
}

function State({ failure }: { failure: Failure }) {
  return (
    <main className="xp-state" role={failure.kind === 'no-expression' ? 'status' : 'alert'} data-state={failure.kind}>
      <p className="xp-kicker">Expression</p>
      <h1>{failure.title}</h1>
      <p>{failure.detail}</p>
      <p><a href="./essay/" target="_top">Back to the essay</a></p>
    </main>
  );
}

export function ExpressionApp() {
  const embed = params().get('embed') === '1';
  const id = params().get('x');
  const theme = useTheme();
  const state = useLoad(id);
  const data = state.status === 'ready' ? state.data : null;
  const [sceneId, selectScene, stray] = useSceneParam(data?.journey.scenes ?? null);
  const [playing, setPlaying] = useState(() => { try { return !matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } });

  useEffect(() => { if (data) document.title = `${data.entry.title} — O:I`; }, [data]);

  const scenes = data?.journey.scenes ?? [];
  const index = Math.max(0, scenes.findIndex((s) => s.id === sceneId));
  const scene = scenes[index];
  // Stepping with the header buttons brings the new scene's text back to its top; picking from the list stays where the list is.
  const side = useRef<HTMLDivElement>(null);
  const toTop = useRef(false);
  const step = (id: string) => { toTop.current = true; selectScene(id); };
  const pick = (id: string) => { toTop.current = false; selectScene(id); };
  useEffect(() => { if (toTop.current) { side.current?.scrollTo({ top: 0 }); toTop.current = false; } }, [scene?.id]);

  return (
    <div className="xp" data-embed={embed ? 'true' : 'false'} data-theme-applied={theme} data-state={state.status === 'failed' ? state.failure.kind : state.status}>
      {!embed && (
        <header className="xp-bar">
          <a className="xp-mark" href="./" aria-label="O:I home">O:I</a>
          <a className="xp-back" href="./essay/">← The essay</a>
        </header>
      )}
      {state.status === 'loading' && <div className="xp-boot" role="status">Verifying the published Expression…</div>}
      {state.status === 'failed' && <State failure={state.failure} />}
      {data && scene && (
        <>
          <header className="xp-head">
            <p className="xp-crumb">{data.collection}{data.entry.group && data.entry.group !== data.collection ? ` · ${data.entry.group}` : ''}</p>
            <h1 title={data.entry.title}>{data.entry.title}</h1>
            <div className="xp-step">
              <button type="button" aria-label="Previous scene" disabled={index === 0} data-control="prev" onClick={() => step(scenes[index - 1].id)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg></button>
              <span className="xp-count" data-testid="count" aria-live="polite">Scene {index + 1} of {scenes.length}</span>
              <button type="button" aria-label="Next scene" disabled={index === scenes.length - 1} data-control="next" onClick={() => step(scenes[index + 1].id)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg></button>
            </div>
          </header>
          <main className="xp-main">
            <div className="xp-stagecol">
              <Stage journey={data.journey} scene={scene} playing={playing} onPlaying={setPlaying} />
            </div>
            <div className="xp-side" ref={side}>
              {stray && <p className="xp-quiet" role="status">The scene named in the address (“{stray}”) is not in this Expression; showing its first scene.</p>}
              <Editorial scene={scene} />
              <SceneList scenes={scenes} current={scene.id} onSelect={pick} />
              {data.entry.summary && <section className="xp-about"><h2 className="xp-label">About this Expression</h2><p>{data.entry.summary}</p></section>}
              <InTheEssay nodes={data.entry.nodes ?? []} />
            </div>
          </main>
        </>
      )}
    </div>
  );
}
