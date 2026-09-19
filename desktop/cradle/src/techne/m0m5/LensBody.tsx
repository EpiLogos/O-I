/**
 * The instrument lens body wrapper (T3, 2026-09-19) — seats one ported QL
 * M′ instrument into the cradle's Technē lens mount (lensMount.ts).
 *
 * The four disclosure states, exactly (owner wayfinder 2026-09-19 §21) — a
 * lens NEVER sits on a generic waiting pane when the current disclosure
 * carries its material:
 *
 *   NO SUBJECT                          nothing selected yet
 *   LOADING READING                     the owner read genuinely in flight
 *   READING RESOLVED · LENS UNAVAILABLE the reading's own reason, verbatim
 *   READING RESOLVED · LENS AVAILABLE   the instrument mounts immediately
 *
 * Lifecycle (§22, active-only renderer): the host mounts only the active
 * lens; on unmount the wrapper releases its Studio slot (setBody(null) /
 * setTools(null)). The ported bodies are loop-free by construction (audited:
 * the only timer in all five is Journey's play dwell, a setTimeout cleared by
 * its own effect; no rAF/WebGL/listeners/observers anywhere), so teardown is
 * the Studio slot plus React's own unmount of the body.
 *
 * The ONE session: `ensureSession` aligns the DisclosureSession store with
 * this lens on mount and on reading-basis change only — never on render — so
 * a Journey 3:3 crossing (setSelection + openInInstrument to "expressions")
 * is never fought by the mounted 4:2 lens, while a lens switch re-projects
 * the session with one navigation hop, carrying subject, sources, selection
 * basis and agent-session ref byte-exact.
 */
import {useEffect, useRef, useSyncExternalStore, type ComponentType} from "react";
import type {TechneLensBodyProps, TechneLensStudio} from "../lensMount";
import {instrumentStanding} from "../techneReading";
import type {
  DisclosureSelection,
  DisclosureSession,
  TechneDisclosure,
  TechneInstrument,
  TechneReading,
} from "../contract";
import {bridgeReading, ensureSession} from "./reading";
import {disclosureSession} from "../session";
import type {TechneSurfaceProps} from "./registry";
import {disclosedRelationVocabulary} from "./canvas/proposal";
import {domainOfSpans, facetRange} from "./timeline/scale";
import {beats} from "./journey/beats";
import {palaceClaim} from "./palace/palace-state";
import "../lenses.css";

const subscribeSession = (listener: () => void) => disclosureSession.subscribe(listener);

function mPrime(instrument: TechneInstrument): number {
  switch (instrument) {
    case "project": return 0;
    case "canvas": return 1;
    case "timeline": return 2;
    case "journey": return 3;
    case "place": return 4;
    case "palace": return 5;
    case "expressions": return -1;
  }
}

/** The office label of one instrument, M′0–M′5. */
function officeLabel(instrument: TechneInstrument): string {
  const prime = mPrime(instrument);
  return prime >= 0 ? `M${prime}′` : "3:3";
}

const STATE_EYEBROW: Record<string, string> = {
  "no-subject": "No subject",
  "loading": "Loading reading",
  "unavailable": "Reading unavailable",
  "lens-unavailable": "Reading resolved · lens unavailable",
};

type LensStateKey = keyof typeof STATE_EYEBROW;

/** The four-state shell — honest states with their actual reasons, never a
 * spinner where the reading resolves, never invented material. Exported for
 * the M0′ project lens body (ProjectLens.tsx), which seats WikiExpressionBody
 * instead of a TechneSurfaceProps instrument. */
