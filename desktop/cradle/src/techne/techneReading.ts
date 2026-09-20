/**
 * The ql.techne/v1 disclosure binding — the Technè instrument tab bar's
 * capability source.
 *
 * Contract source: QL-MEF `main` @ dbff5cc, `schemas/techne/
 * ql-techne-reading-v1.schema.json` (`ql.techne/reading/v1`, the language
 * binding in `crates/ql-adapters/src/techne.rs`). Only the part this tree
 * consumes is typed here: the contract tag, the reading ref, the subject and
 * the CAPABILITY DISCLOSURE (instruments with availability and stated
 * reasons, degradations, suggestions). The reading's own facets — whole, QL
 * warrant, temporal, spatial, provenance, Expressions, Actions — stay with
 * their owner; nothing here re-reads or reconstructs them.
 *
 * The native join: a QL TechneAdapter side registers ONE reading provider
 * (`registerTechneReadingProvider`) and the tab bar reads through it. With no
 * provider registered, the honest state is "QL reading unavailable" with that
 * exact reason — never a simulated reading. The subject the reading is
 * requested for is the arrangement's selected subject; passing it from the
 * workspace world context is a frame-side join this surface does not yet have.
 */
import {useEffect, useState} from "react";

export const TECHNE_CONTRACT = "ql.techne/v1";

/** The disclosure vocabulary's instrument ids (schema `$defs.Instrument`):
 * the six 4:2 deep instruments bind M0′–M5′; `expressions` is the conjugate
 * 3:3 Expression reading, not a deep instrument. */
export const TECHNE_INSTRUMENT_IDS = ["project", "canvas", "timeline", "journey", "place", "palace", "expressions"] as const;
export type TechneInstrumentId = typeof TECHNE_INSTRUMENT_IDS[number];
export const isTechneInstrumentId = (value: unknown): value is TechneInstrumentId => TECHNE_INSTRUMENT_IDS.includes(value as TechneInstrumentId);

/** Which reading of the one M′ field an aperture carries. */
export type TechneReadingKind = "4:2-deep" | "3:3-conjugate";

/** The subject a reading is over, in its native identity. */
export interface TechneSubject {
  ref?: string;
  kind?: string;
  title: string;
  project?: string;
}

/** Capability honesty for one instrument: availability with an explicit
 * reason whenever it is unavailable (the schema requires one). */
export interface InstrumentDisclosure {
  instrument: TechneInstrumentId;
  available: boolean;
  reason?: string;
  /** The M′ office this instrument is the Technè face of (0–5). */
  mPrime?: number;
  reading?: TechneReadingKind;
}

export interface DegradedDisclosure { instrument: TechneInstrumentId; reason: string }
export interface DisclosureSuggestion { instrument: TechneInstrumentId; reason: string }

export interface TechneDisclosure {
  instruments: InstrumentDisclosure[];
  degraded: DegradedDisclosure[];
  suggestions: DisclosureSuggestion[];
}

/** The disclosure subset of one portable reading. */
export interface TechneReading {
  contract: typeof TECHNE_CONTRACT;
  readingRef: string;
  revision?: string;
  subject: {subjectRef: string; nativeOwner: string; kind?: string};
  disclosure: TechneDisclosure;
}

const text = (value: unknown): string | undefined => typeof value === "string" && value.length > 0 ? value : undefined;

/** Decode a payload as the ql.techne/v1 disclosure subset. A payload that
 * does not hold the contract — wrong tag, missing required parts, an
 * unavailable instrument without its stated reason — is refused whole, never
 * guessed into (law 7). */
export function parseTechneReading(value: unknown): TechneReading | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.contract !== TECHNE_CONTRACT) return null;
  const readingRef = text(raw.reading_ref);
  if (!readingRef) return null;
  const subjectRaw = raw.subject as Record<string, unknown> | undefined;
  const subjectRef = text(subjectRaw?.subject_ref), nativeOwner = text(subjectRaw?.native_owner);
  if (!subjectRef || !nativeOwner) return null;
  const disclosureRaw = raw.disclosure as Record<string, unknown> | undefined;
  if (!disclosureRaw || !Array.isArray(disclosureRaw.instruments)) return null;
  const instruments: InstrumentDisclosure[] = [];
  for (const entry of disclosureRaw.instruments) {
    if (!entry || typeof entry !== "object") return null;
    const item = entry as Record<string, unknown>;
    if (!isTechneInstrumentId(item.instrument) || typeof item.available !== "boolean") return null;
    const reason = text(item.reason);
    if (!item.available && !reason) return null; // the schema's unavailable-reason law
    if (item.m_prime !== undefined && (typeof item.m_prime !== "number" || !Number.isInteger(item.m_prime) || item.m_prime < 0 || item.m_prime > 5)) return null;
    if (item.reading !== undefined && item.reading !== "4:2-deep" && item.reading !== "3:3-conjugate") return null;
    instruments.push({instrument: item.instrument, available: item.available, reason, mPrime: item.m_prime, reading: item.reading});
  }
  const pairs = (value: unknown): {instrument: TechneInstrumentId; reason: string}[] => Array.isArray(value) ? value.flatMap((entry): {instrument: TechneInstrumentId; reason: string}[] => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const reason = text(item.reason);
    return isTechneInstrumentId(item.instrument) && reason ? [{instrument: item.instrument, reason}] : [];
  }) : [];
  const snapshotRaw = raw.snapshot as Record<string, unknown> | undefined;
  return {
    contract: TECHNE_CONTRACT,
    readingRef,
    revision: text(snapshotRaw?.revision),
    subject: {subjectRef, nativeOwner, kind: text(subjectRaw?.kind)},
    disclosure: {instruments, degraded: pairs(disclosureRaw.degraded), suggestions: pairs(disclosureRaw.suggestions)},
  };
}

