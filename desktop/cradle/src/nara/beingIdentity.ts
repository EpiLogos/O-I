/** Identity and your sky (manual §24.6; T-WORLDS §6, W4): "You are a Being in your own world. Your Being page holds your identity by
 * reference, never as a copy … Each layer shows with its source, or as absent with the reason. Nothing fills a missing layer."
 *
 * A Being page's Subject (`bindings.subjectRef`, kernel/src/page.rs) is a person's ref. The identity it names is read through the
 * identity owner, `nara_identity` (kernel/src/nara_identity.rs): `list` finds the saved identity whose person it is, `open` reads it at
 * its revision, and `calculate` runs QL's natal calculation of exactly the profile opened (an open runs none). Its layers are the identity matrix's own rows (M4.0-0 … M4.0-5: birthdate, chart, Jungian, Gene Keys, Human Design,
 * quintessence), each present with its source or absent with QL's reason. The birth sky is the identity's own natal chart
 * (`ql.nara-natal/v1` `sky.bodies`): the shell computes no second chart, and the atlas's own natal engine is never used for a person.
 * Nothing here writes: the identity is the identity owner's, and a reading changes nothing. Pure apart from the two owner reads. */
import type {KernelTransportStatus} from "../kernel/types";
import {naraIdentity} from "./identity/client";
import {currentIdentity} from "./identity/current";
import type {IdentityReading, IdentitySource} from "./identity/types";

export interface IdentityLayer {
  readonly coordinate: string;
  readonly kind: string;
  readonly present: boolean;
  readonly source: {readonly source_ref: string; readonly revision: string} | null;
  readonly reason: string | null;
}

export interface NatalBody {readonly body: string; readonly longitude_degrees: number; readonly retrograde: boolean}

/** The identity a Being page names, as its owner read it. */
export interface BeingIdentity {
  readonly person_ref: string;
  readonly name: string | null;
  readonly source: IdentitySource;
  readonly layers: readonly IdentityLayer[];
  /** The birth sky, when the identity's natal chart carries one. */
  readonly natal: readonly NatalBody[] | null;
  /** Why there is no birth sky, when there is none. */
  readonly natalWhy: string | null;
}

export type BeingIdentityReading = {readonly ok: true; readonly identity: BeingIdentity} | {readonly ok: false; readonly reason: string};

const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null);

export const NOT_A_PERSON = "This page is about no person: its Subject names none, so it holds no identity.";
export const AN_AGENT = "This Being is an agent: an agent's card is read from your roster, and it has no birth sky.";

/** The person a Being page is about, by its Subject, or why it is about none. Pure. */
export function beingSubject(island: unknown): {readonly person_ref: string} | {readonly reason: string} {
  const page = record(island);
  if (page?.profile !== "oi.page/v1" || record(page.meta)?.family !== "beings") return {reason: "This page is no Being."};
  const bindings = record(page.bindings) ?? {};
  if (bindings.kind === "agent") return {reason: AN_AGENT};
  const subject = bindings.subjectRef;
  return typeof subject === "string" && subject.trim() ? {person_ref: subject.trim()} : {reason: NOT_A_PERSON};
}

/** The identity's layers as its matrix states them, in its own order. Pure. */
export function identityLayers(reading: IdentityReading): IdentityLayer[] {
  return reading.matrix.map(row => ({coordinate: row.coordinate, kind: row.kind, present: row.available,
    source: row.source ? {source_ref: row.source.source_ref, revision: row.source.revision} : null,
    reason: row.available ? null : row.absence_reason ?? "The identity owner gives no reason for this layer's absence."}));
}

/** The identity's birth sky, or why it has none: QL's own natal chart (`ql.nara-natal/v1`), never a chart computed here. Pure. */
export function natalOf(reading: IdentityReading): {bodies: NatalBody[]} | {reason: string} {
  const natal = reading.natal;
  if (!natal) return {reason: "Your identity carries no natal chart: its birth time or place is not given."};
  if (natal.status === "unavailable" || !natal.sky?.bodies?.length) return {reason: natal.reason ?? "Your identity's natal chart is unavailable."};
  return {bodies: natal.sky.bodies.map(body => ({body: body.body, longitude_degrees: body.longitude_degrees, retrograde: body.retrograde === true}))};
}

/** The birth sky of an identity opened at its revision. The owner's `open` reads the saved profile through QL's inspection, which runs
 * no natal calculation (its chart layer stands absent, "Natal calculation has not run for this input"; read on a scratch root, 28 Oct),
 * so the chart is QL's `calculate` of exactly that profile: a calculation of another input is not this identity's chart. */
async function calculatedNatal(transport: KernelTransportStatus, opened: IdentityReading): Promise<{reading: IdentityReading; natal: ReturnType<typeof natalOf>}> {
  const calculated = await naraIdentity(transport, {operation: "calculate", profile: opened.profile});
  const reading = calculated.reading;
  if (!reading || reading.input_revision !== opened.input_revision || reading.person_ref !== opened.person_ref) {
    return {reading: opened, natal: {reason: "The identity owner calculated another profile, not this identity's: its birth sky is not shown."}};
  }
  return {reading, natal: natalOf(reading)};
}

