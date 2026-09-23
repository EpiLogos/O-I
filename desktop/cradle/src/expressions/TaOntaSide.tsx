import { type ReactNode} from "react";
import {ActiveContext} from "./ActiveContext";
import {Glyph} from "../workspace/Glyph";
import {handToPanelInspect} from "../agent/planes/panelInspect";
import type {PanelSubject} from "./panelSubject";
import "../contributions/factory/sidebar/sidebar.css";

const ORIENTATION_DOC = "docs/experience/INHABITED-SYSTEM-ORIENTATION.md";

/** The shared inhabitable execution, in its authored order (AnimaPlanes). */
const TA_ONTA_OFFICES = ["Khora", "Hen", "Pleroma", "Chronos", "Anima", "Aletheia"] as const;
const NO_OPERATION = "no owner operation discloses this yet";

/** The world's named systems — the same honest roster the Factory Agents
 * plane carries as its Guardians: names and relations, no invented state. */
const RELATED_SYSTEMS = ["Central", "Actuation", "AIKit", "Software Factory", "Workcell", "Quaternal Logic"] as const;

/** What the composition root lends the Context plane: the panel's OWN pane —
 * a real TabGroupPane from the existing pane logic (tab strip, +, surfaces,
 * pop-out), composed and owned by the frame. No interpretation lives here. */
export interface TaPaneOpens {
  sideHost?:ReactNode;
  /** The side pane's live tabs — the actually active context (terminal
   * processes, files, browser panes), selectable — plus the mode tree's
   * hidden tabs (owner ruling 2026-09-19): they surface here marked as
   * workspace-held while the mode's dedicated stage stands. */
  sideTabs?:{id:string;title:string;kind:string;active:boolean;canvas?:"panel"|"workspace"}[];
  activateTab?:(id:string)=>void;
  /** Open a file into THIS canvas (the frame's openFile with into:"side") —
   *  the Context launcher's File entry (10-SIDEBARS §4.6). */
  insertFile?:(location:import("../kernel/types").CentralLocation)=>Promise<void>;
}

/** The panel's Ta-Onta AGENTS plane: the offices as the roster, the mode's
 * companion, and the project guardians. */
export function TaOntaAgentsPlane({subject,agent}:{subject:PanelSubject;agent?:string}) {
  return <div className="desk-plane oi-side-plane" data-plane="ta-onta-agents">
    <section className="oi-side-section" aria-label="Ta-Onta roster">
      <h4><Glyph name="agent" size={12}/> Ta-Onta · the offices, in execution order</h4>
      <ul className="oi-side-rows">
        {TA_ONTA_OFFICES.map((office, index) => <li key={office}>
          <button className="oi-side-row" onClick={() => handToPanelInspect({
            kind: "ta-onta-office", ref: `ta-onta/office/${office.toLowerCase()}`,
            title: `Ta-Onta · ${office}`,
            payload: {office, order: index + 1, of: TA_ONTA_OFFICES.length, standing: NO_OPERATION, authored: ORIENTATION_DOC},
            source: "Agents",
          })}>
            <span className="oi-side-row-title">{office}</span>
            <span className="oi-side-step-meta">{index + 1} of {TA_ONTA_OFFICES.length}</span>
          </button>
        </li>)}
      </ul>
      <p className="oi-note">The roster is the authored order, not a live one: no roster read reaches the desktop seam yet. Each office's meaning is authored in <span className="oi-ref">{ORIENTATION_DOC}</span>; a row opens in Inspect.</p>
    </section>
    <section className="oi-side-section" aria-label="This panel's companion">
      <h4>Companion</h4>
      <p className="oi-side-purpose">{agent&&<strong>{agent} · </strong>}{subject.title}{subject.ref ? <> · <span className="oi-ref">{subject.ref}</span></> : null} — the conversation on the other side of this panel.</p>
    </section>
    <section className="oi-side-section" aria-label="Guardians">
      <h4><Glyph name="graph" size={12}/> Guardians · the world's systems</h4>
      <ul className="oi-side-guardians">{RELATED_SYSTEMS.map(name=><li key={name}><Glyph name="factory" size={11}/>{name}</li>)}</ul>
      <p className="oi-note">A relations read is not exposed at the desktop seam yet, so none is invented.</p>
    </section>
  </div>;
}

/** The panel's Ta-Onta CONTEXT plane: the panel's own pane — the existing
 * pane component, embedded. Tab strip, +, any surface, pop-out: the existing
 * logic, never tiled. */
export function TaOntaContextPlane({opens}:{subject:PanelSubject;opens?:TaPaneOpens}) {
  return <div className="desk-plane oi-side-plane ta-context-plane" data-plane="ta-onta-context">
    {opens?.sideHost??<p className="oi-empty">The pane host is not wired for this mode yet.</p>}
    <ActiveContext tabs={opens?.sideTabs} onActivate={opens?.activateTab}/>
  </div>;
}
