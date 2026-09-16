/**
 * The M0′ Project / Knowledge Map instrument (L5 Technē, amended geometry)
 * — the deep ground aperture over the reading. Not another application: the
 * deep editor body is the existing Knowledge surface; this pane presents
 * the ground (subject, bounded whole, sources, native Actions) under the
 * one DisclosureSession and offers the Return leg through the disclosed
 * governed-write Action. Selection, refs and session follow the shared law.
 */
import { useEffect, useMemo, useState } from "react";
import { adapterForSource, techneSource } from "../adapter";
import { disclosureSession } from "../session";
import type { SurfaceBinding } from "../../surface/types";
import type {
  DisclosureSelection,
  DisclosureSession,
  TechneActionReceipt,
  TechneDisclosure,
  TechneReading,
} from "../contract";
import { groundAvailability, groundModel, type GroundModel } from "./ground";
import "./project.css";

interface ProjectSurfaceProps {
  binding: SurfaceBinding;
  session: DisclosureSession | null;
  selection: DisclosureSelection | null;
  reading: TechneReading | null;
  capabilities: TechneDisclosure | null;
}

function refTail(ref: string): string {
  const parts = ref.split(/[/#:]/);
  return parts[parts.length - 1] || ref;
}

export function ProjectGround({ session, selection, reading }: ProjectSurfaceProps) {
  const ground = useMemo<GroundModel | null>(() => (reading ? groundModel(reading) : null), [reading]);
  const basis = reading ? `${reading.subject.subject_ref}\u0000${reading.reading_ref}` : "";
  const [picked, setPicked] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<TechneActionReceipt | null>(null);
  const [routeNote, setRouteNote] = useState<string | null>(null);

  useEffect(() => {
    setPicked(null);
    setReceipt(null);
    setRouteNote(null);
  }, [basis]);

  if (!reading || !ground || !groundAvailability(reading).available) {
    return (
      <div className="oi-techne project-ground">
        <p className="techne-absent">No Technē reading is disclosed for this surface yet.</p>
      </div>
    );
  }

  const crossOpen = reading.disclosure.instruments.filter(
    (entry) => entry.instrument !== "project" && entry.available,
  );

  const focusMember = (memberRef: string) => {
    setPicked(memberRef);
    if (!session || !selection) return;
    disclosureSession.setSelection({
      ...selection,
      selection_ref: `ql.techne:selection:${reading.subject.subject_ref}:${memberRef}`,
      focus_refs: [memberRef],
      instrument: "project",
    });
  };

  const proposeReturn = async () => {
    const action = ground.return_action;
    if (!action) return;
    setRouteNote(null);
    const source = techneSource();
    if (!source) {
      setRouteNote("No Technē source is registered to route the Return through");
      return;
    }
    try {
      const completed = await adapterForSource(source).routeAction(
        {
          action_ref: action.action_ref,
          subject_ref: reading.subject.subject_ref,
          selection_ref: session?.selection.selection_ref ?? null,
          input: { subject_ref: reading.subject.subject_ref, ground_ref: ground.ground_ref },
        },
        reading,
      );
      setReceipt(completed);
    } catch (cause: unknown) {
      setRouteNote(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <div className="oi-techne project-ground">
      <header className="project-head">
        <span className="project-eyebrow">M0′ Project — ground</span>
        <span className="project-subject" title={ground.subject_ref}>{ground.subject_ref}</span>
        <span className="project-meta">
          {ground.native_owner}
          {ground.kind ? ` · ${ground.kind}` : ""}
          {ground.standing ? ` · ${ground.standing}` : ""}
        </span>
      </header>

      <section className="project-section" aria-label="Bounded whole">
        <h3 className="project-heading">Bounded whole</h3>
        <p className="project-ground-ref" title={ground.ground_ref}>{ground.ground_ref}</p>
        {ground.member_refs.length > 0 && (
          <ul className="project-members">
            {ground.member_refs.map((member) => (
              <li key={member}>
                <button
                  type="button"
                  className={`project-member${picked === member ? " is-picked" : ""}`}
                  title={member}
                  onClick={() => focusMember(member)}
                >
                  {refTail(member)}
                </button>
              </li>
            ))}
          </ul>
        )}
        {Object.keys(ground.relations_by_origin).length > 0 && (
          <p className="project-meta">
            relations:{" "}
            {Object.entries(ground.relations_by_origin)
              .map(([origin, count]) => `${origin} ×${count}`)
              .join(" · ")}
          </p>
        )}
      </section>

      {ground.sources.length > 0 && (
        <section className="project-section" aria-label="Sources">
          <h3 className="project-heading">Sources</h3>
          <ul className="project-sources">
            {ground.sources.map((source) => (
              <li key={source.source_ref} title={source.source_ref}>
                <span className="project-source-ref">{refTail(source.source_ref)}</span>
                <span className="project-meta">
                  {source.native_owner}
                  {source.standing ? ` · ${source.standing}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="project-section" aria-label="Cross-open">
        <h3 className="project-heading">Disclose this ground through</h3>
        {crossOpen.length === 0 && <p className="project-meta">No other instrument is disclosed for this subject.</p>}
        <div className="project-open-row">
          {crossOpen.map((entry) => (
            <button
              key={entry.instrument}
              type="button"
              className="project-open"
              onClick={() => disclosureSession.openInInstrument(entry.instrument)}
            >
              {entry.instrument}
            </button>
          ))}
        </div>
      </section>

      <footer className="project-foot">
        {ground.return_action ? (
          <>
            <button type="button" className="project-return" onClick={() => void proposeReturn()}>
              Return to ground via {ground.return_action.action_ref}
            </button>
            {receipt && (
              <p className={`project-receipt${receipt.routed ? " is-routed" : " is-refused"}`}>
                {receipt.routed
                  ? `Routed to ${receipt.native_owner}${receipt.authority ? ` (${receipt.authority})` : ""} — the owner executes; the Return is visible here, composed nowhere.`
                  : `Not routed — ${receipt.reason ?? "the owner refused without a reason"}.`}
              </p>
            )}
          </>
        ) : (
          <p className="project-meta">No governed-write Action is disclosed for this ground — the Return leg has no route yet.</p>
        )}
        {routeNote && <p className="project-receipt is-refused">Routing failed — {routeNote}</p>}
      </footer>
    </div>
  );
}
