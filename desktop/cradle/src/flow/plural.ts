/** Plural Flow form v0.4 — the pure model shared by every consumer of a Flow
 * document: participant keys, typed relations, validation, deterministic
 * upgrade, and the idempotent, caller-checked contribution append.
 *
 * PF0/PF1 binding (O-I#558, docs/experience/PLURAL-FLOW-SPEC.md §2): the
 * document stays one ordinary HTML file with its embedded `ql-doc` island;
 * this module never touches the HTML shell, the collections it does not own
 * (notes, packet, media, journal) or unknown compatible metadata. Native
 * owners (Central's append, AIKit's correlated return) implement the same
 * rules against `documents/fixtures/plural-flow-cases.json`; UI code calls
 * these functions directly. Nothing here is authority: attribution is one of
 * verified / declared / inferred / unknown / imported, and only a caller the
 * native owner has itself identified can produce `verified`. */
import type {QlDoc, QlDocEntry, QlDocParticipant} from "./instance";

export const FORMAT_VERSION = 4;
export const TEMPLATE_V4 = "ql-dialogue-flow v0.4";

export type AttributionBasis = "verified" | "declared" | "inferred" | "unknown" | "imported";
export interface Binding {owner: string; ref?: string; basis: AttributionBasis}
export interface PluralParticipant extends QlDocParticipant {
  /** Stable document-local key, independent of initial and name. */
  key?: string;
  binding?: Binding;
  role?: "contributor" | "observer";
  joined?: {at: string; revision: number};
  left?: {at: string; revision: number};
  /** Readable-history horizon: the first entry this participant may read
   * (null/absent = from the start). */
  historyFrom?: string | null;
}
export interface Attribution {
  basis: AttributionBasis;
  agency?: string;
  session?: string;
  generation?: string | number;
  workcell?: string;
  /** Speaker and represented party are separate facts. */
  onBehalfOf?: {key: string; authority: string};
}
export type RelationType = "reply" | "branch" | "converge" | "correct" | "source" | "artifact";
export interface Relation {
  type: RelationType;
  entryId?: string;
  /** Document revision the target was read at. */
  revision?: number;
  anchor?: string | null;
  ref?: string;
}
export interface PluralEntry extends QlDocEntry {
  authorKey?: string;
  attribution?: Attribution;
  addressees?: string[];
  audience?: "group" | {keys: string[]};
  intent?: "contribution" | "response" | "work";
  relations?: Relation[];
  /** The native operation that produced this entry and the digest of its
   * payload; the document itself is the idempotency record. */
  request?: {ref: string; digest: string};
  /** Document revision the author composed against. */
  basisRevision?: number;
}
export interface PluralMeta {
  format?: {version: number; minReader: number};
  upgrade?: {from: string; at: string; originalDigest: string; receipt: string};
}

export type IssueCode =
  | "duplicate-entry-id" | "duplicate-participant-key" | "unknown-author-key" | "author-initial-mismatch"
  | "unknown-addressee" | "unknown-audience-key" | "relation-target-missing" | "relation-cycle"
  | "relation-shape" | "reply-multiple" | "converge-needs-two" | "request-digest-mismatch" | "legacy-format";
export interface Issue {code: IssueCode; path: string; detail?: string}

export type RefusalCode =
  | "legacy-format" | "unsupported-format" | "unknown-author" | "author-not-caller" | "impersonation"
  | "observer-cannot-contribute" | "participant-left" | "unknown-addressee" | "unknown-audience-key"
  | "relation-target-missing" | "relation-revision-ahead" | "relation-shape" | "reply-multiple" | "converge-needs-two"
  | "request-conflict" | "duplicate-entry-id" | "empty-operation" | "attribution-overclaim" | "authentication-required";
export class Refusal extends Error {
  code: RefusalCode;
  constructor(code: RefusalCode, message: string) {
    super(message);
    this.name = "Refusal";
    this.code = code;
  }
}

