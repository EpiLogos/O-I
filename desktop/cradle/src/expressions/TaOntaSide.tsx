import type {ReactNode} from "react";
import "../contributions/factory/sidebar/sidebar.css";

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
  /** Open the standing canvas surface (the Expressions application, or the
   * Technè constellation) into THIS canvas — the insertion menu's Canvas
   * entry, through the frame's ordinary hosted-surface open. */
  insertCanvas?:()=>Promise<void>|void;
  /** Open the project's knowledge graph (the live GraphCanvas renderer with
   * its filters, selection and open-in-Technè handoff) into THIS canvas. */
  insertGraph?:()=>Promise<void>|void;
  /** Open a chosen conversation into THIS canvas (the insertion menu's Side
   * chat entry): the frame's openEncounter(row,"side") — placement changes,
   * the conversation's state rides through. */
  insertSideChat?:(row:import("../encounter/EncounterList").EncounterRow)=>Promise<void>|void;
}

