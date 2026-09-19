/**
 * The Epi-Logos mode's centre surface: a deliberately authored threshold
 * into four distinct receiving families, never a settings page and never a
 * raw graph. Composition:
 *
 *   no place open      the threshold — four doorways, each its own live
 *                       standing (available / partial / not connected)
 *   a family entered    that family's entrances (or its unavailable reason)
 *   a place open         the reading view: canonical body, then — kept
 *                       structurally separate — visitor annotations and a
 *                       receiving-only Nara panel
 *
 * The open place (`useEpiPlace`) is shared with `EpiPlacesNavigator` through
 * `places.ts`'s external store, so opening a place from either region shows
 * the same reading here.
 */
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {scrollWithin} from "../shared/scrollWithin";
import {useKernel} from "../kernel/KernelProvider";
import {renderMarkdown} from "../material/markdown";
import {Glyph} from "../workspace/Glyph";
import type {SurfaceBinding} from "../surface/types";
import {
  epiSource, productsSnapshotFromNavigator, useEpiFamilyStates, useEpiRegistryGeneration, useEpiSourcesRegistered,
  type EpiEntrance, type EpiFamily, type EpiFamilyState, type EpiReading, type EpiStanding,
} from "./sources";
import {epiReading, selectEpiPlace, setEpiReading, useEpiPlace, type EpiPlaceRef} from "./places";
import {getEpiAnnotation, removeEpiAnnotation, setEpiAnnotation} from "./annotations";
import "./epilogos.css";

const DOORWAYS: {family: EpiFamily; title: string; line: string}[] = [
  {family: "essay", title: "The essay", line: "Return of Zero — a corpus held outside this app."},
  {family: "bimba", title: "Bimba", line: "The philosophical map, read live wherever a source discloses it."},
  {family: "epii", title: "Epii · the Antichrist material", line: "The M5-1 essay and its vault, held outside this app."},
  {family: "products", title: "The products", line: "The S field — Central's own projects and their wikis."},
];

const STANDING_LABEL: Record<string, string> = {available: "available", partial: "partial", unavailable: "not connected"};
const NOOP_ASSET = () => "data:,"; // this world's readings are generated markdown with no relative assets to resolve

const text = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);