/** The caller as the native owner identified it — never a value taken from
 * the document or the request body's own author claim. */
export interface Caller {
  kind: "human" | "agent" | "system";
  /** Owner-qualified identity: the human ref or the agent/session ref. */
  ref?: string;
  agent?: string;
  session?: string;
  generation?: string | number;
  workcell?: string;
  /** True only when the native owner authenticated this caller (a host-held
   * credential), never because a request body says who it is. Only an
   * authenticated caller can produce `verified` attribution or write a
   * participant whose binding is verified. */
  authenticated?: boolean;
}

// ---------- canonical digest (shared with the native owners) ----------

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return "{" + Object.keys(object).filter(key => object[key] !== undefined).sort().map(key => JSON.stringify(key) + ":" + canonicalJson(object[key])).join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
/** SHA-256 over UTF-8, synchronous and dependency-free so the app, the
 * standalone form and the native owners compute the same digest. */
export function sha256(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 2 ** 32));
  view.setUint32(padded.length - 4, bitLength >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  return Array.from(h, word => word.toString(16).padStart(8, "0")).join("");
}

// ---------- reading ----------

type Doc = QlDoc & {meta: QlDoc["meta"] & PluralMeta; entries: PluralEntry[]};
const participantsOf = (doc: QlDoc): PluralParticipant[] => (doc.meta.participants ?? []) as PluralParticipant[];

export function formatVersionOf(doc: QlDoc): number {
  return (doc as Doc).meta.format?.version ?? 3;
}
export const isCurrentFormat = (doc: QlDoc): boolean => formatVersionOf(doc) >= FORMAT_VERSION;

/** The entry's reply/branch/converge/correct/… relations; a legacy
 * `replyTo` reads as one reply relation. Reading never mutates. */
export function relationsOf(entry: PluralEntry): Relation[] {
  if (entry.relations?.length) return entry.relations;
  return entry.replyTo ? [{type: "reply", entryId: entry.replyTo.entryId, anchor: entry.replyTo.anchor}] : [];
}

/** Resolve an entry's author to a participant. A key is exact; an initial
 * that more than one participant declares is ambiguous and resolves to
 * nothing — history is never retroactively assigned to a present agent. */
export function authorOf(doc: QlDoc, entry: PluralEntry): PluralParticipant | undefined {
  const participants = participantsOf(doc);
  if (entry.authorKey) return participants.find(p => p.key === entry.authorKey);
  const matches = participants.filter(p => p.initial === entry.author);
  return matches.length === 1 ? matches[0] : undefined;
}
export function activeParticipants(doc: QlDoc): PluralParticipant[] {
  return participantsOf(doc).filter(p => !p.left);
}

// ---------- validation ----------

