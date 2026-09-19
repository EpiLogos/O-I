/**
 * Epi-Logos receiving adapters — one per family, never merged. Each family
 * (Bimba, the essay, Epii, the products) keeps its own standing, its own
 * entrances and its own reading model; nothing here builds a combined list
 * or a local graph. A family with no owner operation yet still has a
 * registered adapter — it just discloses `unavailable` with the owner's own
 * words and who supplies it, so the opening renders fully without AIKit or
 * any live service.
 *
 * The registry mirrors `../instrument/source.ts`'s shape (register/read/
 * subscribe) but tolerates more than one registrant per family instead of
 * throwing: whichever mounted consumer (the navigator, the surface, both)
 * registered most recently is read from; unregistering restores whichever
 * registration was underneath it, so two independently-mounted regions can
 * both hold the same family's adapter without racing each other.
 */
import {useEffect, useRef, useState} from "react";
import type {NavigatorReading} from "../kernel/types";
import {
  focusedInstrumentSource, focusedInstrumentSources, subscribeFocusedInstrumentRegistry,
} from "../instrument/source";

export type EpiFamily = "bimba" | "essay" | "epii" | "products";

export interface EpiStanding {
  state: "available" | "unavailable" | "partial";
  /** The owner's own words, verbatim — never paraphrased into a status code. */
  reason: string;
  /** Who supplies this family (the producer to wait on, when it isn't available). */
  owner: string;
}

export interface EpiEntrance {
  ref: string;
  title: string;
  /** One authored line — a description, not marketing copy. */
  line: string;
  family: EpiFamily;
  expressionRef?: string;
  sourceLocation?: string;
}

export interface EpiReadingPassage { id: string; text: string }
export interface EpiReadingLink { ref: string; title: string; family: EpiFamily }

export interface EpiReading {
  title: string;
  format: "html" | "markdown";
  body: string;
  passages: EpiReadingPassage[];
  links: EpiReadingLink[];
  expressionRef?: string;
  /** The exact source this reading came from, and its revision — carried
   * verbatim, never invented when a producer does not supply one. */
  sourceRef: string;
  sourceRevision: string;
}

export interface EpiSource {
  family: EpiFamily;
  label: string;
  standing(): Promise<EpiStanding>;
  entrances(): Promise<EpiEntrance[]>;
  read(ref: string): Promise<EpiReading>;
}

/* ---- registry ------------------------------------------------------- */

const registry = new Map<EpiFamily, EpiSource>();
const listeners = new Set<() => void>();
function announce() { for (const listener of listeners) listener(); }

export function registerEpiSource(source: EpiSource): () => void {
  const previous = registry.get(source.family);
  registry.set(source.family, source);
  announce();
  return () => {
    if (registry.get(source.family) !== source) return; // a later registrant is still active
    if (previous) registry.set(source.family, previous); else registry.delete(source.family);
    announce();
  };
}

export function epiSource(family: EpiFamily): EpiSource | undefined { return registry.get(family); }

