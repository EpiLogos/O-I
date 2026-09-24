/**
 * The ONE Wiki→Expression projection state (QL-MEF #213: one relation/
 * selection state — "same objects, same relations, same refs, different
 * aperture/disclosure"; O-I #366 EX3A: the bidirectional law).
 *
 * Instrument 0's centre (the graph/stage aperture), the Technè left body
 * (its LIST/TREE/GRAPH apertures) and the Expressions graph navigator all
 * read from and drive THIS state. There is no second reading of wiki.json,
 * no parallel navigator law, no copied graph store: the navigator renders
 * the very projection the centre presents, a sidebar click and a stage
 * click are the same act on the same canonical ref, and the centre's
 * selection is every aperture's selection.
 *
 * Division of labour:
 *   - the store holds the registers, each register's standing (reading →
 *     projection → standing kernel document, with the named failure
 *     states) and the selection mirror derived from the kernel document's
 *     own selection — the kernel document remains the authoritative
 *     selection, the mirror is what apertures read;
 *   - the hosted centre (wikiNativeExpression) is the kernel actor: it ensures
 *     the projection, opens/focuses the real document through the kernel's
 *     expression op, and writes every result back here;
 *   - apertures ask for selection through `requestWikiSelection`; the
 *     centre consumes the request and performs the kernel focus edit.
 */
import {useSyncExternalStore} from "react";
import type {KernelTransportStatus} from "../kernel/types";
import type {ExpressionDocument} from "../expression/types";
import {
  projectWikiExpression,
  readWikiRegister,
  wikiPathOf,
  type WikiProjection,
  type WikiRegister,
  type WikiRegisterReading,
} from "./wikiExpression";

type ReadyReading = Extract<WikiRegisterReading, {state: "ready"}>;

/** A register's standing in the one state. "projected" = the reading is
 * projected but its generation is not (yet) open in the kernel; "opening" =
 * the centre's inspect/open is in flight; "ready"/"drift" carry the
 * standing kernel document. */
export type RegisterStanding = (
  | {phase: "idle"}
  | {phase: "reading"}
  | {phase: "absent"}
  | {phase: "unavailable"; reason: string; reading?: WikiRegisterReading; projection?: WikiProjection}
  | {phase: "projected"; reading: ReadyReading; projection: WikiProjection}
  | {phase: "opening"; reading: ReadyReading; projection: WikiProjection}
  | {phase: "ready"; reading?: ReadyReading; projection: WikiProjection; document: ExpressionDocument}
  | {phase: "drift"; reading?: ReadyReading; projection: WikiProjection; document: ExpressionDocument; reason: string}
) & {readingInvalidated?: boolean};

export interface WikiProjectionSelection {
  registerKey: string | null;
  expressionRef: string | null;
  sceneRef: string | null;
  entityRef: string | null;
  relationRef?: string | null;
  subjectRef: string | null;
}

export interface WikiSelectionRequest {
  seq: number;
  registerKey: string;
  sceneRef: string;
  entityRef: string | null;
  relationRef?: string | null;
  subjectRef: string | null;
  title?: string;
  origin: "wiki-map" | "graph-navigator" | "external";
}

interface WikiProjectionState {
  registers: WikiRegister[];
  registerKey: string | null;
  standings: Record<string, RegisterStanding>;
  selection: WikiProjectionSelection;
  request: WikiSelectionRequest | null;
  revision: number;
  /** Presentation only, keyed by the stable surface binding; never source content. */
  entries: Record<string, "home" | "field">;
}

const REGISTER_KEY_STORAGE = "oi-cradle.techne.m0-register.v1";
const ENTRY_STORAGE = "oi-cradle.techne.m0-entry.v1";
function retainedEntries(): Record<string, "home" | "field"> {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(ENTRY_STORAGE) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry === "home" || entry === "field"));
  } catch { return {}; }
}
function retainedRegister(): string | null {
  try { return window.localStorage.getItem(REGISTER_KEY_STORAGE); } catch { return null; }
}
const text = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);

let state: WikiProjectionState = {
  registers: [],
  registerKey: retainedRegister(),
  entries: retainedEntries(),
  standings: {},
  selection: {registerKey: null, expressionRef: null, sceneRef: null, entityRef: null, subjectRef: null},
  request: null,
  revision: 0,
};
const listeners = new Set<() => void>();
const emit = () => { for (const listener of [...listeners]) listener(); };
const mutate = (patch: (current: WikiProjectionState) => Partial<WikiProjectionState>) => {
  state = {...state, ...patch(state), revision: state.revision + 1};
  emit();
};