const CAUSAL: RelationType[] = ["reply", "branch", "converge", "correct"];
export function validateDocument(doc: QlDoc): Issue[] {
  const issues: Issue[] = [];
  const entries = doc.entries as PluralEntry[];
  const participants = participantsOf(doc);
  const ids = new Set<string>();
  entries.forEach((entry, i) => {
    if (ids.has(entry.id)) issues.push({code: "duplicate-entry-id", path: `entries[${i}].id`});
    ids.add(entry.id);
  });
  const keys = new Set<string>();
  participants.forEach((participant, i) => {
    if (!participant.key) return;
    if (keys.has(participant.key)) issues.push({code: "duplicate-participant-key", path: `meta.participants[${i}].key`});
    keys.add(participant.key);
  });
  const current = isCurrentFormat(doc);
  entries.forEach((entry, i) => {
    const at = `entries[${i}]`;
    if (entry.authorKey) {
      const author = participants.find(p => p.key === entry.authorKey);
      if (!author) issues.push({code: "unknown-author-key", path: `${at}.authorKey`});
      else if (author.initial !== entry.author) issues.push({code: "author-initial-mismatch", path: `${at}.author`});
    }
    (entry.addressees ?? []).forEach(key => { if (!keys.has(key)) issues.push({code: "unknown-addressee", path: `${at}.addressees`, detail: key}); });
    if (entry.audience && entry.audience !== "group") entry.audience.keys.forEach(key => { if (!keys.has(key)) issues.push({code: "unknown-audience-key", path: `${at}.audience`, detail: key}); });
    const relations = relationsOf(entry);
    relations.forEach((relation, r) => {
      if (relation.entryId !== undefined && !ids.has(relation.entryId)) issues.push({code: "relation-target-missing", path: `${at}.relations[${r}]`, detail: relation.entryId});
      if ((relation.type === "source" || relation.type === "artifact") ? !relation.ref : !relation.entryId) issues.push({code: "relation-shape", path: `${at}.relations[${r}]`});
    });
    if (relations.filter(r => r.type === "reply").length > 1) issues.push({code: "reply-multiple", path: `${at}.relations`});
    const converge = relations.filter(r => r.type === "converge").length;
    if (converge === 1) issues.push({code: "converge-needs-two", path: `${at}.relations`});
    if (entry.request) {
      const {digest: stored} = entry.request;
      if (stored !== requestDigest(entry)) issues.push({code: "request-digest-mismatch", path: `${at}.request`});
    }
  });
  // The causal reply structure must not loop (other semantic links may).
  const parent = new Map<string, string[]>();
  entries.forEach(entry => parent.set(entry.id, relationsOf(entry).filter(r => CAUSAL.includes(r.type) && r.entryId).map(r => r.entryId as string)));
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): boolean => {
    if (state.get(id) === 2) return false;
    if (state.get(id) === 1) return true;
    state.set(id, 1);
    for (const next of parent.get(id) ?? []) if (parent.has(next) && visit(next)) return true;
    state.set(id, 2);
    return false;
  };
  entries.forEach((entry, i) => { if (visit(entry.id)) issues.push({code: "relation-cycle", path: `entries[${i}]`}); });
  if (!current) issues.push({code: "legacy-format", path: "meta.format", detail: `format v${formatVersionOf(doc)}`});
  return issues;
}

// ---------- deterministic upgrade ----------

const fnv = (text: string): string => {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(text)) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  return hash.toString(16).padStart(16, "0");
};
export const legacyParticipantKey = (documentId: string | null, initial: string, ordinal: number): string => `p-${fnv(`${documentId ?? ""}\u0000${initial}\u0000${ordinal}`)}`;

/** Explicit upgrade to v0.4. Identity-preserving (documentId, entry ids,
 * bodies and every collection are kept), deterministic (same input → same
 * bytes) and idempotent (a v0.4 document returns unchanged). The original
 * basis is recorded as a digest of the pre-upgrade island. Ambiguous
 * historical initials stay unassigned: the entry keeps its declared initial
 * and gains `attribution.basis: "unknown"`, never the present agent. */
export function upgradeDocument(doc: QlDoc, at: string): QlDoc {
  if (isCurrentFormat(doc)) return doc;
  const original = JSON.parse(JSON.stringify(doc)) as Doc;
  const next = JSON.parse(JSON.stringify(doc)) as Doc;
  const declared = participantsOf(next);
  const base: PluralParticipant[] = declared.length ? declared : [
    {initial: "F", kind: "person", name: "the person"},
    {initial: "H", kind: "agent", name: "the agent"},
  ];
  const counts = new Map<string, number>();
  base.forEach(p => counts.set(p.initial, (counts.get(p.initial) ?? 0) + 1));
  base.forEach((participant, ordinal) => {
    participant.key ??= legacyParticipantKey(next.meta.documentId, participant.initial, ordinal);
    participant.binding ??= {owner: "document", ref: participant.ref ?? "", basis: participant.ref ? "declared" : "unknown"};
    if (!participant.binding.ref) delete participant.binding.ref;
    participant.role ??= "contributor";
  });
  next.meta.participants = base;
  (next.entries as PluralEntry[]).forEach(entry => {
    const matches = base.filter(p => p.initial === entry.author);
    if (matches.length === 1 && !entry.authorKey) entry.authorKey = matches[0].key;
    entry.attribution ??= {basis: matches.length === 1 ? "declared" : "unknown"};
    if (entry.replyTo && !entry.relations) entry.relations = [{type: "reply", entryId: entry.replyTo.entryId, anchor: entry.replyTo.anchor}];
  });
  next.meta.template = TEMPLATE_V4;
  next.meta.format = {version: FORMAT_VERSION, minReader: FORMAT_VERSION};
  const originalDigest = sha256(canonicalJson(original));
  next.meta.upgrade = {from: original.meta.template, at, originalDigest, receipt: sha256(`${originalDigest}\u0000${TEMPLATE_V4}`)};
  return next;
}