export function subscribeEpiSources(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/* ---- receiving-only adapters (essay, epii) --------------------------- */

function receivingOnly(family: EpiFamily, label: string, reason: string, owner: string): EpiSource {
  return {
    family, label,
    async standing() { return {state: "unavailable", reason, owner}; },
    async entrances() { return []; },
    async read(ref: string) { throw new Error(`${label} is receiving-only here: ${reason} (ref ${ref})`); },
  };
}

export function createEssaySource(): EpiSource {
  return receivingOnly("essay", "The essay",
    "The Return-of-Zero essay corpus (EpiLogos/Antykathera-Essay-Work issue #65) is not in this repository. No owner operation discloses it here yet.",
    "EpiLogos/Antykathera-Essay-Work");
}

export function createEpiiSource(): EpiSource {
  return receivingOnly("epii", "Epii",
    "The Epii M5-1 essay and the Antichrist vault are held outside this app. No owner operation discloses them here yet.",
    "the Epii / Antichrist material's owning source (not yet wired into this app)");
}

/* ---- Bimba: read-only through a registered QL focused-instrument ----- */

export function createBimbaSource(): EpiSource {
  function firstInstrumentRef(): string | undefined { return focusedInstrumentSources()[0]?.ref; }

  async function standing(): Promise<EpiStanding> {
    const ref = firstInstrumentRef();
    if (!ref) return {
      state: "unavailable",
      reason: "No QL focused-instrument source is registered in this session; Bimba's live map has nothing to read from here.",
      owner: "a registered QL focused-instrument source (ql.focused-instrument/v1)",
    };
    const source = focusedInstrumentSource(ref);
    if (!source) return {state: "unavailable", reason: "The registered focused-instrument source could not be reached.", owner: "the QL focused-instrument source"};
    try {
      const navigation = await source.readBimba();
      if (navigation.items.length === 0) return {state: "partial", reason: navigation.standing || "The focused-instrument source discloses no Bimba items yet.", owner: source.title};
      return {state: "available", reason: navigation.standing || `${navigation.items.length} coordinate(s) disclosed.`, owner: source.title};
    } catch (cause) {
      return {state: "unavailable", reason: cause instanceof Error ? cause.message : String(cause), owner: source.title};
    }
  }

  return {
    family: "bimba", label: "Bimba",
    standing,
    async entrances() {
      const ref = firstInstrumentRef(); if (!ref) return [];
      const source = focusedInstrumentSource(ref); if (!source) return [];
      const navigation = await source.readBimba();
      return navigation.items.map(item => ({
        ref: item.selection.selection_ref,
        title: item.label,
        line: `${item.face ?? "bimba"}${item.depth !== undefined && item.depth !== null ? ` · depth ${item.depth}` : ""}`,
        family: "bimba" as const,
        sourceLocation: item.selection.source_ref,
      }));
    },
    async read(ref: string) {
      const instrumentRef = firstInstrumentRef();
      if (!instrumentRef) throw new Error("No QL focused-instrument source is registered; Bimba cannot be read.");
      const source = focusedInstrumentSource(instrumentRef);
      if (!source) throw new Error("The registered focused-instrument source could not be reached.");
      const navigation = await source.readBimba();
      const item = navigation.items.find(candidate => candidate.selection.selection_ref === ref);
      if (!item) throw new Error(`Bimba coordinate ${ref} is not among the focused instrument's disclosed items.`);
      const s = item.selection;
      const body = [
        `# ${item.label}`, "",
        `- face: ${item.face ?? "bimba"}`,
        `- depth: ${item.depth ?? "—"}`,
        `- parent: ${item.parent_ref ?? "—"}`,
        `- coordinate ref: ${s.coordinate_ref}`,
        `- subject ref: ${s.subject_ref}`,
        `- disclosure ref: ${s.disclosure_ref}`,
        `- relations: ${item.relation_refs?.length ? item.relation_refs.join(", ") : "—"}`,
        "",
        "This is the focused instrument's own navigation metadata — no prose text is disclosed for this coordinate here.",
      ].join("\n");
      return {
        title: item.label, format: "markdown" as const, body,
        passages: [{id: s.selection_ref, text: body}],
        links: [],
        sourceRef: s.source_ref, sourceRevision: s.source_revision,
      };
    },
  };
}

/* ---- products: the S field, real today via the kernel's world reading */

export interface EpiProductsProject { name: string; path: string; spaceRef?: string }
export interface EpiProductsSnapshot { state: "no-world" | "empty" | "ready"; projects: EpiProductsProject[] }

/** Central's world reading (`navigator.root.work.projects`) is the owner
 * fact; this only re-shapes it into what the products adapter needs — it
 * never re-reads or re-derives project identity on its own. */
export function productsSnapshotFromNavigator(navigator: NavigatorReading | null | undefined): EpiProductsSnapshot {
  const root = navigator?.root;
  if (!root) return {state: "no-world", projects: []};
  const projects = root.work.projects.map(project => ({
    name: project.name,
    path: project.path,
    spaceRef: project.projectcentral?.agent_wiki?.wiki?.space_ref,
  }));
  return {state: projects.length ? "ready" : "empty", projects};
}

export function createProductsSource(getSnapshot: () => EpiProductsSnapshot): EpiSource {
  return {
    family: "products", label: "The products",
    async standing() {
      const {state, projects} = getSnapshot();
      if (state === "no-world") return {state: "unavailable", reason: "Central's world reading has not been read yet.", owner: "the kernel's world reading (navigator.root)"};
      if (state === "empty" || projects.length === 0) return {state: "partial", reason: "Central's world reading lists no projects under Work/.", owner: "the kernel's world reading"};
      return {state: "available", reason: `${projects.length} project${projects.length === 1 ? "" : "s"} read from Central's world.`, owner: "the kernel's world reading"};
    },
    async entrances() {
      const {projects} = getSnapshot();
      return projects.map(project => ({
        ref: project.name,
        title: project.name,
        line: project.spaceRef ? "Opens its ProjectCentral wiki space." : "No wiki space ref is recorded for this project yet.",
        family: "products" as const,
        sourceLocation: project.path,
      }));
    },
    async read(ref: string) {
      const {projects} = getSnapshot();
      const project = projects.find(candidate => candidate.name === ref);
      if (!project) throw new Error(`Project "${ref}" is not among the projects Central's world reading lists.`);
      // The products family has no reading model of its own here — opening
      // it hands off to the app's real wiki opener, which is where a
      // project's S-field knowledge actually lives.
      if (project.spaceRef) {
        window.dispatchEvent(new CustomEvent("oi:epi-open-knowledge", {detail: {ref: project.spaceRef, title: project.name, project: project.name}}));
      }
      const body = [
        `# ${project.name}`, "",
        `- path: ${project.path}`,
        `- wiki space ref: ${project.spaceRef ?? "not recorded"}`,
        "",
        project.spaceRef
          ? "Opening this place handed off to the app's own knowledge surface for this project's wiki."
          : "No wiki space ref is recorded for this project, so opening it could not hand off to the knowledge surface.",
      ].join("\n");
      return {
        title: project.name, format: "markdown" as const, body,
        passages: [{id: project.name, text: body}],
        links: [],
        sourceRef: project.path, sourceRevision: project.spaceRef ?? "",
      };
    },
  };
}

/* ---- shared React wiring, used by both the navigator and the surface -- */

/** Registers the four family adapters for as long as the calling component
 * is mounted; `getProducts` is read fresh on every call, so the products
 * adapter always sees the latest kernel snapshot without re-registering. */
export function useEpiSourcesRegistered(getProducts: () => EpiProductsSnapshot): void {
  const getter = useRef(getProducts); getter.current = getProducts;
  useEffect(() => {
    const stops = [
      registerEpiSource(createEssaySource()),
      registerEpiSource(createEpiiSource()),
      registerEpiSource(createBimbaSource()),
      registerEpiSource(createProductsSource(() => getter.current())),
    ];
    return () => { for (const stop of stops) stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Bumps whenever any family's registration or the Bimba instrument
 * registry changes, so consumers know to re-read standing/entrances. */
export function useEpiRegistryGeneration(): number {
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const bump = () => setGeneration(value => value + 1);
    const stops = [subscribeEpiSources(bump), subscribeFocusedInstrumentRegistry(bump)];
    return () => { for (const stop of stops) stop(); };
  }, []);
  return generation;
}

export interface EpiFamilyState { standing?: EpiStanding; entrances: EpiEntrance[]; loading: boolean; error?: string }
const EPI_FAMILIES: readonly EpiFamily[] = ["bimba", "essay", "epii", "products"];

/** One standing + entrances read per family, re-run whenever `generation`
 * changes. Shared by the navigator and the surface so both read the same
 * families the same way instead of duplicating the fetch. */
export function useEpiFamilyStates(generation: number): Record<EpiFamily, EpiFamilyState> {
  const [state, setState] = useState<Record<EpiFamily, EpiFamilyState>>(() => ({
    bimba: {entrances: [], loading: true}, essay: {entrances: [], loading: true},
    epii: {entrances: [], loading: true}, products: {entrances: [], loading: true},
  }));
  useEffect(() => {
    let live = true;
    for (const family of EPI_FAMILIES) {
      const source = epiSource(family);
      if (!source) { setState(current => ({...current, [family]: {entrances: [], loading: false}})); continue; }
      setState(current => ({...current, [family]: {...current[family], loading: true, error: undefined}}));
      void Promise.all([source.standing(), source.entrances()]).then(
        ([standing, entrances]) => { if (live) setState(current => ({...current, [family]: {standing, entrances, loading: false}})); },
        cause => { if (live) setState(current => ({...current, [family]: {entrances: [], loading: false, error: cause instanceof Error ? cause.message : String(cause)}})); },
      );
    }
    return () => { live = false; };
  }, [generation]);
  return state;
}