export function EpiLogosSurface({binding}: {binding: SurfaceBinding}) {
  void binding; // the surface follows the shared open place (`useEpiPlace`), not a per-binding address
  const kernel = useKernel();
  const getProducts = useCallback(() => productsSnapshotFromNavigator(kernel.snapshot.navigator), [kernel.snapshot.navigator]);
  useEpiSourcesRegistered(getProducts);

  const generation = useEpiRegistryGeneration();
  const families = useEpiFamilyStates(generation);

  const [familyView, setFamilyView] = useState<EpiFamily | null>(null);
  const place = useEpiPlace();

  const [reading, setReading] = useState<EpiReading>();
  const [readError, setReadError] = useState<string>();
  const [readingFor, setReadingFor] = useState<EpiPlaceRef>();

  useEffect(() => {
    if (!place) { setReading(undefined); setReadError(undefined); setReadingFor(undefined); return; }
    let live = true;
    setReading(undefined); setReadError(undefined);
    const source = epiSource(place.family);
    if (!source) { setReadError(`No ${place.family} source is registered; this place cannot be read.`); setReadingFor(place); return; }
    void source.read(place.ref).then(
      value => { if (live) { setReading(value); setReadingFor(place); } },
      cause => { if (live) { setReadError(text(cause)); setReadingFor(place); } },
    );
    return () => { live = false; };
  }, [place]);

  // "Return to where you were": another part of the app tells us where a
  // visitor left this world; we hold that as a visible offer rather than
  // navigating unasked, and act only when the offer is taken.
  const [returnTarget, setReturnTarget] = useState<{place: EpiPlaceRef; passageId: string}>();
  useEffect(() => {
    const onReturn = (event: Event) => {
      const detail = (event as CustomEvent).detail as {place?: EpiPlaceRef; passageId?: string} | undefined;
      if (detail?.place && detail.passageId) setReturnTarget({place: detail.place, passageId: detail.passageId});
    };
    window.addEventListener("oi:epi-return", onReturn);
    return () => window.removeEventListener("oi:epi-return", onReturn);
  }, []);

  const pendingRestore = useRef<string>();
  const takeReturn = () => {
    if (!returnTarget) return;
    pendingRestore.current = returnTarget.passageId;
    setFamilyView(null);
    selectEpiPlace(returnTarget.place);
    setReturnTarget(undefined);
  };

  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!reading || !readingFor) return;
    const wanted = pendingRestore.current ?? epiReading(readingFor);
    pendingRestore.current = undefined;
    if (!wanted) return;
    const el = content.current?.querySelector(`[data-passage-id="${CSS.escape(wanted)}"]`);
    scrollWithin(el, "start");
  }, [reading, readingFor]);

  useEffect(() => {
    const el = content.current;
    if (!el || !readingFor) return;
    const target = readingFor;
    let timer: number | undefined;
    const onScroll = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-passage-id]"));
        const top = el.getBoundingClientRect().top;
        let nearest: string | undefined;
        for (const node of nodes) { if (node.getBoundingClientRect().top - top <= 24) nearest = node.dataset.passageId; else break; }
        if (nearest) setEpiReading(target, nearest);
      }, 150);
    };
    el.addEventListener("scroll", onScroll);
    return () => { el.removeEventListener("scroll", onScroll); if (timer !== undefined) window.clearTimeout(timer); };
  }, [readingFor]);

  const openEntrance = (family: EpiFamily, entrance: EpiEntrance) => selectEpiPlace({family, ref: entrance.ref, title: entrance.title});
  const goThreshold = () => { setFamilyView(null); selectEpiPlace(null); };
  const dispatchFromPassage = (name: string, detail: Record<string, unknown>, passageId: string) => {
    if (!place) return;
    window.dispatchEvent(new CustomEvent(name, {detail: {...detail, returnTo: {place, passageId}}}));
  };

  return (
    <section className="epi-surface oi-scroll" aria-label="Epi-Logos">
      {!place && !familyView && <Threshold families={families} onEnter={setFamilyView}/>}
      {!place && familyView && (
        <FamilyEntrances family={familyView} title={DOORWAYS.find(d => d.family === familyView)!.title} state={families[familyView]}
          onBack={goThreshold} onOpen={entrance => openEntrance(familyView, entrance)}/>
      )}
      {place && (
        <article className="epi-reading" ref={content} tabIndex={-1} aria-label={place.title}>
          <div className="epi-reading-head">
            <button type="button" className="oi-tool" aria-label="Return to the threshold" title="Return to the threshold" onClick={goThreshold}><Glyph name="back" size={13}/></button>
            <span className="oi-eyebrow">{DOORWAYS.find(d => d.family === place.family)?.title}</span>
            <h1 className="epi-reading-title">{place.title}</h1>
            {returnTarget && <button type="button" className="oi-action" onClick={takeReturn}>Return to where you were</button>}
          </div>
          {readError && <p className="oi-refusal" role="alert">{readError}</p>}
          {!readError && !reading && <p className="oi-note" role="status">Reading…</p>}
          {reading && (
            <>
              <p className="oi-ref epi-reading-source">source: {reading.sourceRef}{reading.sourceRevision ? ` @ ${reading.sourceRevision}` : ""}</p>
              {reading.passages.map(passage => (
                <Passage key={passage.id} place={place} passage={passage} reading={reading} onDispatch={dispatchFromPassage}/>
              ))}
              <section className="epi-holdings epi-holdings-nara">
                <h3>Nara's personal material</h3>
                <p className="oi-note">Nara's personal material is held separately and is not connected here yet.</p>
              </section>
            </>
          )}
        </article>
      )}
    </section>
  );
}

function Threshold({families, onEnter}: {families: Record<EpiFamily, EpiFamilyState>; onEnter: (family: EpiFamily) => void}) {
  return (
    <div className="epi-threshold">
      <p className="epi-threshold-eyebrow oi-eyebrow">Epi-Logos</p>
      <h1 className="epi-threshold-title">Epi-Logos</h1>
      <p className="epi-threshold-line">A world, entered one place at a time.</p>
      <div className="epi-doorways">
        {DOORWAYS.map((doorway, i) => (
          <Doorway key={doorway.family} index={i} doorway={doorway} state={families[doorway.family]} onEnter={() => onEnter(doorway.family)}/>
        ))}
      </div>
    </div>
  );
}