const setStanding = (registerKey: string, standing: RegisterStanding) => mutate(current => ({
  standings: {...current.standings, [registerKey]: standing},
}));

/** The selection mirror: what the register's standing kernel document
 * actually selects (the authoritative state), with the subject ref the
 * selected entity binds. */
function selectionOf(registerKey: string, standing: RegisterStanding): WikiProjectionSelection {
  const document = standing.phase === "ready" || standing.phase === "drift" ? standing.document : undefined;
  if (!document) return {registerKey, expressionRef: null, sceneRef: null, entityRef: null, subjectRef: null};
  const entityRef = document.selection.entity_ref;
  const entity = entityRef ? document.entities[entityRef] : undefined;
  return {
    registerKey,
    expressionRef: document.expression_ref,
    sceneRef: document.selection.scene_ref,
    entityRef: entityRef ?? null,
    relationRef: document.selection.relation_ref ?? null,
    subjectRef: document.selection.relation_ref ? document.relations[document.selection.relation_ref]?.relation.ref ?? null : entity?.subject?.subject_ref ?? null,
  };
}

/** Explicit Home is not the same operation as restoring a working position.
 * This belongs to the existing projection working model and stores only the
 * viewer's entry choice, not another Expression or source cache. */
export function setWikiEntry(surfaceId: string, entry: "home" | "field") {
  if (!surfaceId.trim()) throw new Error("A Technē entry needs its surface binding");
  if (state.entries[surfaceId] === entry) return;
  mutate(current => ({entries: {...current.entries, [surfaceId]: entry}}));
  try { window.localStorage.setItem(ENTRY_STORAGE, JSON.stringify(state.entries)); } catch { /* ref-only UI convenience */ }
}

// ---- registers -------------------------------------------------------------

/** The register list follows the kernel navigator's disclosed projects.
 * The centre publishes it; every aperture reads it. */
export function setWikiProjectionRegisters(registers: WikiRegister[]) {
  mutate(current => {
    const same = current.registers.length === registers.length
      && current.registers.every((entry, index) => entry.key === registers[index].key
        && entry.title === registers[index].title
        && entry.project === registers[index].project
        && entry.projectPath === registers[index].projectPath);
    if (same) return {};
    let registerKey = current.registerKey;
    // A SET key that no longer resolves falls back to Central (or the first
    // register). A never-set key stays null: the centre seeds it once from
    // the workspace's own binding (remembered → binding project → Central).
    if (registerKey && !registers.some(entry => entry.key === registerKey)) {
      registerKey = registers.some(entry => entry.key === "central") ? "central" : registers[0]?.key ?? null;
    }
    return {registers, registerKey};
  });
}

/** Which register's local whole the instrument projects (the centre's
 * select and the navigator's project affordance are the same act). */
export function setWikiProjectionRegister(registerKey: string) {
  if (state.registerKey === registerKey) return;
  try { window.localStorage.setItem(REGISTER_KEY_STORAGE, registerKey); } catch { /* per-viewer convenience only */ }
  mutate(() => ({registerKey}));
}

// ---- reading + projection (idempotent per register) ------------------------

/** Ensure the register's bounded local whole is read and projected. The
 * read happens once per register (guarded in-flight and cached); the
 * centre and the navigator's opened regions both call this — the second
 * caller finds the standing already there. */
export function ensureWikiProjection(register: WikiRegister, transport: KernelTransportStatus) {
  const existing = state.standings[register.key];
  if (existing && existing.phase !== "idle") return;
  const generation = (rereadGenerations.get(register.key) ?? 0) + 1;
  rereadGenerations.set(register.key, generation);
  setStanding(register.key, {phase: "reading"});
  void (async () => {
    try {
      const reading = await readWikiRegister(transport, register);
      if (rereadGenerations.get(register.key) !== generation) return;
      if (reading.state === "absent") { setStanding(register.key, {phase: "absent"}); return; }
      if (reading.state === "unavailable") { setStanding(register.key, {phase: "unavailable", reason: reading.reason}); return; }
      setStanding(register.key, {phase: "projected", reading, projection: projectWikiExpression(reading)});
    } catch (cause) {
      if (rereadGenerations.get(register.key) !== generation) return;
      setStanding(register.key, {phase: "unavailable", reason: text(cause)});
    }
  })();
}

