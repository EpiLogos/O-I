// The Timeline projection's World cut — Session and Arrangement presenting
// World material as tracks (WORLD-SHELL-DESIGN §3.2, §10 seam 5; Revision 2:
// "Timeline holds M2′ and M3′… authored history beside development on one
// non-linear ruler with a declared break into today").
//
// Forms are the world mockup's Timeline forms (world-shell-mockup.html
// §Timeline, the widget-guide floor): track lanes with activator lights,
// moment clips drawn in their epistemic standing, the now / occasion /
// transport cursors, the non-linear deep-time ruler with the declared
// break into today, and the four lenses (chronology · causal · recurrence
// · concurrency). The deep-time scale is the ATLAS PORT'S, adopted by
// import — never re-ported (port law); the today-hours half is the
// projection's own.
//
// Honesty: clips are placed only where the reading dated them; undated
// material stands in the 'undated' column in relative order (no fake
// dates); the causal and recurrence lenses draw their forms and disclose
// that no typed-relation reading is bound yet (the graph owner's); the
// deep-time half discloses that no family has bound epoch material in
// this reading; standing comes from the source and placement never
// upgrades it. The transport advances the playhead over the presented
// clips and drives nothing else — no shell timer is a clock.

import {useEffect, useMemo, useRef, useState} from 'react';
import {createTimeScale, formatYear} from './atlas/src/data/time';
import {eventHourOfDay, readStanding} from '../timeline/timeSpine';
import {journeyWalksOf, walkStopFocus, walkStopOfClip} from '../timeline/journeyWalks';
import {applyWalkStopFocus} from '../timeline/walkFocus';
import {JourneyRows, type JourneyPresentation} from '../timeline/JourneyRows';
import type {WorldTrackClip, WorldTrackSection, WorldTrackSet, WorldWalk, WorldWalkStop} from '../timeline/worldTrackAdapter';
import {STANDING_DRAWING, standingLabel, type StandingDrawing} from '../../../../../desktop/cradle/expressions-app/vendor/research-canvas/packages/canvas/src/timeline/standingStyle';
import type {StandingReading, StandingVisual} from '../../../../../desktop/cradle/src/techne/m0m5/timeline/standing';
import type {WorldTimelineView} from './useWorldTemporalReading';
import './worldTimeline.css';

const LENSES = ['chronology', 'concurrency', 'causal', 'recurrence'] as const;
export type WorldTimelineLens = (typeof LENSES)[number];

// The declared break into today (the mockup's chronology ruler: deep
// history keeps 61%, today's hours take the rest).
const TODAY_BREAK = 61;

const groupOfTrackKind = (kind: string): string => {
  if (kind === 'run' || kind === 'run-overflow') return 'Runs · Factory & agency';
  if (kind === 'conversation' || kind === 'conversation-overflow') return 'Conversations';
  if (kind === 'cron') return 'Cron · firings';
  // The atlas's Aion readings: their event lanes and walk lanes (T-TIMELINE-WALKS leg 3).
  if (kind === 'atlas-aion-events' || kind === 'walk') return 'Atlas · Aion readings';
  // [L9 musical family] the QL family's role-classified track material.
  if (kind.startsWith('ql-audio/')) return 'QL · audio';
  if (kind.startsWith('ql-physics/')) return 'QL · physics';
  return 'Central · civil field';
};

interface PlacedClip {
  clip: WorldTrackClip;
  /** Day key when the clip is dated to a civil day column. */
  day: string | null;
  /** Day-local hour when known (0–24). */
  hour: number | null;
  trackId: string;
  selected: boolean;
}

const hourOfSpan = (clip: WorldTrackClip): number | null => {
  if (!clip.span) return null;
  const start = clip.span.start;
  return Number.isFinite(start) && start >= 0 && start <= 24 ? start : null;
};

const dayOfColumn = (columnId: string): string | null => {
  if (!columnId.startsWith('day:')) return null;
  const day = columnId.slice(4);
  return day === 'undated' ? 'undated' : day;
};

