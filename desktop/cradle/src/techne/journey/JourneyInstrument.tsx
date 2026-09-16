/**
 * The Journey instrument surface (L5 Technē T5 — M3′) — reader/editor over the
 * beats derived from the reading's own Expression bindings (see ./beats).
 * A Journey is an ordered reading of scenes: scene refs, expression refs and
 * revisions are shown verbatim; the scene frame (time · place · subject ·
 * source) is composed from the reading's disclosed facets; source cards open
 * to their exact selector.
 *
 * Reordering and pacing are a LOCAL composition draft (./sequence) held in
 * this component's state — no shadow store, no second persistence. "Propose
 * to Expression owner" routes the draft through the Technē adapter to the
 * Expression owner's real change semantics and shows the receipt (routed →
 * owner + authority; refused → reason). A routed proposal is visible, never
 * silent, and the instrument itself writes nothing.
 *
 * Play mode is a local stepped traversal of the beats at their draft pace.
 * Cross-open projects the DisclosureSession into the expressions instrument
 * when the reading's own disclosure marks it available.
 */
import { useEffect, useMemo, useState } from "react";
import { adapterForSource, techneSource } from "../adapter";
import type { TechneActionReceipt } from "../contract";
import type { TechneSurfaceProps } from "../registry";
import { disclosureSession } from "../session";
import { beats, type JourneyBeat } from "./beats";
import {
  composeProposal,
  DEFAULT_DWELL_SECONDS,
  draftFromBeats,
  dwellFor,
  moveBeat,
  orderChanged,
  paceBeat,
  type SequenceDraft,
} from "./sequence";
import "./journey.css";

/** One Expression's beats, in binding order. */
interface BeatGroup {
  expression_ref: string;
  revision: string | null;
  order: JourneyBeat[];
}

function groupBeats(beatList: JourneyBeat[]): BeatGroup[] {
  const groups: BeatGroup[] = [];
  const index = new Map<string, BeatGroup>();
  for (const beat of beatList) {
    let group = index.get(beat.expression_ref);
    if (!group) {
      group = { expression_ref: beat.expression_ref, revision: beat.revision, order: [] };
      index.set(beat.expression_ref, group);
      groups.push(group);
    }
    group.order.push(beat);
  }
  return groups;
}

/** The displayed order of one group: the draft's order once a draft exists,
 * otherwise the reading's own binding order. */
function displayedOrder(group: BeatGroup, drafts: Record<string, SequenceDraft>): string[] {
  return drafts[group.expression_ref]?.scene_order ?? group.order.map((beat) => beat.scene_ref);
}