/** Keep the very reading that produced the projection; no second cache or
 * register fallback. An invalidated reading may remain visible as a draft's
 * basis, but cannot supply new instrument facets as a current reading. */
function retainedReadingOf(standing: RegisterStanding | undefined): ReadyReading | undefined {
  return standing && "reading" in standing && standing.reading?.state === "ready" ? standing.reading : undefined;
}
export function wikiReadingOf(standing: RegisterStanding | undefined): ReadyReading | undefined {
  return standing?.readingInvalidated ? undefined : retainedReadingOf(standing);
}

/** Resolve only the requested register's existing projection owner. Normal
 * instrument switches return synchronously cached material; restored native
 * documents can initialize their proven register once. */
export function ensureWikiProjectionReading(register: WikiRegister, transport: KernelTransportStatus): Promise<ReadyReading> {
  return new Promise((resolve, reject) => {
    let done = false;
    let unsubscribe = () => {};
    const check = () => {
      const standing = state.standings[register.key];
      if (!standing || standing.phase === "idle" || standing.phase === "reading") return;
      let error: string | undefined;
      if (standing.readingInvalidated) error = "This Scene's source reading changed; refresh its Wiki reading before using its facets";
      else if (standing.phase === "unavailable") error = standing.reason;
      else if (standing.phase === "absent") error = "This register has no Wiki reading";
      const reading = wikiReadingOf(standing);
      if (!error && !reading) error = "The native projection has no retained source reading";
      if (done) return;
      done = true; unsubscribe();
      if (error) reject(new Error(error)); else resolve(reading!);
    };
    unsubscribe = subscribeWikiProjection(check);
    ensureWikiProjection(register, transport);
    check();
  });
}

/** Explicit source refresh reuses the existing receipt-driven owner path.
 * It does not replace or edit the native Expression document. */
export async function refreshWikiProjectionReading(register: WikiRegister, transport: KernelTransportStatus): Promise<ReadyReading> {
  if (!state.standings[register.key] || state.standings[register.key].phase === "idle") return ensureWikiProjectionReading(register, transport);
  await rereadWikiRegister(register, transport, true);
  return ensureWikiProjectionReading(register, transport);
}

// ---- the centre writes the kernel lifecycle back ---------------------------

/** The centre is about to inspect/open the projection's generation. */
export function wikiProjectionOpening(registerKey: string) {
  const standing = state.standings[registerKey];
  if (standing?.phase !== "projected") return;
  setStanding(registerKey, {phase: "opening", reading: standing.reading, projection: standing.projection});
}

/** The kernel opened (or already stood) the generation: the document — with
 * its own selection — is the standing truth. */
export function wikiProjectionDocumentReady(registerKey: string, document: ExpressionDocument) {
  const standing = state.standings[registerKey];
  if (!standing || !("projection" in standing) || !standing.projection) return;
  setStanding(registerKey, {phase: "ready", reading: retainedReadingOf(standing), readingInvalidated: standing.readingInvalidated, projection: standing.projection, document});
  mutate(current => ({selection: selectionOf(registerKey, current.standings[registerKey])}));
}

/** A focus edit landed: the phase keeps its standing (a drift disclosure
 * stays disclosed); the document and its selection are the new truth. */
export function wikiProjectionDocumentFocused(registerKey: string, document: ExpressionDocument) {
  const standing = state.standings[registerKey];
  if (!standing || !("projection" in standing) || !standing.projection) return;
  setStanding(registerKey, standing.phase === "drift"
    ? {phase: "drift", reading: retainedReadingOf(standing), readingInvalidated: standing.readingInvalidated, projection: standing.projection, document, reason: standing.reason}
    : {phase: "ready", reading: retainedReadingOf(standing), readingInvalidated: standing.readingInvalidated, projection: standing.projection, document});
  mutate(current => ({selection: selectionOf(registerKey, current.standings[registerKey])}));
}

/** The kernel refused the open (or the generation could not be read back):
 * the named reason IS the state; the projection stays for the apertures. */