// ---------- append ----------

export interface AppendRequest {
  /** The idempotency identity of this native operation. */
  operationRef: string;
  /** The participant the contribution is authored as. */
  authorKey: string;
  html: string;
  at: string;
  addressees?: string[];
  audience?: "group" | {keys: string[]};
  intent?: PluralEntry["intent"];
  relations?: Relation[];
  /** Document revision the author composed against. */
  basisRevision?: number;
  attribution?: Partial<Attribution>;
  /** Native-supplied entry id; otherwise derived from the operation. */
  entryId?: string;
}
export interface AppendResult {
  doc: QlDoc;
  entry: PluralEntry;
  outcome: "appended" | "recovered";
}

/** Digest of what the operation asked for: everything except id and time, so
 * a replay with a different clock is the same request and any change of
 * payload, target or basis under one operation ref is a conflict. */
export function requestDigest(entry: PluralEntry): string {
  return sha256(canonicalJson({
    authorKey: entry.authorKey, html: entry.html, addressees: entry.addressees ?? [], audience: entry.audience ?? "group",
    intent: entry.intent ?? "contribution", relations: relationsOf(entry), basisRevision: entry.basisRevision ?? null, ref: entry.request?.ref,
  }));
}
export const entryIdForOperation = (operationRef: string): string => `e-${sha256(operationRef).slice(0, 24)}`;

function checkCaller(author: PluralParticipant, caller: Caller, request: AppendRequest, participants: PluralParticipant[]): Attribution {
  if (author.left) throw new Refusal("participant-left", `${author.name ?? author.initial} has left this flow`);
  if ((author.role ?? "contributor") === "observer") throw new Refusal("observer-cannot-contribute", `${author.name ?? author.initial} is an observer`);
  const claimed = request.attribution?.basis;
  const bound = author.binding && author.binding.basis === "verified" ? author.binding : undefined;
  if (caller.kind === "agent") {
    if (author.kind !== "agent") throw new Refusal("impersonation", "an agent cannot author as a person");
    const identity = caller.session ?? caller.ref;
    if (!identity) throw new Refusal("author-not-caller", "the native caller carries no agent identity");
    if (bound && !caller.authenticated) throw new Refusal("authentication-required", `${author.name ?? author.initial} is bound; only an authenticated caller may write as them`);
    if (bound && bound.ref !== identity && bound.ref !== caller.agent) throw new Refusal("author-not-caller", `${author.name ?? author.initial} is bound to another agent`);
    return {basis: caller.authenticated ? "verified" : "declared", agency: caller.agent, session: caller.session, generation: caller.generation, workcell: caller.workcell, ...(request.attribution?.onBehalfOf ? {onBehalfOf: request.attribution.onBehalfOf} : {})};
  }
  if (caller.kind === "human") {
    if (author.kind === "agent") {
      // A person may record an agent's return, as their own declaration.
      if (claimed === "verified") throw new Refusal("attribution-overclaim", "a human caller cannot produce verified agent attribution");
      return {basis: "declared"};
    }
    if (bound && !caller.authenticated) throw new Refusal("authentication-required", `${author.name ?? author.initial} is bound; only an authenticated caller may write as them`);
    if (bound && caller.ref && bound.ref !== caller.ref) throw new Refusal("impersonation", `${author.name ?? author.initial} is bound to another person`);
    if (caller.authenticated && caller.ref) {
      // An authenticated person writes as the seat declared for their identity.
      // Holding a seat of their own, they cannot write as another: the credential
      // says who they are, and sharing a flow, a machine or a label does not
      // make them the person in the next seat.
      const declared = author.binding?.ref;
      if (declared && declared !== caller.ref) throw new Refusal("impersonation", `${author.name ?? author.initial} is declared for another identity`);
      const ownSeat = participants.find(p => p.key !== author.key && p.kind === "person" && p.binding?.ref === caller.ref);
      if (ownSeat) throw new Refusal("impersonation", `this credential is ${ownSeat.name ?? ownSeat.initial}'s; it cannot write as ${author.name ?? author.initial}`);
      if (declared === caller.ref) return {basis: "verified"};
    }
    return {basis: bound && caller.ref ? "verified" : "declared"};
  }
  // System callers only ever declare what they carry; they bind no one, and
  // cannot write as a participant whose binding the owner verified.
  if (bound && !caller.authenticated) throw new Refusal("authentication-required", `${author.name ?? author.initial} is bound; only an authenticated caller may write as them`);
  if (claimed === "verified") throw new Refusal("attribution-overclaim", "a system caller cannot verify an author");
  return {basis: "declared"};
}

