/**
 * The verso ACCOUNT — the same subject's archival/source/library depth
 * (owner Wayfinder §10), read live through the owners only:
 *
 *   identity        the kernel navigator's own world reading (root,
 *                   project, ProjectCentral wiki space) — never a guessed
 *                   naming convention;
 *   document        the kernel's own expression inspect when the subject is
 *                   an Expression ref — scenes, bound subjects with their
 *                   sources and disclosed Actions, provenance, editions the
 *                   owner supplies (the saved file identity);
 *   page            the knowledge read when the subject is a wiki/knowledge
 *                   ref — the ACTUAL page content with its provider,
 *                   authority and revision, and the evidence refs it names;
 *   source file     a real Central file read when the subject carries a
 *                   CentralLocation — content and revision, verbatim;
 *   web position    the ONE wiki projection state's current selection
 *                   (wikiProjectionStore, read-only) — where the face stands.
 *
 * Nothing here writes, mutates or re-identifies: the verso is a reading, so
 * closing it returns the field to the exact position it was opened from.
 * Every absent piece is a named state, never invented — provenance,
 * editions, actions and history appear only where an owner actually
 * supplies them.
 */
import {useEffect, useRef, useState} from "react";
import {kernelOp} from "../kernel/bridge";
import type {CentralLocation, KernelTransportStatus} from "../kernel/types";
import {readFile} from "../files/client";
import {knowledge} from "../knowledge/client";
import type {ExpressionDocument, ExpressionResult} from "./types";
import {getWikiProjectionState} from "../techne/wikiProjectionStore";

/** The subject the verso accounts for — the face's own address, carried
 * verbatim; the verso never mints one. */
export interface VersoSubject {
  ref: string;
  kind?: string;
  nativeOwner?: string;
  title?: string;
  /** The project the knowledge reads are scoped to (undefined = Central). */
  project?: string;
  /** A Central file the subject stands on (a Library row's exact source). */
  sourceLocation?: CentralLocation;
  /** The face's scene/entity position, when the subject is an Expression. */
  sceneRef?: string | null;
  entityRef?: string | null;
  /** The exact relation occurrence the face had selected, when one stood. */
  relationRef?: string | null;
  /** The native revision the field stood on when the verso was summoned.
   * The account reads the owner's CURRENT revision live and discloses any
   * drift; this carried number is never treated as source truth. */
  revision?: number;
}

/** World / Project / ProjectCentral identity — from the kernel navigator's
 * own world reading only. */
export interface VersoIdentity {
  worldRoot?: string;
  projectName?: string;
  projectPath?: string;
  projectCentralWikiSpace?: string;
  projectCentralState?: string;
}

/** The face's position in the ONE wiki projection state (read-only). */
export interface VersoWebPosition {
  registerKey: string | null;
  expressionRef: string | null;
  sceneRef: string | null;
  entityRef: string | null;
  subjectRef: string | null;
}

export interface VersoSourceRef {ref: string; revision?: string; availability?: string}
export interface VersoAction {actionRef: string; targetRef: string; authorityRequirement?: string; entityRef?: string}
export interface VersoPageReading {resource: string; provider: string; authority: string; revision?: string; content?: string; evidence: string[]}
export interface VersoSourceFileReading {location: CentralLocation; revision: string; content: string}

/** The verso account reading. Sparse-able: an absent piece is absent, named
 * by its region's own honest line — never fabricated. */
export interface VersoAccount {
  subject: VersoSubject;
  identity: VersoIdentity;
  document?: ExpressionDocument;
  /** The saved file identity the owner disclosed for this Expression. */
  savedFile?: {ref: string; revision: string};
  page?: VersoPageReading;
  sourceFile?: VersoSourceFileReading;
  web: VersoWebPosition;
  sources: VersoSourceRef[];
  actions: VersoAction[];
  editions: string[];
  /** Where the return stands — supplied by the host, never invented here. */
  returnTrail?: {mode: string; label: string}[];
  notices: string[];
}

export type VersoAccountReading =
  | {state: "no-subject"}
  | {state: "reading"; subject: VersoSubject}
  | {state: "ready"; account: VersoAccount}
  | {state: "unavailable"; subject: VersoSubject; reason: string};

/** A native work carried by the hosted application's summon — an untrusted
 * pointer (refs only, never content) to the exact Expression / Scene /
 * entity-or-relation occurrence the person is actually looking at. */
export interface CarriedNativeSubject {
  ref?: unknown; kind?: unknown; nativeOwner?: unknown; title?: unknown; project?: unknown;
  revision?: unknown; sceneRef?: unknown; entityRef?: unknown; relationRef?: unknown;
}

/** Sanitise a summon-carried native subject into a VersoSubject, or null.
 * Only well-formed refs survive; nothing is minted and no content is read
 * here — the owner validates the pointer in readVersoAccount. */
