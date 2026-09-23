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
}

