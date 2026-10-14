// lane-3 E21: where a subject stands in the wiki projections, read by the owner that carries the wiki.
// The frame asks the host through one typed channel request (`wiki-subject-standing`, matched by `req`).
// The host answers from its one projection state (wikiSubjectStandings); this module never computes a
// standing. A reply that answers a basis the frame no longer holds (another Expression, another revision,
// another subject) is dropped. A refusal is named, never shown as an empty standing.
// Pure apart from the injected post, timers and the settle callback, so the node suite exercises it directly.

export const WIKI_STANDING_KIND = 'wiki-subject-standing';
const VERSION = 1;
const TEXT_LIMIT = 4096;
const REF_LIMIT = 512;
const ROW_LIMIT = 512;
const TIMEOUT_MS = 15000;
const REQ_BASE = 2_000_000;

/** The frame's basis: the subject it stands on, and the open native Expression at one revision. */
export interface WikiStandingBasis {
  subject_ref: string;
  expression_ref: string;
  revision: number;
}

export interface WikiStandingRow {
  kind: 'projection';
  title: string;
  detail: string;
  register_key: string;
  scene_ref: string;
  entity_ref: string;
  subject_ref: string;
}

export type WikiStandingState =
  | {state: 'pending'}
  | {state: 'read'; rows: WikiStandingRow[]}
  | {state: 'refused'; reason: string};

const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const control = /[\u0000-\u001f\u007f]/;
const boundedText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max && !control.test(value);

/** A basis the frame may ask about: bounded refs and an exact positive revision. */
export function validWikiStandingBasis(basis: WikiStandingBasis): boolean {
  return boundedText(basis.subject_ref, REF_LIMIT) && boundedText(basis.expression_ref, REF_LIMIT)
    && Number.isSafeInteger(basis.revision) && basis.revision >= 1;
}

export function wikiStandingKey(basis: WikiStandingBasis): string {
  return JSON.stringify([basis.subject_ref, basis.expression_ref, basis.revision]);
}

/** Read one reply's data. Any malformed row refuses the whole reply: a partial standing is never shown. */
export function readWikiStandingData(
  data: unknown,
  basis: WikiStandingBasis,
): {ok: 'read'; rows: WikiStandingRow[]} | {ok: 'refused'; reason: string} | {ok: 'stale'} {
  if (!plain(data)) return {ok: 'refused', reason: 'The host sent a wiki standing that cannot be read.'};
  if (data.subject_ref !== basis.subject_ref || data.expression_ref !== basis.expression_ref || data.revision !== basis.revision) return {ok: 'stale'};
  if (!Array.isArray(data.rows) || data.rows.length > ROW_LIMIT) return {ok: 'refused', reason: 'The host sent a wiki standing with no readable rows.'};
  const rows: WikiStandingRow[] = [];
  for (const row of data.rows) {
    if (!plain(row) || !boundedText(row.register_key, REF_LIMIT) || !boundedText(row.scene_ref, REF_LIMIT)
      || !boundedText(row.entity_ref, REF_LIMIT) || row.subject_ref !== basis.subject_ref
      || !boundedText(row.scene_title, TEXT_LIMIT) || !boundedText(row.entity_title, TEXT_LIMIT)) {
      return {ok: 'refused', reason: 'The host sent a wiki standing row that cannot be read; no standing is shown.'};
    }
    rows.push({
      kind: 'projection',
      title: `${row.entity_title} · ${row.scene_title}`,
      detail: `Wiki register ${row.register_key}`,
      register_key: row.register_key,
      scene_ref: row.scene_ref,
      entity_ref: row.entity_ref,
      subject_ref: basis.subject_ref,
    });
  }
  return {ok: 'read', rows};
}

export interface WikiStandingClientOptions {
  /** Posts to the host. False when nothing is hosted, so the request is refused by name rather than left pending. */
  post(message: Record<string, unknown>): boolean;
  /** The basis the frame holds now. A reply for any other basis is dropped. */
  current(): WikiStandingBasis | null;
  /** Called when a state settles, so the Library redraws and a refusal can be named. */
  settle(settled: {basis: WikiStandingBasis; state: WikiStandingState}): void;
  setTimer?(callback: () => void, ms: number): unknown;
  clearTimer?(handle: unknown): void;
}