function sanitiseCarriedSubject(carried: CarriedNativeSubject | undefined): VersoSubject | null {
  if (!carried || typeof carried !== "object" || typeof carried.ref !== "string" || !carried.ref) return null;
  const str = (value: unknown): string | undefined => (typeof value === "string" && value.length > 0 ? value : undefined);
  const refOrNull = (value: unknown): string | null | undefined => (typeof value === "string" ? value : value === null ? null : undefined);
  return {
    ref: carried.ref,
    kind: str(carried.kind),
    nativeOwner: str(carried.nativeOwner),
    title: str(carried.title),
    project: str(carried.project),
    sceneRef: refOrNull(carried.sceneRef),
    entityRef: refOrNull(carried.entityRef),
    relationRef: refOrNull(carried.relationRef),
    revision: typeof carried.revision === "number" && Number.isFinite(carried.revision) ? carried.revision : undefined,
  };
}

/** The subject the summon presents. The hosted application's exact current
 * native work comes FIRST when it carries one — it is the subject the person
 * is looking at, not a global fallback. Otherwise: the kernel's own global
 * focus, then the ONE projection state's current selection, then the host's
 * workspace subject. Nothing is minted — when none stands, the verso says NO
 * SUBJECT. */
export function resolveVersoSubject(
  focusSubject: {ref: string; kind: string; native_owner: string} | undefined,
  hostSubject?: {ref?: string; kind?: string; title?: string; project?: string},
  carried?: CarriedNativeSubject,
): VersoSubject | null {
  const native = sanitiseCarriedSubject(carried);
  // The carried native work stands in the host's project unless it names its
  // own — so a verso over native work in a project reads at that project's
  // scope, not silently at Central root.
  if (native) return {...native, project: native.project ?? hostSubject?.project};
  if (focusSubject?.ref) {
    const selection = getWikiProjectionState().selection;
    return {
      ref: focusSubject.ref,
      kind: focusSubject.kind,
      nativeOwner: focusSubject.native_owner,
      project: hostSubject?.project,
      sceneRef: selection.subjectRef === focusSubject.ref ? selection.sceneRef : undefined,
      entityRef: selection.subjectRef === focusSubject.ref ? selection.entityRef : undefined,
    };
  }
  const selection = getWikiProjectionState().selection;
  if (selection.subjectRef) {
    return {
      ref: selection.subjectRef,
      kind: "wiki",
      nativeOwner: "wiki",
      project: hostSubject?.project,
      sceneRef: selection.sceneRef,
      entityRef: selection.entityRef,
    };
  }
  if (hostSubject?.ref) {
    return {ref: hostSubject.ref, kind: hostSubject.kind, nativeOwner: undefined, title: hostSubject.title, project: hostSubject.project};
  }
  return null;
}

const CONTENT_BUDGET = 4000;
const text = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);

/** Read one subject's account. Every read is a live owner read through the
 * same seams every surface uses; failures name themselves per region and the
 * account still stands on what did resolve. */
