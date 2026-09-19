/**
 * The Library's scope model.
 *
 * "O:I Web" is not a mode or a destination — it is the connective field: the
 * wiki IS the expressions library, and the shared wiki web contains the
 * local instance nested inside it as a subset (workspace/mode.ts). There is
 * ONE Library, scoped by where you are:
 *
 *   here    the current mode's own kinds — compositions/worlds in
 *           Expressions, projected objects and pages elsewhere, places and
 *           pages in Epi-Logos.
 *   local   everything this instance's own owner reads disclose — the
 *           nested subset.
 *   shared  the shared wiki web the local instance nests inside.
 *
 * This module carries only the shape; it presents what existing owner reads
 * return (providers.ts) and invents no catalogue, index or graph of its own.
 */
import type {CentralLocation} from "../kernel/types";
import type {WorkspaceMode} from "../workspace/mode";

/** here = where you are (mode-scoped); local = this instance (the nested
 * subset); shared = the shared wiki web (the superset local nests inside). */
export type LibraryScopeId = "here" | "local" | "shared";

export type LibraryKind = "composition" | "world" | "projected-object" | "place" | "page";

export interface LibraryItem {
  kind: LibraryKind;
  ref: string;
  title: string;
  summary?: string;
  /** The owner read's own disclosed provenance for this item — never a
   * fabricated author. A provider that reads no per-item owner names the
   * instance or field the read is scoped to. */
  owner: string;
  /** Item-level, not provider-level: a "shared" provider still tags its OWN
   * instance's entries "local" when the read discloses that — this is what
   * makes the subset relation legible in LibraryResults. */
  scope: "local" | "shared";
  revision?: string;
  project?: string;
  expressionRef?: string;
  sourceLocation?: CentralLocation;
  /** The owner read's own knowledge address for this item, when it carried
   * one (the wiki provider's hits) — so the verso reads the same resource
   * back through its own kind, never a guessed one. */
  address?: {kind: "wiki" | "source" | "project-map"; value: string};
  /** Which LibraryProvider (providers.ts) supplied this item. */
  provider: string;
  /** Set only by a fixtures.dev.ts-sourced item (COMMON-BRIEF fixture rule);
   * LibraryResults renders the visible "Fixture — not native data" label. */
  fixture?: boolean;
}

export interface LibraryCoverage {
  provider: string;
  state: "complete" | "partial" | "stale" | "unavailable";
  reason?: string;
}

export interface LibraryQuery {
  scope: LibraryScopeId;
  mode: WorkspaceMode;
  text: string;
  kinds?: LibraryKind[];
}