export interface WikiStandingClient {
  /** The standing for a basis: a cached settle, or a pending state with one request in flight. */
  ensure(basis: WikiStandingBasis): WikiStandingState;
  /** Takes a message from the host. True when it was this channel's reply (matched or stale), false otherwise. */
  receive(message: unknown): boolean;
  dispose(): void;
}

export function createWikiStandingClient(options: WikiStandingClientOptions): WikiStandingClient {
  const states = new Map<string, WikiStandingState>();
  const pending = new Map<number, {key: string; basis: WikiStandingBasis; timer: unknown}>();
  const setTimer = options.setTimer ?? ((callback: () => void, ms: number) => setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let seq = REQ_BASE;

  const settle = (key: string, basis: WikiStandingBasis, state: WikiStandingState) => {
    states.set(key, state);
    options.settle({basis, state});
  };

  return {
    ensure(basis) {
      const key = wikiStandingKey(basis);
      const known = states.get(key);
      if (known) return known;
      if (!validWikiStandingBasis(basis)) {
        const refused: WikiStandingState = {state: 'refused', reason: 'This subject has no exact Expression revision to read its wiki standing against.'};
        states.set(key, refused);
        return refused;
      }
      const req = ++seq;
      const timer = setTimer(() => {
        if (pending.delete(req)) settle(key, basis, {state: 'refused', reason: 'The host did not answer the wiki standing request; reopen the Library to ask again.'});
      }, TIMEOUT_MS);
      pending.set(req, {key, basis, timer});
      states.set(key, {state: 'pending'});
      const posted = options.post({
        v: VERSION,
        kind: WIKI_STANDING_KIND,
        req,
        request: {subject_ref: basis.subject_ref, expression_ref: basis.expression_ref, revision: basis.revision},
      });
      if (!posted) {
        pending.delete(req);
        clearTimer(timer);
        const refused: WikiStandingState = {state: 'refused', reason: 'This shell is not hosted, so the wiki standing of this subject is not read.'};
        states.set(key, refused);
        return refused;
      }
      return {state: 'pending'};
    },
    receive(message) {
      if (!plain(message) || message.v !== VERSION || message.kind !== `${WIKI_STANDING_KIND}-result` || typeof message.req !== 'number') return false;
      const entry = pending.get(message.req);
      if (!entry) return false;
      pending.delete(message.req);
      clearTimer(entry.timer);
      const current = options.current();
      if (!current || wikiStandingKey(current) !== entry.key) {
        // A stale answer: another Expression, revision or subject now stands. It is dropped; nothing is cached for it.
        states.delete(entry.key);
        return true;
      }
      if (message.ok !== true) {
        const error = typeof message.error === 'string' && boundedText(message.error, TEXT_LIMIT) ? message.error : 'The host refused the wiki standing request.';
        settle(entry.key, entry.basis, {state: 'refused', reason: error});
        return true;
      }
      const read = readWikiStandingData(message.data, entry.basis);
      if (read.ok === 'stale') {
        states.delete(entry.key);
        return true;
      }
      if (read.ok === 'refused') settle(entry.key, entry.basis, {state: 'refused', reason: read.reason});
      else settle(entry.key, entry.basis, {state: 'read', rows: read.rows});
      return true;
    },
    dispose() {
      for (const entry of pending.values()) clearTimer(entry.timer);
      pending.clear();
      states.clear();
    },
  };
}

/** The native owner a subject is disclosed under: read from the occurrence that carries it, never guessed. A subject
 * the selected occurrence does not disclose, or discloses with no usable owner, is refused by name (never defaulted to 'wiki'). */
export function disclosedOwnerOf(
  subject: {subject_ref?: unknown; native_owner?: unknown} | null | undefined,
  subjectRef: string,
): {owner: string} | {refused: string} {
  if (!subject || subject.subject_ref !== subjectRef) {
    return {refused: 'The open Scene does not disclose this subject, so its native owner is not known. Select its occurrence and try again.'};
  }
  const owner = subject.native_owner;
  if (typeof owner !== 'string' || !owner.trim() || control.test(owner) || owner.length > REF_LIMIT) {
    return {refused: 'This subject is disclosed without a native owner, so the graph cannot show it. No owner is guessed.'};
  }
  return {owner};
}