export function StatePanel(props: {state: LensStateKey; label: string; office: string; subject?: {title: string}; reason?: string; degraded?: string[]}) {
  const {state, label, office, subject, reason, degraded} = props;
  return (
    <div className="tn-m0m5-state" data-state={state} role={state === "unavailable" || state === "lens-unavailable" ? "alert" : "status"}>
      <span className="tn-m0m5-state-eyebrow">{STATE_EYEBROW[state]}</span>
      <strong className="tn-m0m5-state-lens">{label} <span className="tn-m0m5-office">{office}</span></strong>
      {state === "no-subject" && <p>Select a subject — Instrument 0's register names the whole this lens reads. Nothing is disclosed until then.</p>}
      {state === "loading" && <p>The owner read for {subject ? `“${subject.title}”` : "the selected subject"} is in flight — this lens mounts the moment it resolves.</p>}
      {state === "unavailable" && <p>{reason ?? "the reading did not resolve"}</p>}
      {state === "lens-unavailable" && <>
        <p>{reason ?? "the reading does not disclose this instrument"}</p>
        {!!degraded?.length && <ul className="tn-m0m5-degraded">{degraded.map((note) => <li key={note}>{note}</li>)}</ul>}
      </>}
    </div>
  );
}

/** The lens's Studio body — the shared session facts plus the lens's own
 * material facts from its ported support modules. The differentiated working
 * controls stay inside each body (the QL layout); the Studio slot carries the
 * lens's standing, the one session's facts, and the reading's material. */
function LensStudioPanel(props: {instrument: TechneInstrument; label: string; reading: TechneReading; session: DisclosureSession; standing: {available: boolean; reason?: string; degraded: string[]}}) {
  const {instrument, label, reading, session, standing} = props;
  const cut = session.application_cut ?? "4:2-deep";
  return (
    <div className="tn-m0m5-studio" data-instrument={instrument}>
      <span className="tn-m0m5-studio-office">{officeLabel(instrument)} · {label}</span>
      <dl className="tn-m0m5-studio-facts">
        <dt>Subject</dt><dd><code>{reading.subject.subject_ref}</code></dd>
        <dt>Reading basis</dt><dd><code>{reading.reading_ref}</code>{reading.snapshot?.revision ? <> @ <code>{reading.snapshot.revision}</code></> : null}</dd>
        <dt>Selection</dt><dd><code>{session.selection.selection_ref}</code>{session.selection.focus_refs?.length ? <> · focus {session.selection.focus_refs.length}</> : null}</dd>
        <dt>Reading</dt><dd data-cut={cut}>{cut === "3:3-conjugate" ? "3:3 conjugate" : "4:2 deep"}</dd>
        {session.selection.agent_session_ref && <><dt>Agent session</dt><dd><code>{session.selection.agent_session_ref}</code></dd></>}
      </dl>
      {!standing.available && standing.reason && <p className="tn-m0m5-studio-note" role="note">{standing.reason}</p>}
      {standing.degraded.map((note) => <p key={note} className="tn-m0m5-studio-note" role="note">degraded — {note}</p>)}
      <LensMaterial instrument={instrument} reading={reading}/>
    </div>
  );
}

/** The lens's own material facts — computed by the ported support modules
 * over the ONE reading (no re-fetch, no second store). */
function LensMaterial(props: {instrument: TechneInstrument; reading: TechneReading}) {
  const {instrument, reading} = props;
  if (instrument === "canvas") {
    const whole = reading.whole;
    const vocabulary = disclosedRelationVocabulary(reading);
    return (
      <p className="tn-m0m5-studio-note" data-lens-material="canvas">
        {whole
          ? <>whole <code>{whole.whole_ref}</code> · {whole.member_refs?.length ?? 0} members · {whole.relations?.length ?? 0} typed relations</>
          : "the reading discloses no bounded whole — the constellation has nothing to lay out yet"}
        {vocabulary.length > 0 && <> · relation vocabulary: {vocabulary.join(", ")}</>}
      </p>
    );
  }
  if (instrument === "timeline") {
    const temporal = reading.temporal ?? [];
    const domain = domainOfSpans(temporal.map((facet) => facetRange(facet)));
    return (
      <p className="tn-m0m5-studio-note" data-lens-material="timeline">
        {temporal.length === 0
          ? "the reading discloses no temporal facets — the relation field has no time to stand in yet"
          : <>{temporal.length} temporal facet{temporal.length === 1 ? "" : "s"}{domain ? ` · ${new Date(domain.fromMs).toISOString().slice(0, 10)} → ${new Date(domain.toMs).toISOString().slice(0, 10)}` : " · none positioned on a clock"}</>}
        {` · ${reading.whole?.relations?.length ?? 0} relations in the whole`}
      </p>
    );
  }
  if (instrument === "journey") {
    const model = beats(reading);
    return (
      <p className="tn-m0m5-studio-note" data-lens-material="journey">
        {model.beats.length > 0
          ? <>{model.beats.length} real scene beat{model.beats.length === 1 ? "" : "s"} — {model.beats.map((beat) => <code key={beat.scene_ref} title={beat.scene_ref}>{beat.scene_ref}</code>)}</>
          : model.unavailableReason ?? "no Expression scenes are bound to this reading"}
      </p>
    );
  }
  if (instrument === "place") {
    const places = reading.spatial ?? [];
    return (
      <p className="tn-m0m5-studio-note" data-lens-material="place">
        {places.length === 0
          ? "the reading discloses no place facets — situated depth has nothing to stand on yet"
          : <>{places.length} place{places.length === 1 ? "" : "s"} — {places.map((place) => place.place_ref).join(", ")}</>}
      </p>
    );
  }
  if (instrument === "palace") {
    const claim = palaceClaim(reading);
    return (
      <p className="tn-m0m5-studio-note" data-lens-material="palace">
        {claim.claimable
          ? <>composition claimable{claim.reason ? ` — ${claim.reason}` : " — the reading names an unclaimed composition"}</>
          : <>not claimable{claim.reason ? ` — ${claim.reason}` : ""}</>}
      </p>
    );
  }
  return null;
}

/** What the seated body needs beyond TechneSurfaceProps. */
interface SeatedProps {
  binding: TechneLensBodyProps["binding"];
  studio: TechneLensStudio;
  instrument: TechneInstrument;
  label: string;
  Instrument: ComponentType<TechneSurfaceProps>;
  reading: TechneReading;
  session: DisclosureSession;
  selection: DisclosureSelection;
  capabilities: TechneDisclosure;
  standing: {available: boolean; reason?: string; degraded: string[]};
}

/** The seated body + its Studio slot. The slot effect depends on the session
 * and reading identity: every selection refinement re-parks fresh facts;
 * unmount releases the slot (the active-only lifecycle — nothing of this
 * lens outlives its mount). */
function SeatedLens(props: SeatedProps) {
  const {binding, session, selection, reading, capabilities, studio, instrument, label, standing, Instrument} = props;
  const studioRef = useRef(studio);
  studioRef.current = studio;
  const factsRef = useRef({instrument, label, reading, session, standing});
  factsRef.current = {instrument, label, reading, session, standing};
  // The park key: re-park the Studio slot only when its CONTENT changes.
  // Object identities (session/reading/standing) are new every render — a
  // dependency on them loops with the host's setBody re-render (found live
  // in the integrated surface, 2026-09-19); the facts ref carries the fresh
  // content when the key actually changes.
  const factsKey = `${session.selection.selection_ref}|${reading.reading_ref}|${standing.available}|${instrument}`;
  useEffect(() => {
    studioRef.current.setBody(<LensStudioPanel {...factsRef.current}/>);
    studioRef.current.setTools(
      <span className="tn-m0m5-tool-chip" data-instrument={instrument} data-available={standing.available}>
        {officeLabel(instrument)}{standing.available ? "" : " · unavailable"}
      </span>,
    );
    return () => {
      studioRef.current.setBody(null);
      studioRef.current.setTools(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factsKey]);
  return <Instrument binding={binding} session={session} selection={selection} reading={reading} capabilities={capabilities}/>;
}

/** The mounted lens: session continuity then the seat. */
function ActiveMount(props: TechneLensBodyProps & {label: string; instrument: TechneInstrument; Instrument: ComponentType<TechneSurfaceProps>; standing: {available: boolean; reason?: string; degraded: string[]}}) {
  const {binding, disclosure, studio, label, instrument, Instrument, standing} = props;
  const reading = bridgeReading(disclosure);
  // Align the ONE session on mount and on reading-basis change only (never
  // on render): a Journey 3:3 crossing during this lens's life stands. The
  // alignment is an effect — a store write during render warns and can
  // cascade (found live in the integrated surface, 2026-09-19); the first
  // frame after a basis change renders the honest no-session state below.
  const aligned = useRef<string | null>(null);
  const basisKey = reading ? `${reading.subject.subject_ref}|${reading.reading_ref}` : null;
  useEffect(() => {
    if (!reading || !basisKey) return;
    if (aligned.current !== basisKey) {
      ensureSession(reading, instrument);
      aligned.current = basisKey;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basisKey, instrument]);
  const storeSession = useSyncExternalStore(subscribeSession, disclosureSession.get);
  if (!reading) return null; // unreachable: this mount renders only under standing "read"
  const live = storeSession && storeSession.subject_ref === reading.subject.subject_ref && storeSession.reading_ref === reading.reading_ref
    ? storeSession
    : disclosureSession.get();
  if (!live || live.subject_ref !== reading.subject.subject_ref) {
    // One honest frame while the store could not hold the session.
    return <StatePanel state="unavailable" label={label} office={officeLabel(instrument)} reason="the DisclosureSession could not be opened for this subject"/>;
  }
  return (
    <SeatedLens
      binding={binding}
      studio={studio}
      instrument={instrument}
      label={label}
      Instrument={Instrument}
      reading={reading}
      session={live}
      selection={live.selection}
      capabilities={reading.disclosure}
      standing={standing}
    />
  );
}

/**
 * Seat one ported QL instrument as a Technē lens body. `instrument` is the
 * ql.techne/v1 instrument id the lens presents; `Instrument` is the ported
 * surface component consuming TechneSurfaceProps; `label` is the lens's
 * human name (the chooser's label, reused in the honest states).
 */
export function techneInstrumentBody(instrument: TechneInstrument, label: string, Instrument: ComponentType<TechneSurfaceProps>): ComponentType<TechneLensBodyProps> {
  return function InstrumentLensBody(props: TechneLensBodyProps) {
    const {disclosure, subject} = props;
    const office = officeLabel(instrument);
    if (disclosure.standing === "no-subject") {
      return <StatePanel state="no-subject" label={label} office={office}/>;
    }
    if (disclosure.standing === "reading") {
      return <StatePanel state="loading" label={label} office={office} subject={subject}/>;
    }
    if (disclosure.standing === "unavailable") {
      return <StatePanel state="unavailable" label={label} office={office} reason={disclosure.reason}/>;
    }
    // Reading resolved: the lens's own disclosure entry governs.
    const standing = instrumentStanding(disclosure, instrument);
    if (!standing.available) {
      return <StatePanel state="lens-unavailable" label={label} office={office} reason={standing.reason} degraded={standing.degraded}/>;
    }
    return <ActiveMount {...props} label={label} instrument={instrument} Instrument={Instrument} standing={standing}/>;
  };
}