function Doorway({index, doorway, state, onEnter}: {
  index: number; doorway: {family: EpiFamily; title: string; line: string}; state: EpiFamilyState; onEnter: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const standing: EpiStanding | undefined = state.standing;
  const label = state.loading ? "reading" : standing ? STANDING_LABEL[standing.state] : "—";
  return (
    <div className={`epi-doorway epi-doorway-${index % 4}`} data-standing={standing?.state ?? (state.loading ? "loading" : "unknown")}>
      <button type="button" className="epi-doorway-open" onClick={onEnter}>
        <span className="epi-doorway-title">{doorway.title}</span>
        <span className="epi-doorway-line">{doorway.line}</span>
      </button>
      <div className="epi-doorway-foot">
        <span className="oi-state" title={standing?.reason}>{label}</span>
        {standing && standing.state !== "available" && (
          <button type="button" className="oi-tool epi-doorway-why" aria-expanded={expanded} aria-label={`Why ${doorway.title} is ${label}`} onClick={() => setExpanded(value => !value)}>
            <Glyph name="chevron-down" size={11}/>
          </button>
        )}
      </div>
      {expanded && standing && <p className="oi-note epi-doorway-reason">{standing.reason} — supplied by {standing.owner}.</p>}
    </div>
  );
}

function FamilyEntrances({family, title, state, onBack, onOpen}: {
  family: EpiFamily; title: string; state: EpiFamilyState; onBack: () => void; onOpen: (entrance: EpiEntrance) => void;
}) {
  void family;
  return (
    <div className="epi-family-entrances">
      <div className="epi-reading-head">
        <button type="button" className="oi-tool" aria-label="Return to the threshold" title="Return to the threshold" onClick={onBack}><Glyph name="back" size={13}/></button>
        <h1 className="epi-reading-title">{title}</h1>
      </div>
      {state.loading && <p className="oi-note" role="status">Reading…</p>}
      {!state.loading && state.error && <p className="oi-refusal" role="alert">{state.error}</p>}
      {!state.loading && !state.error && state.entrances.length === 0 && state.standing && (
        <p className="oi-empty" role="status">{state.standing.reason} — supplied by {state.standing.owner}.</p>
      )}
      {!state.loading && state.entrances.length > 0 && (
        <ul className="epi-nav-list">
          {state.entrances.map(entrance => (
            <li key={entrance.ref}>
              <button type="button" className="oi-row epi-nav-row" onClick={() => onOpen(entrance)}>
                <span className="oi-row-title">{entrance.title}</span>
                <span className="epi-nav-line">{entrance.line}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Passage({place, passage, reading, onDispatch}: {
  place: EpiPlaceRef; passage: {id: string; text: string}; reading: EpiReading;
  onDispatch: (name: string, detail: Record<string, unknown>, passageId: string) => void;
}) {
  // renderMarkdown escapes everything it does not itself recognise as
  // markup, so its output is the sanitized case; format "html" is trusted
  // owner-produced markup by the EpiReading contract (no source in this app
  // emits it today).
  const html = useMemo(() => reading.format === "markdown" ? renderMarkdown(passage.text, {resolveAsset: NOOP_ASSET}) : passage.text, [reading.format, passage.text]);
  const [annotation, setAnnotationText] = useState(() => getEpiAnnotation(place.family, place.ref, passage.id)?.text ?? "");
  const [editing, setEditing] = useState(false);
  const save = () => { setEpiAnnotation(place.family, place.ref, passage.id, annotation); setEditing(false); };
  const clear = () => { removeEpiAnnotation(place.family, place.ref, passage.id); setAnnotationText(""); setEditing(false); };
  return (
    <section className="epi-passage" data-passage-id={passage.id}>
      <div className="epi-passage-body" dangerouslySetInnerHTML={{__html: html}}/>
      <div className="epi-passage-actions oi-action-group">
        {reading.expressionRef && <button type="button" className="oi-action" onClick={() => onDispatch("oi:epi-open-expression", {expressionRef: reading.expressionRef}, passage.id)}>Open its Expression</button>}
        <button type="button" className="oi-action" onClick={() => onDispatch("oi:epi-examine", {place, passageId: passage.id}, passage.id)}>Examine in Technè</button>
        <button type="button" className="oi-action" onClick={() => onDispatch("oi:epi-open-source", {ref: reading.sourceRef, location: reading.sourceRef, revision: reading.sourceRevision}, passage.id)}>Open exact source</button>
      </div>
      {/* Three holdings, kept structurally separate: the canonical body
         above (never editable), the visitor's own annotation here, and
         Nara's personal material in its own section below the reading. */}
      <div className="epi-annotation">
        <p className="oi-eyebrow">Your annotation — kept on this device, not part of the corpus</p>
        {editing
          ? <div className="epi-annotation-edit">
              <textarea className="oi-input epi-annotation-input" value={annotation} onChange={event => setAnnotationText(event.target.value)} rows={3} aria-label="Your annotation"/>
              <div className="oi-action-group">
                <button type="button" className="oi-action oi-action-primary" onClick={save}>Save</button>
                <button type="button" className="oi-action" onClick={() => setEditing(false)}>Cancel</button>
                {annotation && <button type="button" className="oi-action" onClick={clear}>Remove</button>}
              </div>
            </div>
          : <button type="button" className="oi-action" onClick={() => setEditing(true)}>{annotation ? "Edit annotation" : "Add annotation"}</button>}
        {!editing && annotation && <p className="epi-annotation-text">{annotation}</p>}
      </div>
    </section>
  );
}