export function wikiProjectionKernelUnavailable(registerKey: string, reason: string) {
  const standing = state.standings[registerKey];
  if (standing?.phase === "projected" || standing?.phase === "opening") {
    setStanding(registerKey, {phase: "unavailable", reason, reading: standing.reading, projection: standing.projection});
    return;
  }
  mutate(current => ({
    standings: {...current.standings, [registerKey]: {phase: "unavailable", reason, ...(standing && "projection" in standing ? {projection: standing.projection} : {})}},
  }));
}

/** The standing generation carries a different content under the same
 * identity (the kernel never replaces an open draft implicitly). */
export function wikiProjectionDrift(registerKey: string, document: ExpressionDocument, reason: string) {
  const standing = state.standings[registerKey];
  if (!standing || !("projection" in standing) || !standing.projection) return;
  setStanding(registerKey, {phase: "drift", reading: retainedReadingOf(standing), readingInvalidated: standing.readingInvalidated, projection: standing.projection, document, reason});
  mutate(current => ({selection: selectionOf(registerKey, current.standings[registerKey])}));
}

/** The register whose standing generation owns an expression ref (the
 * cross-mode ask path: an ask names a projection, and the projection names
 * its register — the active register may be elsewhere). */
export function wikiRegisterOwning(expressionRef: string): string | null {
  for (const [key, standing] of Object.entries(state.standings)) {
    if (wikiDocumentOf(standing)?.expression_ref === expressionRef) return key;
  }
  return null;
}

// ---- currentness: the file_changed seam ------------------------------------

/** Receipts already applied — deduped exactly like the files broker's own
 * cursor, so the shell's replayed receipt bursts invalidate once. */
let appliedWikiReceiptSeq = 0;
/** One generation per in-flight re-read, per register: a burst of writes to
 * the same wiki basis lets only the newest re-read write the standing back. */
const rereadGenerations = new Map<string, number>();

/** A kernel `file_changed` receipt whose path is a register's wiki basis
 * invalidates that register's cached reading (the seam the 13-step walk
 * named): the store re-reads the local whole and re-projects, and the
 * centre's open flow checks the source basis against the same stable identity;
 * a changed wiki is drift, not permission to remint or overwrite composition;
 * the kernel never replaces the standing draft. The stale-while-revalidate
 * law is the files broker's own: the standing stays visible to every
 * aperture while the fresh read flies. Returns the register keys
 * invalidated. Any other event, an already-applied seq, or a path no
 * register reads is not this store's concern. */
export function applyWikiProjectionReceipt(
  receipt: {event: string; path?: unknown; seq: number},
  transport: KernelTransportStatus,
): string[] {
  if (receipt.event !== "file_changed") return [];
  if (typeof receipt.seq !== "number" || !Number.isFinite(receipt.seq) || receipt.seq <= appliedWikiReceiptSeq) return [];
  appliedWikiReceiptSeq = Math.max(appliedWikiReceiptSeq, receipt.seq);
  if (typeof receipt.path !== "string" || receipt.path.length === 0) return [];
  const invalidated: string[] = [];
  for (const register of state.registers) {
    if (wikiPathOf(register) !== receipt.path) continue;
    const standing = state.standings[register.key];
    if (!standing || standing.phase === "idle") continue;
    invalidated.push(register.key);
    void rereadWikiRegister(register, transport);
  }
  return invalidated;
}

/** The re-read behind an invalidation: whatever the fresh read returns
 * replaces the cache — a fresh reading re-stands as "projected" (the centre
 * opens its new generation), an honest absence or refusal replaces a cache
 * that no longer has a basis, and a failed re-read under a standing document
 * is named as drift rather than silently keeping a currentness claim. */