export function JourneyInstrument({ session, reading }: TechneSurfaceProps) {
  const [drafts, setDrafts] = useState<Record<string, SequenceDraft>>({});
  const [receipt, setReceipt] = useState<TechneActionReceipt | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);
  const [playIndex, setPlayIndex] = useState<number | null>(null);

  const model = useMemo(() => (reading ? beats(reading) : null), [reading]);
  const readingSignature = reading ? `${reading.reading_ref}:${reading.snapshot?.revision ?? ""}` : "";
  // A new reading basis ends the local draft, the receipt and play — the
  // draft belongs to the reading it was taken from, never to the surface.
  useEffect(() => {
    setDrafts({});
    setReceipt(null);
    setProposalError(null);
    setPlayIndex(null);
  }, [readingSignature]);

  const groups = useMemo(() => (model ? groupBeats(model.beats) : []), [model]);

  /** Flat play order across groups under the current drafts. */
  const playOrder = useMemo(() => groups.flatMap((group) => {
    const byScene = new Map(group.order.map((beat) => [beat.scene_ref, beat]));
    return displayedOrder(group, drafts)
      .map((sceneRef) => byScene.get(sceneRef))
      .filter((beat): beat is JourneyBeat => Boolean(beat))
      .map((beat) => ({
        scene_ref: beat.scene_ref,
        expression_ref: beat.expression_ref,
        title: beat.title,
        dwell_seconds: drafts[beat.expression_ref] ? dwellFor(drafts[beat.expression_ref], beat.scene_ref) : DEFAULT_DWELL_SECONDS,
      }));
  }), [groups, drafts]);

  // Play mode: one stepped traversal; each beat dwells at its draft pace.
  useEffect(() => {
    if (playIndex === null) return;
    if (playIndex >= playOrder.length) { setPlayIndex(null); return; }
    const timer = setTimeout(() => setPlayIndex((index) => (index === null ? null : index + 1)), playOrder[playIndex].dwell_seconds * 1000);
    return () => clearTimeout(timer);
  }, [playIndex, playOrder]);

  if (!reading || !model) {
    return <div className="techne-journey"><p className="techne-absent">No Technē reading is resolved yet — the journey waits on the source.</p></div>;
  }
  if (!model.beats.length) {
    return (
      <div className="techne-journey">
        <span className="techne-eyebrow">Journey</span>
        <p className="techne-absent" role="status">No journey is readable here — {model.unavailableReason ?? "no Expression scenes are bound to this reading"}.</p>
      </div>
    );
  }

  const moveInGroup = (group: BeatGroup, sceneRef: string, delta: -1 | 1) => {
    const order = displayedOrder(group, drafts);
    const from = order.indexOf(sceneRef);
    if (from === -1) return;
    setDrafts((current) => {
      const base = current[group.expression_ref] ?? draftFromBeats(group.order, group.expression_ref);
      return { ...current, [group.expression_ref]: moveBeat(base, sceneRef, from + delta) };
    });
    setReceipt(null);
    setProposalError(null);
  };

  const paceInGroup = (group: BeatGroup, sceneRef: string, dwellSeconds: number) => {
    setDrafts((current) => {
      const base = current[group.expression_ref] ?? draftFromBeats(group.order, group.expression_ref);
      return { ...current, [group.expression_ref]: paceBeat(base, sceneRef, dwellSeconds) };
    });
  };

  const discard = (group: BeatGroup) => {
    setDrafts((current) => {
      const next = { ...current };
      delete next[group.expression_ref];
      return next;
    });
    setReceipt(null);
    setProposalError(null);
  };

  const propose = async (group: BeatGroup) => {
    const draft = drafts[group.expression_ref];
    if (!draft) return;
    const source = techneSource();
    if (!source) {
      setProposalError("No Technē source is registered — the proposal has no owner route to travel.");
      return;
    }
    setProposing(true);
    try {
      const adapter = adapterForSource(source);
      const route = composeProposal(draft, reading, session?.selection.selection_ref ?? undefined);
      setProposalError(null);
      setReceipt(await adapter.routeAction(route, reading));
    } catch (cause: unknown) {
      setProposalError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setProposing(false);
    }
  };

  const expressionsDisclosure = reading.disclosure.instruments.find((entry) => entry.instrument === "expressions");
  const playing = playIndex !== null;
  let position = 0;

  return (
    <div className="techne-journey">
      <header className="techne-journey-head">
        <span className="techne-eyebrow">Journey · ordered Expression scenes</span>
        <code className="techne-journey-reading" title="Reading ref">{reading.reading_ref}</code>
        <span className="techne-journey-transport">
          {playing
            ? <button type="button" className="techne-journey-button" onClick={() => setPlayIndex(null)}>Stop</button>
            : <button type="button" className="techne-journey-button" onClick={() => setPlayIndex(0)} disabled={!playOrder.length}>Play</button>}
          {playing && <span className="techne-journey-stand">beat {(playIndex ?? 0) + 1} of {playOrder.length}</span>}
        </span>
      </header>

      {groups.map((group) => {
        const draft = drafts[group.expression_ref];
        const order = displayedOrder(group, drafts);
        const byScene = new Map(group.order.map((beat) => [beat.scene_ref, beat]));
        const dirty = draft ? orderChanged(draft, group.order) : false;
        return (
          <section className="techne-journey-expression" key={group.expression_ref} aria-label={`Expression ${group.expression_ref}`}>
            <header className="techne-journey-expression-head">
              <code title="expression_ref">{group.expression_ref}</code>
              <span className="techne-journey-rev">rev {group.revision ?? "—"}</span>
            </header>
            <ol className="techne-journey-beats">
              {order.map((sceneRef, index) => {
                const beat = byScene.get(sceneRef);
                if (!beat) return null;
                position += 1;
                const current = playing && playOrder[playIndex ?? 0]?.scene_ref === sceneRef;
                const dwell = draft ? dwellFor(draft, sceneRef) : DEFAULT_DWELL_SECONDS;
                return (
                  <li className="techne-journey-beat" key={sceneRef} data-current={current || undefined}>
                    <div className="techne-journey-beat-head">
                      <span className="techne-journey-index">{position}</span>
                      <strong className="techne-journey-title">{beat.title}</strong>
                      <span className="techne-journey-move">
                        <button type="button" aria-label={`Move ${beat.title} earlier`} disabled={index === 0 || playing} onClick={() => moveInGroup(group, sceneRef, -1)}>↑</button>
                        <button type="button" aria-label={`Move ${beat.title} later`} disabled={index === order.length - 1 || playing} onClick={() => moveInGroup(group, sceneRef, 1)}>↓</button>
                      </span>
                    </div>
                    <div className="techne-journey-ids">
                      <code title="scene_ref">{beat.scene_ref}</code>
                      <span className="techne-journey-rev">rev {beat.revision ?? "—"}</span>
                    </div>
                    <ul className="techne-journey-chips" aria-label="Scene frame">
                      {beat.frame.temporal.map((facet) => (
                        <li className="techne-journey-chip" key={`${facet.kind}:${facet.instant ?? facet.day_ref ?? facet.facet_ref ?? ""}`} title={`temporal · ${facet.kind}`}>
                          <span>time · {facet.kind}</span> <code>{facet.day_ref ?? facet.instant ?? "—"}</code>
                        </li>
                      ))}
                      {beat.frame.places.map((place) => (
                        <li className="techne-journey-chip" key={place.place_ref} title={`place · ${place.precision}`}>
                          <span>place · {place.precision}</span> {place.names.length ? place.names.join(" · ") : <code>{place.place_ref}</code>}
                        </li>
                      ))}
                      <li className="techne-journey-chip" title="subject">
                        <span>subject</span> <code>{beat.frame.subject_ref}</code>
                      </li>
                    </ul>
                    <details className="techne-journey-sources">
                      <summary>sources · {beat.frame.sources.length}</summary>
                      <ul>
                        {beat.frame.sources.map((source) => (
                          <li className="techne-journey-source" key={source.source_ref}>
                            <code title="source_ref">{source.source_ref}</code>
                            {source.source_revision && <span className="techne-journey-rev">{source.source_revision}</span>}
                            {source.selector
                              ? <span className="techne-journey-selector">selector · {source.selector.unit}{source.selector.unit === "text_span" ? ` [${source.selector.start}, ${source.selector.end}]` : ""}</span>
                              : <span className="techne-journey-selector">selector · none disclosed</span>}
                          </li>
                        ))}
                      </ul>
                    </details>
                    <div className="techne-journey-pace" title="Local reading pace — held in this surface, never routed">
                      <span>pace</span>
                      <button type="button" aria-label={`Slower ${beat.title}`} disabled={dwell <= 1 || playing} onClick={() => paceInGroup(group, sceneRef, dwell - 1)}>−</button>
                      <output>{dwell}s</output>
                      <button type="button" aria-label={`Faster ${beat.title}`} disabled={dwell >= 30 || playing} onClick={() => paceInGroup(group, sceneRef, dwell + 1)}>+</button>
                    </div>
                  </li>
                );
              })}
            </ol>
            <footer className="techne-journey-expression-foot">
              {dirty
                ? <>
                    <span className="techne-journey-note">Local draft — order {order.length} scenes; nothing is written until routed.</span>
                    <button type="button" className="techne-journey-button" onClick={() => discard(group)} disabled={proposing || playing}>Discard draft</button>
                    <button type="button" className="techne-journey-button techne-journey-propose" onClick={() => propose(group)} disabled={proposing || playing}>
                      {proposing ? "Routing…" : "Propose to Expression owner"}
                    </button>
                  </>
                : <span className="techne-journey-note">Reading order — reorder a scene to draft a composition proposal.</span>}
            </footer>
          </section>
        );
      })}

      {(receipt || proposalError) && (
        <div className="techne-journey-receipt" data-routed={receipt?.routed === true} role="status">
          <strong>{receipt ? (receipt.routed ? "Proposal routed to the Expression owner" : "Proposal refused by routing") : "Proposal could not be routed"}</strong>
          {receipt && (
            <p><code>{receipt.action_ref}</code> · owner <code>{receipt.native_owner}</code>
              {receipt.routed && receipt.authority ? <> · authority <code>{receipt.authority}</code></> : null}
            </p>
          )}
          {receipt && !receipt.routed && receipt.reason && <p>{receipt.reason}</p>}
          {proposalError && <p>{proposalError}</p>}
          {!!receipt?.expected_effects?.length && (
            <ul>{receipt.expected_effects.map((effect) => <li key={effect}>{effect}</li>)}</ul>
          )}
          <p className="techne-journey-note">Routing proposes only — the Expression owner executes under its own authority; the journey instrument wrote nothing.</p>
        </div>
      )}

      <footer className="techne-journey-cross">
        {expressionsDisclosure?.available
          ? (
            <button
              type="button"
              className="techne-journey-button"
              disabled={!session}
              title="Project the DisclosureSession into the expressions instrument; an expression_focus_ref already on the session rides across"
              onClick={() => disclosureSession.openInInstrument("expressions")}
            >
              Open the bound Expression in expressions
            </button>
          )
          : expressionsDisclosure
            ? <span className="techne-absent">expressions unavailable — {expressionsDisclosure.reason}</span>
            : null}
      </footer>
    </div>
  );
}