/** The saved identity of one person, at its revision: the one chosen, when it is theirs, else the one the identity owner lists for them.
 * Two saved identities naming one person are refused rather than chosen between. */
export async function readPersonIdentity(transport: KernelTransportStatus, person_ref: string): Promise<BeingIdentityReading> {
  const chosen = currentIdentity();
  let source: IdentitySource | null = chosen && chosen.reading.person_ref === person_ref ? chosen.source : null;
  if (!source) {
    const listed = await naraIdentity(transport, {operation: "list"});
    const theirs = (listed.profiles ?? []).filter(profile => profile.person_ref === person_ref);
    if (!theirs.length) return {ok: false, reason: `No saved identity names ${person_ref}: their identity is not shared with you.`};
    if (theirs.length > 1) return {ok: false, reason: `${theirs.length} saved identities name ${person_ref}: choose the one that is theirs in the Nara instrument.`};
    source = {source_ref: theirs[0]!.source_ref, revision: theirs[0]!.revision};
  }
  const opened = await naraIdentity(transport, {operation: "open", source_ref: source.source_ref});
  if (!opened.reading || !opened.source) return {ok: false, reason: opened.error ?? "The identity owner opened no reading of this identity."};
  if (opened.reading.person_ref !== person_ref) return {ok: false, reason: "The identity owner answered for another person."};
  const {reading, natal} = await calculatedNatal(transport, opened.reading);
  return {ok: true, identity: {person_ref, name: opened.reading.profile?.name ?? null, source: opened.source, layers: identityLayers(reading),
    natal: "bodies" in natal ? natal.bodies : null, natalWhy: "reason" in natal ? natal.reason : null}};
}

/** Your saved identity (manual §24.6 "Your birth is the first layer, and Setup asks for your date of birth as soon as your ground is made"):
 * the one you chose in the Nara instrument, else the one identity your ground keeps. Two or more, none chosen, are not guessed between;
 * none saved says so. Reads the identity owner's listing only. */
export async function yourIdentitySource(transport: KernelTransportStatus): Promise<{ok: true; person_ref: string; name: string | null; source: IdentitySource} | {ok: false; reason: string}> {
  const chosen = currentIdentity();
  if (chosen) return {ok: true, person_ref: chosen.reading.person_ref, name: chosen.reading.profile?.name ?? null, source: {source_ref: chosen.source.source_ref, revision: chosen.source.revision}};
  const listed = (await naraIdentity(transport, {operation: "list"})).profiles ?? [];
  if (!listed.length) return {ok: false, reason: "No identity is saved yet: Setup asks for your date of birth, or give it in the identity of the Studio's Nara chain."};
  if (listed.length > 1) return {ok: false, reason: `${listed.length} identities are saved and none is chosen: choose yours in the Nara instrument.`};
  const [yours] = listed;
  return {ok: true, person_ref: yours!.person_ref, name: yours!.name ?? null, source: {source_ref: yours!.source_ref, revision: yours!.revision}};
}

/** Your saved identity's natal chart, whole (manual §24.6 "Your natal sky comes from your identity. The shell does not compute a second
 * chart"): your identity (yourIdentitySource) opened at its revision, and QL's calculation of exactly that profile (calculatedNatal), its
 * `ql.nara-natal/v1` as QL returned it with the profile it was calculated from; or why there is none, in the owner's words. Reads only. */
export async function readYourNatal(transport: KernelTransportStatus): Promise<{ok: true; person_ref: string; name: string | null; source: IdentitySource;
  profile: IdentityReading["profile"]; natal: NonNullable<IdentityReading["natal"]>} | {ok: false; reason: string}> {
  const you = await yourIdentitySource(transport);
  if (!you.ok) return you;
  const opened = await naraIdentity(transport, {operation: "open", source_ref: you.source.source_ref});
  if (!opened.reading || !opened.source) return {ok: false, reason: opened.error ?? "The identity owner opened no reading of your identity."};
  if (opened.reading.person_ref !== you.person_ref) return {ok: false, reason: "The identity owner answered for another person."};
  const {reading, natal} = await calculatedNatal(transport, opened.reading);
  if ("reason" in natal) return {ok: false, reason: natal.reason};
  return {ok: true, person_ref: you.person_ref, name: opened.reading.profile?.name ?? you.name, source: opened.source, profile: reading.profile, natal: reading.natal!};
}

/** The identity a Being page holds by reference, or why it holds none. */
export async function readBeingIdentity(transport: KernelTransportStatus, island: unknown): Promise<BeingIdentityReading> {
  const subject = beingSubject(island);
  if ("reason" in subject) return {ok: false, reason: subject.reason};
  return readPersonIdentity(transport, subject.person_ref);
}

/** The layers in words, for a page's ties: each present with its source, or absent with its reason. Pure. */
export function layersInWords(layers: readonly IdentityLayer[]): string[] {
  return layers.map(layer => `${layer.coordinate} ${layer.kind}: ${layer.present ? `from ${layer.source ? `${layer.source.source_ref} @ ${layer.source.revision}` : "the identity itself"}` : `absent (${layer.reason})`}`);
}