/** The provider seam: a registered QL side reads the selected subject's
 * disclosure through its own owner. Mirrors the focused-instrument source
 * registry (instrument/source.ts): registration is the join, never a build
 * toggle, and a refusal travels verbatim. `read` returns the WIRE payload —
 * `parseTechneReading` above is the only door into the typed reading. */
export interface TechneReadingProvider {
  ref: string;
  read(subject: TechneSubject): Promise<unknown>;
}

const providers = new Map<string, TechneReadingProvider>();
const registryListeners = new Set<() => void>();
function announceRegistry() { for (const listener of [...registryListeners]) listener(); }

export function registerTechneReadingProvider(provider: TechneReadingProvider): () => void {
  if (!provider.ref.trim()) throw new Error("Techne reading provider needs a stable ref");
  if (providers.has(provider.ref)) throw new Error(`Techne reading provider ${provider.ref} is already registered`);
  providers.set(provider.ref, provider);
  announceRegistry();
  return () => { if (providers.get(provider.ref) === provider) { providers.delete(provider.ref); announceRegistry(); } };
}
export function techneReadingProvider(): TechneReadingProvider | undefined { return providers.values().next().value; }
export function subscribeTechneReadingProviders(listener: () => void): () => void { registryListeners.add(listener); return () => { registryListeners.delete(listener); }; }

/** Re-run the standing disclosure read (additive, 2026-09-19): the reading
 * basis grew a facet the first read could not carry — the register's
 * Expression generation opened after the surface mounted, or its revision
 * advanced. Announcing the registry re-runs every useTechneDisclosure
 * effect once; the read is the same resolve-once path, now over the fuller
 * ground. */
export function refreshTechneDisclosure(): void {
  announceRegistry();
}

export const NO_PROVIDER_REASON = "no ql.techne/v1 reading source is registered in this window";

/** What the tab bar stands on for one subject. `raw` (added additively for
 * the T3 instrument bridge, 2026-09-19) carries the provider's WIRE payload
 * verbatim so the m0m5 lens bridge can compose the FULL ql.techne/v1 reading
 * (whole, temporal, spatial, expressions, actions, …) from what the read
 * already returned — never a second provider fetch. It is untyped here; the
 * bridge contract-checks it through `validateReading` before any use. */
export type TechneDisclosureState =
  | {standing: "no-subject"}
  | {standing: "reading"}
  | {standing: "read"; reading: TechneReading; raw?: unknown}
  | {standing: "unavailable"; reason: string};

/** Read the selected subject's disclosure through the registered provider.
 * No subject → the honest no-subject state; no provider → the honest
 * unavailable state with the stated reason. A refused or unparsable read
 * keeps the owner's reason verbatim, never a partial reading. */
export function useTechneDisclosure(subject: TechneSubject | undefined): TechneDisclosureState {
  const [registry, setRegistry] = useState(0);
  useEffect(() => {
    const bump = () => setRegistry(value => value + 1);
    bump();
    return subscribeTechneReadingProviders(bump);
  }, []);
  const identity = subject ? `${subject.ref ?? ""}\n${subject.kind ?? ""}\n${subject.title}\n${subject.project ?? ""}` : "";
  const [state, setState] = useState<TechneDisclosureState>(subject ? {standing: "reading"} : {standing: "no-subject"});
  useEffect(() => {
    if (!subject) { setState({standing: "no-subject"}); return; }
    const provider = techneReadingProvider();
    if (!provider) { setState({standing: "unavailable", reason: NO_PROVIDER_REASON}); return; }
    let live = true;
    // Stale-while-revalidate (additive, 2026-09-19): a registry-driven
    // re-read of the SAME subject (refreshTechneDisclosure — the register's
    // Expression generation opened or advanced) keeps the standing reading
    // visible while it flies; downgrading to "reading" would unmount the
    // mounted lens mid-work and reset the person's entry state. Only a
    // subject change downgrades to the honest loading state.
    setState(current => {
      const sameSubject = current.standing === "read" && current.reading.subject.subjectRef === (subject.ref?.trim() || subject.title);
      return sameSubject ? current : {standing: "reading"};
    });
    void provider.read(subject).then(
      payload => {
        if (!live) return;
        const parsed = parseTechneReading(payload);
        setState(parsed ? {standing: "read", reading: parsed, raw: payload} : {standing: "unavailable", reason: `the reading returned by ${provider.ref} did not parse as ${TECHNE_CONTRACT}`});
      },
      cause => { if (live) setState({standing: "unavailable", reason: cause instanceof Error ? cause.message : String(cause)}); },
    );
    return () => { live = false; };
    // The joined identity is the dependency: the same subject by value must
    // not re-read, and the registry generation re-runs the effect when
    // providers change or a refresh is asked for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, registry]);
  return state;
}

/** One instrument's standing under a disclosure state — the tab and its body
 * render from this, with the owner's reasons carried verbatim. */
export interface InstrumentStanding {
  /** `false` only when a reading disclosed this instrument unavailable. */
  available: boolean;
  reason?: string;
  /** The degraded[] reasons naming this instrument, verbatim. */
  degraded: string[];
  /** True when a reading is present and lists this instrument. */
  disclosed: boolean;
}

export function instrumentStanding(disclosure: TechneDisclosureState, instrument: TechneInstrumentId): InstrumentStanding {
  if (disclosure.standing !== "read") return {available: true, degraded: [], disclosed: false};
  const entry = disclosure.reading.disclosure.instruments.find(item => item.instrument === instrument);
  return {
    available: entry ? entry.available : true,
    reason: entry?.reason,
    degraded: disclosure.reading.disclosure.degraded.filter(item => item.instrument === instrument).map(item => item.reason),
    disclosed: !!entry,
  };
}