// ── standing marks ──────────────────────────────────────────────────────────
// A clip is drawn in the standing its source discloses (WORLD-SHELL-DESIGN §1,
// Revision 2: "never upgraded by placement"). The class comes only from the one
// authority, standingOf (desktop/cradle/src/techne/m0m5/timeline/standing.ts),
// which the track adapter reads onto clip.standing. The drawing is the shared
// grammar's (STANDING_DRAWING, standingStyle.ts). This file holds no class table.
const UNDISCLOSED: StandingReading = readStanding({standing: null, source_ref: null, evidence_refs: [], derivation_ref: null});

export interface ClipStandingMark {
  reading: StandingReading;
  /** The class the clip is drawn in: the authority's visual class. */
  visual: StandingVisual;
  /** The verbatim stated word when the source states one, else the grammar's legend label for the class. */
  word: string;
  stroke: string;
  /** The CSS border style the grammar's dash pattern draws as. */
  line: 'solid' | 'dashed' | 'dotted';
}

export function clipStandingMark(clip: WorldTrackClip): ClipStandingMark {
  const reading = clip.standing ?? UNDISCLOSED;
  const drawing: StandingDrawing = STANDING_DRAWING[reading.visual];
  const line: ClipStandingMark['line'] = drawing.dash === undefined
    ? 'solid'
    : Number(drawing.dash.split(' ')[0]) <= 2 ? 'dotted' : 'dashed';
  return {reading, visual: reading.visual, word: reading.verbatim ?? standingLabel(reading.visual), stroke: drawing.stroke, line};
}

/** The accessible name of a clip: its label and the standing it is drawn in. */
const clipAccessibleName = (label: string, mark: ClipStandingMark): string => `${label} — standing ${mark.word}`;

/** A visible standing tag on the label. A sourced clip with no stated word carries no tag. */
const clipStandingTag = (mark: ClipStandingMark): string =>
  mark.reading.verbatim == null && mark.visual === 'sourced' ? '' : ` · ${mark.word}`;

/** Standing attributes shared by every clip form. */
const clipStandingAttributes = (mark: ClipStandingMark) => ({
  'data-standing': mark.visual,
  'data-standing-stated': mark.reading.verbatim ?? undefined,
});