/** Append one distinct contribution. Rereads nothing itself — the caller
 * supplies the current document — but refuses, never mutates on refusal,
 * preserves every other byte of state, and recovers an identical replay. */
export function appendContribution(doc: QlDoc, request: AppendRequest, caller: Caller): AppendResult {
  if (!request.operationRef) throw new Refusal("empty-operation", "a native operation reference is required");
  if (formatVersionOf(doc) > FORMAT_VERSION) throw new Refusal("unsupported-format", `flow format v${formatVersionOf(doc)} needs a newer writer`);
  if (!isCurrentFormat(doc)) throw new Refusal("legacy-format", "this document is a legacy form; upgrade it explicitly before contributing");
  const participants = participantsOf(doc);
  const author = participants.find(p => p.key === request.authorKey);
  if (!author) throw new Refusal("unknown-author", `no participant ${request.authorKey}`);
  const relations = (request.relations ?? []).map(r => ({...r}));
  const probe: PluralEntry = {
    id: request.entryId ?? entryIdForOperation(request.operationRef), author: author.initial, authorKey: author.key, at: request.at, html: request.html, replyTo: null, touched: false,
    addressees: request.addressees, audience: request.audience, intent: request.intent, relations, basisRevision: request.basisRevision, request: {ref: request.operationRef, digest: ""},
  };
  const digest = requestDigest(probe);
  const existing = (doc.entries as PluralEntry[]).find(e => e.request?.ref === request.operationRef);
  if (existing) {
    if (existing.request!.digest !== digest) throw new Refusal("request-conflict", `operation ${request.operationRef} already recorded with a different payload`);
    return {doc, entry: existing, outcome: "recovered"};
  }
  const attribution = checkCaller(author, caller, request, participants);
  const ids = new Set(doc.entries.map(e => e.id));
  if (ids.has(probe.id)) throw new Refusal("duplicate-entry-id", `entry ${probe.id} already exists`);
  const keys = new Set(participants.map(p => p.key));
  (request.addressees ?? []).forEach(key => { if (!keys.has(key)) throw new Refusal("unknown-addressee", `no participant ${key}`); });
  if (request.audience && request.audience !== "group") request.audience.keys.forEach(key => { if (!keys.has(key)) throw new Refusal("unknown-audience-key", `no participant ${key}`); });
  relations.forEach(relation => {
    if (relation.type === "source" || relation.type === "artifact") {
      if (!relation.ref) throw new Refusal("relation-shape", `${relation.type} relation needs a ref`);
      return;
    }
    if (!relation.entryId) throw new Refusal("relation-shape", `${relation.type} relation needs an entry`);
    if (!ids.has(relation.entryId)) throw new Refusal("relation-target-missing", `entry ${relation.entryId} is not in this document`);
    if (relation.revision !== undefined && relation.revision > doc.meta.revision) throw new Refusal("relation-revision-ahead", "relation names a revision the document has not reached");
  });
  if (relations.filter(r => r.type === "reply").length > 1) throw new Refusal("reply-multiple", "an entry replies to one entry; use converge to relate several");
  if (relations.filter(r => r.type === "converge").length === 1) throw new Refusal("converge-needs-two", "a convergence relates at least two entries");
  const entry: PluralEntry = {...probe, attribution: {...attribution, ...(request.attribution?.onBehalfOf ? {onBehalfOf: request.attribution.onBehalfOf} : {})}, request: {ref: request.operationRef, digest}};
  const reply = relations.find(r => r.type === "reply");
  entry.replyTo = reply ? {entryId: reply.entryId as string, anchor: reply.anchor ?? null} : null;
  for (const key of ["addressees", "audience", "intent", "basisRevision"] as const) if (entry[key] === undefined) delete entry[key];
  if (!relations.length) delete entry.relations;
  const next = JSON.parse(JSON.stringify(doc)) as Doc;
  next.entries.push(entry);
  next.meta.revision = doc.meta.revision + 1;
  // A caller the owner identified binds its participant on first contribution.
  if (attribution.basis === "verified") {
    const held = (next.meta.participants as PluralParticipant[]).find(p => p.key === author.key)!;
    // An agent is bound as the enduring agent, not as the session it first used:
    // a fresh body for the same agent must still be that participant.
    const identity = caller.kind === "agent" ? (caller.agent ?? caller.session ?? caller.ref) : caller.ref;
    if (identity && (!held.binding || held.binding.basis !== "verified")) held.binding = {owner: caller.kind === "agent" ? "actuation" : "central", ref: identity, basis: "verified"};
  }
  return {doc: next, entry, outcome: "appended"};
}

