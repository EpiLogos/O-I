/**
 * The wiki-grounded ql.techne/v1 reading provider (parent integration,
 * 2026-09-19) — the resolve-once path the owner Wayfinder (PR #387 §20)
 * names: current World/Project/subject → the register's REAL wiki reading
 * (wikiExpression.readWikiRegister — the owner's files seam plus the AIKit
 * knowledge relations op, one reading implementation shared with the M0
 * projection) → bounded local whole → ql.techne/v1 wire payload →
 * TechneDisclosureState (techneReading.ts) → DisclosureSession
 * (m0m5/reading.ts) → the active lens.
 *
 * Honest scope: this composes the disclosure from what the register's wiki
 * ground actually discloses. It is NOT the QL TechneAdapter — the QL-side
 * warrant/agency facets are absent because their owner has not supplied
 * them in this window (absent facets are data, not errors — the contract's
 * own law). The instruments' capability follows the reading: place is
 * disclosed unavailable with the real reason (the wiki reading carries no
 * spatial facets), never faked. When the QL adapter side registers its own
 * provider it is already registered first, and techneReadingProvider()
 * serves the first registration — this one stands as the cradle's ground
 * source.
 *
 * The Expression and Actions facets (added 2026-09-19 for the Journey save
 * lane): when the register's standing kernel document exists (the M0′
 * projection opened it), the reading binds that Expression —
 * `expressions[0]` with its ref and revision — and discloses the kernel's
 * own edit action `oi.expression.edit`, so Journey composes real scenes
 * INTO the register's Expression and the routed proposal reaches the
 * kernel's edit op. No document standing → both facets absent → the
 * Journey honestly refuses until the Web is entered.
 *
 * One reading, many consumers: this provider deliberately re-reads through
 * readWikiRegister rather than reading the projection store's standing,
 * because the store's standing phases drop the raw wiki reading once the
 * kernel document stands. The reading implementation is the same one
 * function, so no divergent parsing enters; the store keeps its own
 * projection law untouched.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and node --test.
 */
import type {KernelTransportStatus} from "../kernel/types";
import type {ExpressionDocument} from "../expression/types";
import {readWikiRegister, type WikiRegister, type WikiRegisterReading, type WikiRelationEdge} from "./wikiExpression";
import {getWikiProjectionState, subscribeWikiProjection, wikiDocumentOf} from "./wikiProjectionStore";
import {TECHNE_CONTRACT, type TechneReadingProvider, type TechneSubject} from "./techneReading";
import {useSyncExternalStore} from "react";

/** The reading's Expression facet source: the register's standing kernel
 * document (ready/drift phases) or the projection's own document
 * (projected/opening) — the SAME document the M0′ centre presents, never a
 * second read. */
export function wikiExpressionDocumentFor(registerKey: string): ExpressionDocument | undefined {
  const standing = getWikiProjectionState().standings[registerKey];
  return wikiDocumentOf(standing);
}

/** The Technē field's EFFECTIVE subject (parent integration, 2026-09-19):
 * the workspace's selected subject when one is selected, else the mode's own
 * ground — the current register's wiki local whole. This is the M0′ law the
 * owner wayfinder §14 names (the web IS the opening; no material is
 * required): the disclosure, the session and the HUD stand on the register's
 * whole even before the person selects anything. The subject is stable per
 * register, so standing on one register never re-reads; switching register
 * re-grounds (a new reading basis, lawfully). */
export function techneGroundSubject(selected: TechneSubject | undefined): TechneSubject {
  if (selected) return selected;
  const {registers, registerKey} = getWikiProjectionState();
  const register = registers.find(entry => entry.key === registerKey)
    ?? registers.find(entry => entry.key === "central")
    ?? registers[0];
  if (!register) return {ref: "wiki:central", kind: "wiki-register", title: "Central"};
  return {ref: `wiki:${register.key}`, kind: "wiki-register", title: register.title, project: register.project};
}

export function useTechneGroundSubject(selected: TechneSubject | undefined): TechneSubject {
  useSyncExternalStore(subscribeWikiProjection, getWikiProjectionState, getWikiProjectionState);
  return techneGroundSubject(selected);
}

/** Pick the register the subject's disclosure reads from: the subject's own
 * project when the register list knows it, else the projection's current
 * register, else Central, else the first register. */
export function wikiRegisterForSubject(subject: TechneSubject | undefined): WikiRegister | undefined {
  const {registers, registerKey} = getWikiProjectionState();
  const list = registers.length > 0 ? registers : [{key: "central", title: "Central"}];
  if (subject?.project) {
    const named = list.find(register => register.project === subject.project || register.key === subject.project || register.title === subject.title);
    if (named) return named;
  }
  return list.find(register => register.key === registerKey) ?? list.find(register => register.key === "central") ?? list[0];
}

/** One typed wiki edge as a contract relation: the source-owned semantic
 * relation stays the edge's own; the wiki document that disclosed it is the
 * source ref. Never a QL warrant, never an invented standing. */
