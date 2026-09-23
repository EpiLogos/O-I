/**
 * The left frame's host (10-SIDEBARS §3): the real shell routes a left row
 * reaches, lent by the frame (CradleFrame) through the DesktopShell's `left`
 * prop and handed down to every body by context — so a body (World, Factory,
 * Technè…) never needs its own prop plumbing for "open beside", "pop out",
 * "open this chat in the right panel" or "open this Inbox item".
 *
 * Every entry is optional: a route the frame does not lend is not offered
 * (the row shows no icon for it), never a dead control.
 */
import {createContext, useContext, type ReactNode} from "react";
import type {CentralLocation} from "../../kernel/types";
import type {EncounterRow} from "../../encounter/EncounterList";

export interface InboxMaterial {
  /** The owner's source ref for the document the arrival targets. */
  ref: string;
  path: string;
  /** The register the arrival lives in; undefined = Central (the root). */
  project?: string;
  document_id: string;
  return_ref: string;
}

export interface LeftHost {
  /** ⌘K — the typed palette. */
  onSearch?: () => void;
  /** The one "+" create menu. Each entry is offered only when lent. */
  onNewChat?: () => void;
  onNewFlow?: () => void;
  onNewRun?: () => void;
  onNewExpression?: () => void;
  onNewAgent?: () => void;
  /** A conversation row's plain click: Base/Expressions/Technè open it in the
   * right panel's Chat (D4); Factory in the centre Tasks view. */
  onOpenChat?: (row: EncounterRow) => Promise<void> | void;
  /** The row's "…" → Open in centre. */
  onOpenChatInCentre?: (row: EncounterRow) => Promise<void> | void;
  /** A1-A6: Open beside — into the right panel's Context canvas. */
  onOpenBeside?: (location: CentralLocation) => Promise<void> | void;
  /** A6: Pop out — its own window (native desktop only). */
  onPopOut?: (location: CentralLocation) => Promise<void> | void;
  /** Open a material row (file, flow, intent document) in the centre. */
  onOpenFile?: (location: CentralLocation) => Promise<void> | void;
  /** An Inbox item: the material opens in a pane; its review controls stay
   * beside it (the Inbox body keeps the item's controls open). */
  onOpenInboxItem?: (material: InboxMaterial) => Promise<void> | void;
  /** Create a copy of a document form IN PLACE under the scope's human
   * ground (flow/createInPlace.ts) and open it — Goal and Vision from
   * Factory's INTENT, every form from a new tab. */
  onCreateForm?: (kind: string) => Promise<void> | void;
  /** Library (the O:I Web overlay) — a Base destination. */
  onLibrary?: () => void;
  /** Report a refusal to the footer's message disclosure. */
  onMessage?: (message: string) => void;
}

const HostContext = createContext<LeftHost>({});

export function LeftHostProvider({host, children}: {host: LeftHost; children: ReactNode}) {
  return <HostContext.Provider value={host}>{children}</HostContext.Provider>;
}

export function useLeftHost(): LeftHost {
  return useContext(HostContext);
}