// ---------- in-page authoring ----------

/** A well-formed v0.4 entry for a person writing in the open page. The page
 * is not a native owner: attribution is `declared` and no binding is
 * claimed. Insertion position is the page's business; the relations,
 * author key and reply mirror follow the same shape `appendContribution`
 * produces. */
export function draftEntry(doc: QlDoc, authorKey: string, at: string, id: string, options?: {relations?: Relation[]; addressees?: string[]; intent?: PluralEntry["intent"]}): PluralEntry {
  const author = participantsOf(doc).find(p => p.key === authorKey);
  const relations = options?.relations?.map(r => ({...r}));
  const reply = relations?.find(r => r.type === "reply");
  const entry: PluralEntry = {id, author: author?.initial ?? "", at, html: "", replyTo: reply ? {entryId: reply.entryId as string, anchor: reply.anchor ?? null} : null, touched: false};
  if (author) { entry.authorKey = author.key; entry.attribution = {basis: "declared"}; }
  if (relations?.length) entry.relations = relations;
  if (options?.addressees?.length) entry.addressees = [...options.addressees];
  if (options?.intent) entry.intent = options.intent;
  return entry;
}
/** Default participants for a blank v0.4 form: the person and one agent
 * seat, keyed deterministically from the document identity. */
export function defaultParticipants(documentId: string | null): PluralParticipant[] {
  return [
    {key: legacyParticipantKey(documentId, "F", 0), initial: "F", kind: "person", name: "the person", role: "contributor", binding: {owner: "document", basis: "unknown", ref: ""}},
    {key: legacyParticipantKey(documentId, "H", 1), initial: "H", kind: "agent", name: "the agent", role: "contributor", binding: {owner: "document", basis: "unknown", ref: ""}},
  ];
}
/** One-line reading of a relation for people, used by the page and the app. */
export function describeRelation(doc: QlDoc, relation: Relation): string {
  const entries = doc.entries as PluralEntry[];
  const number = (id?: string) => { const i = entries.findIndex(e => e.id === id); return i < 0 ? "an entry no longer here" : `entry ${i + 1}`; };
  switch (relation.type) {
    case "reply": return `Answers ${number(relation.entryId)}`;
    case "branch": return `Branches from ${number(relation.entryId)}`;
    case "converge": return `Brings together ${number(relation.entryId)}`;
    case "correct": return `Corrects ${number(relation.entryId)}`;
    case "source": return `Source ${relation.ref ?? ""}`;
    default: return `Artifact ${relation.ref ?? ""}`;
  }
}