async function rereadWikiRegister(register: WikiRegister, transport: KernelTransportStatus, preserveDocument = false) {
  const generation = (rereadGenerations.get(register.key) ?? 0) + 1;
  rereadGenerations.set(register.key, generation);
  const previous = state.standings[register.key];
  if (previous) setStanding(register.key, {...previous, readingInvalidated: true});
  let fresh: WikiRegisterReading;
  try {
    fresh = await readWikiRegister(transport, register);
  } catch (cause) {
    // A read that throws (a malformed basis, a refused listing) is an
    // unavailable reading, never a silent keep of the stale cache.
    fresh = {state: "unavailable", reason: text(cause)};
  }
  try {
    const standing = state.standings[register.key];
    if (!standing || standing.phase === "idle") return;
    if (rereadGenerations.get(register.key) !== generation) return;
    if (fresh.state === "absent") { setStanding(register.key, {phase: "absent"}); return; }
    if (fresh.state === "unavailable") {
      if (standing.phase === "ready" || standing.phase === "drift") {
        wikiProjectionDrift(register.key, standing.document, `the wiki basis changed and the fresh reading could not be served (${fresh.reason}); the standing generation shows`);
        return;
      }
      setStanding(register.key, {
        phase: "unavailable", reason: fresh.reason,
        ...("projection" in standing && standing.projection ? {projection: standing.projection} : {}),
      });
      return;
    }
    const projection = projectWikiExpression(fresh);
    if (preserveDocument && (standing.phase === "ready" || standing.phase === "drift")) {
      const basis = projection.document.provenance[0];
      const matches = standing.document.provenance.some(row => row.ref === basis.ref && row.revision === basis.revision && row.availability === "available");
      setStanding(register.key, matches
        ? {phase: "ready", reading: fresh, projection, document: standing.document}
        : {phase: "drift", reading: fresh, projection, document: standing.document, reason: "The source revision changed; the native composition was retained"});
    } else setStanding(register.key, {phase: "projected", reading: fresh, projection});
  } catch {
    // The standing generation stays exactly as it was.
  }
}

// ---- selection requests (the aperture → centre direction) ------------------

/** An aperture asks the instrument to focus a position: switching to the
 * request's register IS part of the ask (the projection jumps to the
 * register the subject lives in). The centre consumes the request once the
 * register's generation stands. */
export function requestWikiSelection(request: Omit<WikiSelectionRequest, "seq">) {
  if (state.registerKey !== request.registerKey) {
    try { window.localStorage.setItem(REGISTER_KEY_STORAGE, request.registerKey); } catch { /* per-viewer convenience only */ }
  }
  mutate(current => ({
    registerKey: request.registerKey,
    request: {...request, seq: current.request?.seq ? current.request.seq + 1 : 1},
  }));
}

/** The centre takes the pending request (at most once). */
export function consumeWikiSelectionRequest(): WikiSelectionRequest | null {
  const request = state.request;
  if (!request) return null;
  mutate(() => ({request: null}));
  return request;
}

// ---- reading the state ------------------------------------------------------

export function subscribeWikiProjection(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const getWikiProjectionState = (): Readonly<WikiProjectionState> => state;
export function useWikiProjectionState(): Readonly<WikiProjectionState> {
  return useSyncExternalStore(subscribeWikiProjection, getWikiProjectionState, getWikiProjectionState);
}

/** The projection an aperture renders (present from "projected" through
 * "drift" — the reading's own generation, whatever the kernel flow). */
export function wikiProjectionOf(standing: RegisterStanding | undefined): WikiProjection | undefined {
  if (!standing) return undefined;
  return "projection" in standing ? standing.projection : undefined;
}

/** The document an aperture reads positions/relations from: the standing
 * kernel document where one stands, else the projection's own document. */
export function wikiDocumentOf(standing: RegisterStanding | undefined): ExpressionDocument | undefined {
  if (!standing) return undefined;
  if (standing.phase === "ready" || standing.phase === "drift") return standing.document;
  return wikiProjectionOf(standing)?.document;
}

/** The truthful short state line for a register's region head. */
export function wikiStandingSubtitle(standing: RegisterStanding | undefined): string {
  switch (standing?.phase ?? "idle") {
    case "idle": return "";
    case "reading": return "reading…";
    case "absent": return "no wiki";
    case "unavailable": return "couldn't read";
    case "projected": return "projected";
    case "opening": return "opening…";
    case "ready": {
      const projection = wikiProjectionOf(standing);
      const constellations = projection?.constellations.length ?? 0;
      if (constellations === 0) return "no constellations yet";
      const relations = projection?.boundRelationCount ?? 0;
      return relations > 0
        ? `${constellations} ${constellations === 1 ? "constellation" : "constellations"}, ${relations} ${relations === 1 ? "relation" : "relations"}`
        : `${constellations} ${constellations === 1 ? "constellation" : "constellations"}`;
    }
    case "drift": return "drift";
  }
}