export function WorldTimelinePresentation({view, presentation, journey}: {
  view: WorldTimelineView;
  presentation: 'session' | 'arrangement';
  /** Technē's live Session presents the Journey (T-TIMELINE-WALKS leg 4): the walks as rows above the session cells.
   * Absent everywhere else, and the Arrangement never takes it. */
  journey?: JourneyPresentation;
}) {
  const {source, spine, selectOccasion} = view;
  const [lens, setLens] = useState<WorldTimelineLens>('chronology');
  const [hiddenTracks, setHiddenTracks] = useState<ReadonlySet<string>>(new Set());
  // The named absence of the last walk stop focus (an atlas epoch the atlas does not hold, a stop with no focus).
  const [named, setNamed] = useState<string | null>(null);
  // The spine is the truth; this component re-renders on its changes
  // (occasion, transport, cron firings) through this subscription.
  const [tick, setTick] = useState(0);
  useEffect(() => spine.subscribe(() => setTick((value) => value + 1)), [spine]);
  const occasion = spine.occasion();
  const transport = spine.transport();

  const cronSet = useMemo((): WorldTrackSet => ({
    columns: [{id: 'cron', name: 'firings'}],
    tracks: [{id: 'cron', name: 'cron · firings', kind: 'cron'}],
    clips: spine.cronClips(),
  }), [spine, tick]);

  const sets = useMemo(() => [...source.sets, cronSet], [source.sets, cronSet]);

  const rows = useMemo(() => {
    const seen = new Set<string>();
    const list: {id: string; name: string; kind: string; group: string}[] = [];
    for (const set of sets) {
      for (const track of set.tracks) {
        if (seen.has(track.id)) continue;
        seen.add(track.id);
        list.push({...track, group: groupOfTrackKind(track.kind)});
      }
    }
    return list;
  }, [sets]);

  const columns = useMemo(() => {
    const seen = new Map<string, string>();
    for (const set of sets) for (const column of set.columns) if (!seen.has(column.id)) seen.set(column.id, column.name);
    return [...seen.entries()].map(([id, name]) => ({id, name}));
  }, [sets]);

  // The covered civil days (the week strip's columns) — every hook stands
  // ABOVE the honest-state returns; a status flip never changes the hook
  // order.
  const coveredDays = useMemo(
    () => columns.filter((column) => /^day:\d{4}-\d{2}-\d{2}$/.test(column.id)).map((column) => column.id.slice(4)).sort(),
    [columns],
  );

  // Clip placement: the deep-time half stands ready (adopted atlas scale)
  // and honestly empty in this reading; today's hours take the rest.
  const todayYear = source.now ? new Date(source.now.instantUnixMs).getUTCFullYear() : new Date().getUTCFullYear();
  const deepScale = useMemo(() => createTimeScale(-1000, todayYear), [todayYear]);

  const placed = useMemo((): PlacedClip[] => {
    const list: PlacedClip[] = [];
    const occasionRefs = new Set(spine.occasions().map((entry) => entry.basis.ref));
    for (const set of sets) {
      const columnName = new Map(set.columns.map((column) => [column.id, column.name]));
      for (const clip of set.clips) {
        if (hiddenTracks.has(clip.trackId)) continue;
        const day = dayOfColumn(clip.columnId);
        const event = source.eventByClipId.get(clip.id);
        // Placement time: a real span's start, else the source event's
        // own civil hour (a moment is placed at its instant — no span is
        // invented to carry it).
        const hour = clip.span ? hourOfSpan(clip) : event ? eventHourOfDay(event) : null;
        list.push({
          clip,
          day: day ?? columnName.get(clip.columnId) ?? null,
          hour: hour == null && event ? eventHourOfDay(event) : hour,
          trackId: clip.trackId,
          selected: !!event && occasionRefs.has(event.subject_ref),
        });
      }
    }
    return list;
  }, [sets, hiddenTracks, spine, source.eventByClipId]);

  // The transport playhead walks the presented clips in column-then-track
  // order; the interval is the transport's own (a playhead mover, never a
  // clock — it drives nothing but the position).
  const orderRef = useRef<string[]>([]);
  orderRef.current = placed.map((entry) => entry.clip.id);
  useEffect(() => {
    if (!transport.playing) return;
    const id = setInterval(() => {
      const order = orderRef.current;
      if (!order.length) return;
      const at = order.indexOf(transport.positionClipId ?? '');
      const next = order[(at + 1) % order.length];
      spine.setTransportPosition(next);
      setTick((value) => value + 1);
    }, 2500);
    return () => clearInterval(id);
  }, [transport.playing, transport.positionClipId, spine]);

  if (source.status === 'unavailable') {
    return <div className="view-empty">The civil field is unread — {source.error ?? 'the kernel read is unavailable'}. The Timeline projection presents World tracks only over a real reading.</div>;
  }
  if (source.status === 'reading') {
    return <div className="view-empty">Reading the civil field… the day, run and conversation tracks place the reading's events.</div>;
  }

  const now = source.now;
  const nowDate = now ? new Date(now.instantUnixMs) : null;
  const nowHourValue = nowDate ? nowDate.getUTCHours() + nowDate.getUTCMinutes() / 60 : null;
  // The civil day key: the reading's day ref may be the full Central ref
  // (central:day:…:2026-10-09) — the date is what the strip addresses.
  const todayLabel = now?.dayRef
    ? now.dayRef.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? now.dayRef
    : nowDate
      ? nowDate.toISOString().slice(0, 10)
      : '—';
  const occasionHour = occasion?.basis.instantUnixMs != null
    ? (() => {const d = new Date(occasion.basis.instantUnixMs); return d.getUTCHours() + d.getUTCMinutes() / 60;})()
    : null;
  const occasionDay = occasion?.basis.instantUnixMs != null ? new Date(occasion.basis.instantUnixMs).toISOString().slice(0, 10) : null;

  // The covered civil days tile the lane after the declared break: one
  // column per day, the day's hours inside it — a week strip, so material
  // from different days never overlays (a week window is the day track's
  // own scale). Undated material stands before the strip, unplaced.
  const daySpan = Math.max(1, coveredDays.length);
  const weekX = (day: string | null, hour: number | null): number | null => {
    if (day == null || hour == null) return null;
    const index = coveredDays.indexOf(day);
    if (index < 0) return null;
    return TODAY_BREAK + ((index + Math.max(0, Math.min(24, hour)) / 24) / daySpan) * (100 - TODAY_BREAK);
  };
  const clipX = (entry: PlacedClip): number | null => weekX(entry.day, entry.hour);

  // A walk stop focuses what the Journey would focus for it: its occasion, or its layer's epoch in the atlas (the atlas
  // owns its camera), or the named reason it cannot. A clip that is neither a mapped occasion nor a walk stop selects
  // nothing.
  const focusWalkStop = (walk: WorldWalk, stop: WorldWalkStop) => {
    const focus = walkStopFocus(walk, stop, source.eventByClipId);
    void applyWalkStopFocus(focus, selectOccasion).then(setNamed);
  };
  const selectClip = (entry: PlacedClip) => {
    const event = source.eventByClipId.get(entry.clip.id);
    if (event) {
      selectOccasion(event);
      return;
    }
    const found = walkStopOfClip(sets, entry.clip.id);
    if (found) focusWalkStop(found.walk, found.stop);
  };

  const clipsForTrack = (trackId: string): PlacedClip[] => placed.filter((entry) => entry.trackId === trackId);

  const rulerTicks = (() => {
    if (lens === 'concurrency') {
      const todayIndex = Math.max(0, coveredDays.indexOf(todayLabel));
      const todayStart = TODAY_BREAK + (todayIndex / daySpan) * (100 - TODAY_BREAK);
      const dayWidth = (100 - TODAY_BREAK) / daySpan;
      return [0, 6, 12, 18].map((hour) => ({
        x: todayStart + (hour / 24) * dayWidth,
        label: `${String(hour).padStart(2, '0')}:00`,
        today: hour === 0,
      }));
    }
    // Era bands live in the deep half only: the adopted scale's u-space
    // maps into 0..TODAY_BREAK; the civil week takes the rest.
    return [
      ...deepScale.eras.map((era) => ({x: deepScale.toU(era.from) * TODAY_BREAK, label: era.name, today: false})),
      {x: TODAY_BREAK, label: '⟩ week', today: true},
      ...coveredDays.map((day) => ({
        x: TODAY_BREAK + ((coveredDays.indexOf(day) + (day === todayLabel ? 0.5 : 0)) / daySpan) * (100 - TODAY_BREAK),
        label: day === todayLabel ? `⟩ ${day.slice(5)}` : day.slice(5),
        today: day === todayLabel,
      })),
    ];
  })();

  const transportPosition = transport.positionClipId
    ? placed.find((entry) => entry.clip.id === transport.positionClipId) ?? null
    : null;

  const trackRow = (track: (typeof rows)[number]) => {
    const hidden = hiddenTracks.has(track.id);
    const entries = clipsForTrack(track.id);
    // Moment dots thin their side labels the mockup's way: a label only
    // when the next dot leaves room (the hover title always carries it).
    const labelled = new Map<string, boolean>();
    const withX = entries.map((entry) => ({entry, x: clipX(entry)})).filter((item) => item.x != null) as {entry: PlacedClip; x: number}[];
    withX.sort((a, b) => a.x - b.x);
    withX.forEach((item, index) => {
      const next = withX[index + 1];
      labelled.set(item.entry.clip.id, next == null || next.x - item.x > 6);
    });
    const lane = (
      <div className={`wt-lane${presentation === 'session' ? ' wt-session-lane' : ''}`} data-track={track.id}>
        {presentation === 'arrangement' && entries.map((entry) => {
          const x = clipX(entry);
          const mark = clipStandingMark(entry.clip);
          if (x == null) {
            return <button key={entry.clip.id} className="wt-clip wt-undated" {...clipStandingAttributes(mark)}
              style={{borderLeft: `2px ${mark.line} ${mark.stroke}`}}
              title={`${entry.clip.label} · undated — relative order, no fabricated date · standing ${mark.word} · ${mark.reading.rule}`}
              aria-label={clipAccessibleName(entry.clip.label, mark)}
              onClick={() => selectClip(entry)}><span className="wt-clip-label">{entry.clip.label}{clipStandingTag(mark)}</span></button>;
          }
          const moment = entry.clip.span == null;
          const showLabel = labelled.get(entry.clip.id) ?? false;
          if (moment) {
            // The mockup's point form: a dot at the instant, a faint side
            // label when the next dot leaves room.
            return <span key={entry.clip.id} className="wt-point-wrap">
              <button className={`wt-clip wt-point${entry.selected ? ' is-selected' : ''}`}
                style={{left: `${x}%`, borderColor: mark.stroke, borderStyle: mark.line}} {...clipStandingAttributes(mark)}
                title={`${entry.clip.label} · ${entry.day ?? '—'}${entry.hour != null ? ` · ${String(Math.floor(entry.hour)).padStart(2, '0')}:${String(Math.round((entry.hour % 1) * 60)).padStart(2, '0')} UTC` : ''} · standing ${mark.word} · ${mark.reading.rule}`}
                aria-label={clipAccessibleName(entry.clip.label, mark)}
                onClick={() => selectClip(entry)} />
              {showLabel && <span className="wt-side-label" style={{left: `calc(${x}% + 8px)`}}>{entry.clip.label}{clipStandingTag(mark)}</span>}
            </span>;
          }
          return <button key={entry.clip.id}
            className={`wt-clip${entry.selected ? ' is-selected' : ''}`}
            style={{left: `${x}%`, width: `min(${Math.max(6, (100 - TODAY_BREAK) / daySpan / 2)}%, 240px)`, borderLeft: `2px ${mark.line} ${mark.stroke}`}}
            {...clipStandingAttributes(mark)}
            title={`${entry.clip.label} · ${entry.day ?? '—'} · standing ${mark.word} · ${mark.reading.rule}`}
            aria-label={clipAccessibleName(entry.clip.label, mark)}
            onClick={() => selectClip(entry)}><span className="wt-clip-label">{entry.clip.label}{clipStandingTag(mark)}</span></button>;
        })}
        {presentation === 'session' && <div className="wt-session-cells">
          {columns.map((column) => {
            const cells = entries.filter((entry) => entry.clip.columnId === column.id);
            return <div key={column.id} className="wt-session-cell" data-column={column.id}>
              {cells.map((entry) => {
                const mark = clipStandingMark(entry.clip);
                return <button key={entry.clip.id}
                  className={`wt-clip wt-cell-clip${entry.selected ? ' is-selected' : ''}`} {...clipStandingAttributes(mark)}
                  style={{borderLeft: `2px ${mark.line} ${mark.stroke}`}}
                  title={`${entry.clip.label} · ${column.name} · standing ${mark.word} · ${mark.reading.rule}`}
                  aria-label={clipAccessibleName(entry.clip.label, mark)}
                  onClick={() => selectClip(entry)}>{entry.clip.label}{clipStandingTag(mark)}</button>;
              })}
            </div>;
          })}
        </div>}
        {presentation === 'arrangement' && <div className="wt-ruler-layer">
          <div className="wt-break" style={{left: `${TODAY_BREAK}%`}} />
          {lens !== 'concurrency' && nowHourValue != null && (() => {const x = weekX(todayLabel, nowHourValue); return x != null ? <div className="wt-cursor wt-now" style={{left: `${x}%`}}><span className="wt-cursor-label">now</span></div> : null;})()}
          {occasionHour != null && (() => {const x = weekX(occasionDay, occasionHour); return x != null ? <div className="wt-cursor wt-occasion" style={{left: `${x}%`}}><span className="wt-cursor-label">occasion</span></div> : null;})()}
          {transportPosition?.hour != null && (() => {const x = weekX(transportPosition.day, transportPosition.hour); return x != null ? <div className="wt-cursor wt-transport" style={{left: `${x}%`}}><span className="wt-cursor-label">▶</span></div> : null;})()}
        </div>}
      </div>
    );
    return <div key={track.id} className={`wt-row${hidden ? ' is-hidden' : ''}`} data-track-row={track.id}>
      <div className="wt-track-head">
        <button className={'wt-activator' + (hidden ? '' : ' is-on')}
          data-i="Track activator|Admit this lane's material into the projection, or silence it — placement never changes what the lane holds."
          aria-pressed={!hidden}
          onClick={() => setHiddenTracks((previous) => {
            const next = new Set(previous);
            if (next.has(track.id)) next.delete(track.id); else next.add(track.id);
            return next;
          })}>{track.name}</button>
        <span className="wt-track-kind">{track.kind}</span>
      </div>
      {lane}
    </div>;
  };

  const groups: string[] = [];
  for (const track of rows) if (!groups.includes(track.group)) groups.push(track.group);

  // The walks and nested sections the sets carry, drawn from the same sets as the lanes (leg 1's layer/section model).
  // Sections are nested by their parents, ordered by their own spans (units are the family's own: no unit is shown
  // as a date), coloured by their atmosphere. Walks are ordered rails: a stop focuses its occasion or its atlas epoch.
  const sectionBlocks = sets.flatMap((set, setIndex) => {
    const sections = set.sections ?? [];
    if (sections.length === 0) return [];
    const byId = new Map(sections.map((section) => [section.id, section] as const));
    const depthOf = (section: WorldTrackSection): number => {
      let depth = 0;
      const seen = new Set<string>([section.id]);
      let parent = section.parentId ? byId.get(section.parentId) : undefined;
      while (parent && !seen.has(parent.id)) {
        seen.add(parent.id);
        depth += 1;
        parent = parent.parentId ? byId.get(parent.parentId) : undefined;
      }
      return depth;
    };
    const layerName = new Map((set.layers ?? []).map((layer) => [layer.id, layer.name] as const));
    const ordered = sections
      .map((section) => ({section, depth: depthOf(section)}))
      .sort((a, b) => a.section.span.start - b.section.span.start || b.section.span.end - a.section.span.end || a.depth - b.depth);
    const byLayer = new Map<string, typeof ordered>();
    for (const item of ordered) {
      const key = item.section.layerId ?? '';
      byLayer.set(key, [...(byLayer.get(key) ?? []), item]);
    }
    return [...byLayer.entries()].map(([layerId, items]) => <div key={`${setIndex}:${layerId}`} className="wt-row" data-section-layer={layerId || undefined}>
      <div className="wt-track-head">
        <span>{layerName.get(layerId) ?? 'Sections'}</span>
        <span className="wt-track-kind">sections · nested</span>
      </div>
      <div className="wt-lane" style={{display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center'}}>
        {items.map(({section, depth}) => <span key={section.id} data-section={section.id} data-depth={depth}
          title={`${section.name} · span ${section.span.start}–${section.span.end} (the family's own units)`}
          style={{marginLeft: depth * 12, padding: '1px 6px', fontSize: 11, color: 'var(--wt-fact)', background: 'var(--wt-line-faint)', borderLeft: `3px solid ${section.atmosphere ?? 'var(--wt-line)'}`}}>
          {section.name}
        </span>)}
      </div>
    </div>);
  });

  const walkBlocks = sets.flatMap((set) => set.walks ?? []).map((walk: WorldWalk) => <div key={walk.id} className="wt-row"
    data-walk-row={walk.id} data-walk-kind={walk.kind} data-walk-derived={walk.derived ? 'derived' : 'curated'}>
    <div className="wt-track-head">
      <span>{walk.name}</span>
      <span className="wt-track-kind">{walk.kind} · {walk.derived ? 'derived on read' : 'curated'} · {walk.stops.length} {walk.stops.length === 1 ? 'stop' : 'stops'}</span>
    </div>
    <div className="wt-lane" style={{display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center'}}>
      {walk.stops.map((stop, index) => <button key={`${walk.id}:${index}`} type="button" data-walk-stop={index + 1} data-stop-ref={stop.id}
        title={`${stop.label}${stop.year !== undefined ? ` · ${formatYear(stop.year)}` : ''}${stop.place?.label ? ` · ${stop.place.label}` : ''}${stop.also.length ? ` · ${stop.also.length} attached` : ''}`}
        onClick={() => focusWalkStop(walk, stop)}
        style={{font: 'inherit', fontSize: 10, color: 'var(--wt-text-faint)', background: 'transparent', border: '1px solid var(--wt-line-faint)', padding: '1px 5px', cursor: 'pointer', whiteSpace: 'nowrap'}}>
        {index + 1}/{walk.stops.length} {stop.label}{stop.year !== undefined ? ` · ${formatYear(stop.year)}` : ''}
      </button>)}
    </div>
  </div>);

  // The Journey's walks: the same walks the rails draw, by reference (the Journey presents them as rows).
  const journeyWalks = journeyWalksOf(source.sets);

  const walkAndSectionGroup = <div className="wt-group" data-world-walks={walkBlocks.length}>
    <div className="wt-group-head">Walks · sections</div>
    {sectionBlocks}
    {walkBlocks}
    {walkBlocks.length === 0 && <div className="wt-absence" role="note">No walks are carried by the World's track sets. The atlas's Aion walks join when the Earth pane has loaded its reading.</div>}
    {named && <div className="wt-absence" role="status">{named}</div>}
  </div>;

  return <div className={`world-timeline wt-${presentation}`} data-world-cut="true" data-lens={lens}>
    <div className="wt-controls" role="toolbar" aria-label="Time spine controls">
      <span className="wt-chip wt-now-chip" data-i="Now|The situated civil field: the reading's own newest instant and day. It drives Earth and Timeline alike — never the wall clock.">
        <em>Now</em> {todayLabel}{nowHourValue != null ? ` · ${String(Math.floor(nowHourValue)).padStart(2, '0')}:${String(Math.round((nowHourValue % 1) * 60)).padStart(2, '0')} UTC` : ''}
      </span>
      <span className="wt-chip wt-occasion-chip" data-i="Occasion|A retained event's time. Its basis is kept exactly as first read; current admission is a separate qualification.">
        <em>Occasion</em>
        {occasion
          ? <>{occasion.basis.summary ? `${occasion.basis.summary.slice(0, 42)}${occasion.basis.summary.length > 42 ? '…' : ''}` : occasion.basis.ref}
            <span className={`wt-light ${occasion.admission ? (occasion.admission.admitted ? 'is-admitted' : 'is-refused') : 'is-unqualified'}`}
              title={occasion.admission ? `Current admission: ${occasion.admission.admitted ? 'admitted' : 'no longer in the reading'} — ${occasion.admission.disclosure}` : 'Current admission not yet qualified against a fresh reading'} />
            {occasion.basis.instantUnixMs != null && <small> · {formatYear(new Date(occasion.basis.instantUnixMs).getUTCFullYear())}</small>}
          </>
          : ' none retained'}
      </span>
      <span className="wt-chip wt-transport-chip" data-i="Transport|The projection's playhead over performable material. It moves over clips and drives nothing else — no shell timer is a clock.">
        <button aria-label={transport.playing ? 'Stop the playhead' : 'Move the playhead over the presented clips'}
          onClick={() => {
            if (transport.playing) spine.setTransportPlaying(false);
            else {
              if (!transport.positionClipId && orderRef.current.length) spine.setTransportPosition(orderRef.current[0]);
              spine.setTransportPlaying(true);
            }
          }}>{transport.playing ? '■' : '▶'}</button>
        <small>{transportPosition ? transportPosition.clip.label.slice(0, 28) : 'playhead at rest'}</small>
      </span>
      <span className="wt-chip wt-cron-chip" data-i="Cron|Declared cadences are parameters; each real firing lands as a clip. The read cadence is the first: this projection's own civil-field read.">
        <em>Cron</em> {source.readCadence ? `${source.readCadence.label} · every ${Math.round(source.readCadence.everyMs / 1000)}s` : 'no cadence'}
        · {spine.firings().length} firing{spine.firings().length === 1 ? '' : 's'} landed
      </span>
      <span className="wt-chip wt-read-chip" data-i="Civil-field read|The one kernel temporal read this cut stands on (K1's bounded, cached read). Adapters project it; nothing is copied into a second store.">
        read {source.readAtUnixMs ? new Date(source.readAtUnixMs).toISOString().slice(11, 19) : '—'} · {source.events.length} events
        {source.admittedRunsError ? <em className="wt-read-fault" role="note"> · {source.admittedRunsError}</em> : source.admittedRuns ? <small> · {source.admittedRuns.length} runs admitted</small> : null}
      </span>
    </div>
    <div className="wt-lenses" role="tablist" aria-label="Timeline lenses">
      {LENSES.map((value) => <button key={value} role="tab" aria-selected={lens === value}
        data-i={`Lens · ${value}|${value === 'causal' || value === 'recurrence' ? 'The lens form stands; typed relations bind through the graph owner — no relation reading is bound yet, so the lens discloses its absence.' : value === 'concurrency' ? 'Today on the hour ruler.' : 'Non-linear deep time with the declared break into today.'}`}
        onClick={() => setLens(value)}>{value}</button>)}
    </div>
    {(lens === 'causal' || lens === 'recurrence') && <div className="wt-absence" role="note">
      The {lens} lens draws typed relations along the axis. No typed-relation reading is bound yet — relations are the graph owner's; this cut places events only, and invents no edges.
    </div>}
    {presentation === 'arrangement' && <div className="wt-ruler" aria-hidden="true">
      {rulerTicks.map((tickEntry, index) => <span key={`${tickEntry.label}-${index}`} className={tickEntry.today ? 'wt-tick wt-tick-today' : 'wt-tick'} style={{left: `${tickEntry.x}%`}}>{tickEntry.label}</span>)}
    </div>}
    {lens !== 'concurrency' && presentation === 'arrangement' && <div className="wt-deep-note" role="note">
      Deep time: the atlas non-linear scale stands (adopted, not re-ported). The Aion sections and walks are listed under Walks · sections by their own spans and years; their placement on this scale waits for the family's declared time unit.
    </div>}
    <div className="wt-tracks">
      {journey && presentation === 'session' && (journeyWalks.length > 0
        ? <div className="wt-group" data-journey-rows={journeyWalks.length}>
          <div className="wt-group-head">Journey · walks</div>
          <JourneyRows walks={journeyWalks} eventByClipId={source.eventByClipId} selectOccasion={selectOccasion} journey={journey} />
        </div>
        : <div className="wt-absence" role="note" data-journey-absence="0">No walks are carried by the World's track sets, so the Journey holds its place here; its stops appear when a walk is carried.</div>)}
      {/* Lead ruling (lock §7.3): in Technē's Session the Journey rows ARE the walk presentation, so the rails group (and its
          absence line) is not drawn twice there; every other presentation, the Arrangement included, keeps it. */}
      {!(journey && presentation === 'session') && walkAndSectionGroup}
      {groups.map((group) => <div key={group} className="wt-group">
        <div className="wt-group-head">{group}</div>
        {rows.filter((track) => track.group === group).map(trackRow)}
      </div>)}
      {!rows.length && <div className="view-empty">The reading holds no events yet — the tracks stand empty and honestly so.</div>}
    </div>
  </div>;
}