function relationOf(edge: WikiRelationEdge, sourceRef: string) {
  return {
    relation: edge.relation,
    from_ref: edge.from,
    to_ref: edge.to,
    origin: edge.provider ?? "wiki",
    standing: edge.authority ?? null,
    source_ref: sourceRef,
  };
}

/** The disclosure for one register's wiki reading: every mounted lens is
 * available on the real whole except the ones whose facets the wiki reading
 * genuinely does not carry — those name the real reason. Timeline is
 * available exactly when the typed edges carry revisions (real temporal
 * basis); place has no spatial basis in a wiki reading. */
function disclosureFor(hasTemporalBasis: boolean, hasExpression: boolean) {
  return {
    instruments: [
      {instrument: "project", available: true, m_prime: 0, reading: "4:2-deep"},
      {instrument: "canvas", available: true, m_prime: 1, reading: "4:2-deep"},
      {instrument: "timeline", available: hasTemporalBasis, m_prime: 2, reading: "4:2-deep",
        ...(hasTemporalBasis ? {} : {reason: "the register's wiki reading carries no temporal facets"})},
      {instrument: "journey", available: hasExpression, m_prime: 3, reading: "4:2-deep",
        ...(hasExpression ? {} : {reason: "the register's Expression generation is not open in this window — enter its Web (M0′) first, and Journey composes into it"})},
      {instrument: "place", available: false, m_prime: 4, reading: "4:2-deep",
        reason: "the register's wiki reading carries no spatial facets"},
      {instrument: "palace", available: true, m_prime: 5, reading: "4:2-deep"},
    ],
    degraded: [],
    suggestions: [],
  };
}

/** The pure wire-payload builder: one register's real wiki reading + the
 * register's standing Expression document (when one stands) → one
 * ql.techne/v1 payload. Exported for the unit seam — the provider and the
 * TechneSource serve this exact payload. */
export function wikiReadingPayload(input: {
  register: WikiRegister;
  subject: TechneSubject;
  reading: WikiRegisterReading;
  document?: ExpressionDocument;
}): unknown {
  const {register, subject, reading, document} = input;
  const subjectRef = subject.ref?.trim() || `wiki:${register.key}`;
  const basis = reading.state === "ready" ? reading.wikiBasis : undefined;
  const wiki = reading.state === "ready" ? reading.wiki : undefined;
  const relations = reading.state === "ready" ? reading.relations : undefined;
  const sourceRef = basis ? `central:source:${basis.path}` : undefined;
  const wholeRef = relations?.state === "available" && relations.focusRef
    ? relations.focusRef
    : wiki?.spaces[0]?.ref ?? `wiki:${register.key}`;
  const memberRefs = (wiki?.nodes ?? []).map(node => node.ref).filter(value => typeof value === "string" && value.trim().length > 0);
  const edges = relations?.state === "available" ? relations.edges : [];
  const hasTemporalBasis = edges.some(edge => typeof edge.revision === "string" && edge.revision.length > 0);
  const hasExpression = !!document;
  return {
    contract: TECHNE_CONTRACT,
    reading_ref: `ql.techne:reading:wiki:${register.key}${basis?.revision ? `@${basis.revision}` : ""}`,
    snapshot: {revision: basis?.revision ?? null, ...(sourceRef ? {basis_ref: sourceRef} : {})},
    subject: {
      subject_ref: subjectRef,
      native_owner: "oi-cradle.wiki-reading/v1",
      kind: "wiki-register",
      native_revision: basis?.revision ?? null,
    },
    whole: {
      whole_ref: wholeRef,
      member_refs: memberRefs,
      relations: edges.map(edge => relationOf(edge, sourceRef ?? wholeRef)),
      focus_refs: [wholeRef],
    },
    ...(document ? {
      expressions: [{
        expression_ref: document.expression_ref,
        revision: String(document.revision),
        scene_ref: null,
      }],
      actions: [{
        action_ref: "oi.expression.edit",
        native_owner: "oi.cradle.kernel",
        authority: "the owner's own grammar (oi.expression/v1 edit through the kernel expression op)",
        summary: "Edit the register's bound Expression — create and focus scenes — through the kernel's expression op",
        expected_effects: [
          "scene_create applies a new named scene to the bound Expression document",
          "the edited document returns with its revision advanced; the projection store carries it",
        ],
      }],
    } : {}),
    disclosure: disclosureFor(hasTemporalBasis, hasExpression),
  };
}

/** The provider itself: one subject in, one ql.techne/v1 wire payload out. */
export function wikiTechneReadingProvider(transport: KernelTransportStatus): TechneReadingProvider {
  return {
    ref: "oi-cradle.wiki-reading/v1",
    async read(subject: TechneSubject): Promise<unknown> {
      if (transport.kind === "unavailable") throw new Error(transport.reason);
      const register = wikiRegisterForSubject(subject);
      if (!register) throw new Error("no wiki register is disclosed in this window");
      const reading = await readWikiRegister(transport, register);
      if (reading.state === "unavailable") throw new Error(reading.reason);
      return wikiReadingPayload({
        register,
        subject,
        reading,
        document: wikiExpressionDocumentFor(register.key),
      });
    },
  };
}