export async function readVersoAccount(transport: KernelTransportStatus, subject: VersoSubject, returnTrail?: {mode: string; label: string}[]): Promise<VersoAccount> {
  const notices: string[] = [];
  const account: VersoAccount = {
    subject,
    identity: {},
    web: {...getWikiProjectionState().selection},
    sources: [],
    actions: [],
    editions: [],
    returnTrail,
    notices,
  };

  // Identity — the kernel navigator's own world reading. Unavailable when
  // the navigator has none; named, never guessed from paths.
  // (The navigator rides the kernel snapshot; read it through the state op
  // so the account is self-contained.)
  try {
    const reply = await kernelOp(transport, {op: "state"});
    const snapshot = reply.outcome?.result === "state" ? reply.outcome.snapshot as {navigator?: {root?: {root: string} | null; project?: {project?: {name: string; path: string; projectcentral?: {state?: string; agent_wiki?: {wiki?: {space_ref?: string}}}}} | null} | undefined} : undefined;
    const navigator = snapshot?.navigator;
    if (navigator?.root) account.identity.worldRoot = navigator.root.root;
    const project = navigator?.project?.project;
    if (project) {
      account.identity.projectName = project.name;
      account.identity.projectPath = project.path;
      account.identity.projectCentralWikiSpace = project.projectcentral?.agent_wiki?.wiki?.space_ref;
      account.identity.projectCentralState = project.projectcentral?.state;
    } else if (subject.project) {
      notices.push(`The world reading carries no project position for "${subject.project}"; the account stands on the subject alone.`);
    }
  } catch (cause) {
    notices.push(`The world reading did not resolve: ${text(cause)}`);
  }

  // The subject's own depth: an Expression ref reads its document; a
  // knowledge ref reads its page; both may add sources and Actions.
  const isExpression = subject.ref.startsWith("expression:");
  if (isExpression) {
    try {
      const reply = await kernelOp(transport, {op: "expression", request: {operation: "inspect", expression_ref: subject.ref}});
      const data = reply.outcome?.result === "expression" ? reply.outcome.data as ExpressionResult : undefined;
      if (reply.error || !data?.document) throw new Error(reply.error ?? "the kernel returned no document for this Expression");
      account.document = data.document;
      // Validate through the owner: the carried revision is only what the
      // field stood on; the owner's current revision is the truth, and any
      // drift is disclosed rather than silently trusted.
      if (typeof subject.revision === "number" && data.document.revision !== subject.revision) {
        notices.push(`The field stood on native revision ${subject.revision}; this account reads the owner's current revision ${data.document.revision}.`);
      }
      // Name the exact occurrence the face selected, when the owner's document
      // still carries it — never fabricated, never re-pointed to another.
      if (subject.relationRef) {
        const relation = Object.values(data.document.relations ?? {}).find(edge => edge.relation.ref === subject.relationRef);
        notices.push(relation
          ? `The face selected relation ${subject.relationRef} · ${relation.from_entity_ref} → ${relation.to_entity_ref}.`
          : `The face selected relation ${subject.relationRef}, which the owner's current revision no longer carries.`);
      }
      // The scene/member occurrence is carried verbatim; a missing anchor is
      // named explicitly, never silently shown as current (§§25,36).
      if (subject.sceneRef && !data.document.scenes.some(scene => scene.scene_ref === subject.sceneRef)) {
        notices.push(`The face stood on scene ${subject.sceneRef}, which the owner's current revision no longer carries.`);
      }
      if (subject.entityRef && !data.document.entities[subject.entityRef]) {
        notices.push(`The face stood on member ${subject.entityRef}, which the owner's current revision no longer carries.`);
      }
      if (data.file) account.savedFile = {ref: data.file.location.ref, revision: data.file.revision};
      for (const entity of Object.values(data.document.entities)) {
        const binding = entity.subject;
        if (!binding) continue;
        for (const source of binding.sources) account.sources.push({ref: source.ref, revision: source.revision, availability: source.availability});
        for (const action of binding.actions) account.actions.push({actionRef: action.action_ref, targetRef: action.target_ref, authorityRequirement: action.authority_requirement, entityRef: entity.entity_ref});
      }
      if (data.document.collections?.length) account.editions.push(...data.document.collections);
    } catch (cause) {
      notices.push(`The Expression read did not resolve: ${text(cause)}`);
    }
  } else {
    try {
      const page = await knowledge<{resource: string; provider: string; authority: string; revision?: string; content?: string; evidence: string[]}>(
        transport, subject.project, {action: "read", address: {kind: "wiki", value: subject.ref}});
      account.page = {
        resource: page.resource, provider: page.provider, authority: page.authority, revision: page.revision,
        content: page.content?.slice(0, CONTENT_BUDGET),
        evidence: page.evidence ?? [],
      };
      for (const evidenceRef of account.page.evidence) account.sources.push({ref: evidenceRef, availability: "available"});
    } catch (cause) {
      notices.push(`The page read did not resolve: ${text(cause)}`);
    }
  }

  // The subject's exact source file, when the face carries one.
  if (subject.sourceLocation) {
    try {
      const reading = await readFile(transport, subject.sourceLocation);
      account.sourceFile = {location: reading.location, revision: reading.revision, content: reading.content.slice(0, CONTENT_BUDGET)};
      account.sources.push({ref: reading.location.ref, revision: reading.revision, availability: "available"});
    } catch (cause) {
      notices.push(`The source file read did not resolve: ${text(cause)}`);
    }
  }

  // The face's scene/entity position, when the subject is an Expression the
  // face stands in: carried from the subject verbatim (never re-derived).
  return account;
}

/** React binding: one generation-guarded account read per subject. A new
 * subject supersedes the in-flight read of the previous one; the hook owns
 * no cache — every open re-reads its subject live. */
export function useVersoAccount(transport: KernelTransportStatus, subject: VersoSubject | null, returnTrail?: {mode: string; label: string}[]): VersoAccountReading {
  const [reading, setReading] = useState<VersoAccountReading>(subject ? {state: "reading", subject} : {state: "no-subject"});
  const generation = useRef(0);
  const trailKey = returnTrail ? JSON.stringify(returnTrail) : "";
  useEffect(() => {
    const at = ++generation.current;
    if (!subject) { setReading({state: "no-subject"}); return; }
    setReading({state: "reading", subject});
    void readVersoAccount(transport, subject, returnTrail).then(
      account => { if (generation.current === at) setReading({state: "ready", account}); },
      cause => { if (generation.current === at) setReading({state: "unavailable", subject, reason: text(cause)}); },
    );
    // trailKey stands for returnTrail (the trail is host state; a changed
    // trail re-renders the account's Return line through the account read).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport, subject?.ref, subject?.project, subject?.sourceLocation?.ref, subject?.sceneRef ?? null, subject?.entityRef ?? null, subject?.relationRef ?? null, subject?.revision ?? null, trailKey]);
  return reading;
}