// ---------- membership ----------

export function addParticipant(doc: QlDoc, participant: PluralParticipant, at: string): QlDoc {
  if (!isCurrentFormat(doc)) throw new Refusal("legacy-format", "upgrade the document before adding participants");
  const next = JSON.parse(JSON.stringify(doc)) as Doc;
  const list = (next.meta.participants ??= []) as PluralParticipant[];
  const key = participant.key ?? `p-${fnv(`${next.meta.documentId}\u0000${participant.initial}\u0000${list.length}\u0000${at}`)}`;
  if (list.some(p => p.key === key)) return doc;
  list.push({role: "contributor", ...participant, key, joined: {at, revision: next.meta.revision}});
  next.meta.revision += 1;
  return next;
}
/** Record the AgentSession an agent participant now answers from. The session
 * is the body, never the identity: the participant key and its agent binding
 * are unchanged, and a later session replaces this one without touching
 * earlier entries' provenance. */
export function withSession(doc: QlDoc, key: string, session: string): QlDoc {
  const next = JSON.parse(JSON.stringify(doc)) as Doc;
  const held = (next.meta.participants as PluralParticipant[] | undefined)?.find(p => p.key === key);
  if (!held || held.left || held.ref === session) return doc;
  held.ref = session;
  next.meta.revision += 1;
  return next;
}
export function leaveParticipant(doc: QlDoc, key: string, at: string): QlDoc {
  const next = JSON.parse(JSON.stringify(doc)) as Doc;
  const held = (next.meta.participants as PluralParticipant[] | undefined)?.find(p => p.key === key);
  if (!held || held.left) return doc;
  held.left = {at, revision: next.meta.revision};
  next.meta.revision += 1;
  return next;
}

// ---------- reading structure ----------

export interface ThreadNode {entry: PluralEntry; children: ThreadNode[]; converges: string[]}
/** Conversational structure derived from the relations, independent of
 * arrival order: roots are entries with no reply/branch parent; a
 * convergence entry lists every entry it draws together. */
export function buildThreads(doc: QlDoc): ThreadNode[] {
  const entries = doc.entries as PluralEntry[];
  const nodes = new Map<string, ThreadNode>(entries.map(entry => [entry.id, {entry, children: [], converges: []}]));
  const roots: ThreadNode[] = [];
  for (const entry of entries) {
    const node = nodes.get(entry.id) as ThreadNode;
    const relations = relationsOf(entry);
    node.converges = relations.filter(r => r.type === "converge" && r.entryId).map(r => r.entryId as string);
    const parent = relations.find(r => (r.type === "reply" || r.type === "branch" || r.type === "correct") && r.entryId && nodes.has(r.entryId));
    if (parent) nodes.get(parent.entryId as string)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Readable history for a participant: from their horizon forward, and never
 * the entries whose audience excludes them. */
export function readableEntries(doc: QlDoc, key: string): PluralEntry[] {
  const participant = participantsOf(doc).find(p => p.key === key);
  const entries = doc.entries as PluralEntry[];
  const from = participant?.historyFrom ? entries.findIndex(e => e.id === participant.historyFrom) : 0;
  return entries.slice(Math.max(from, 0)).filter(entry => !entry.audience || entry.audience === "group" || entry.audience.keys.includes(key) || entry.authorKey === key);
}
