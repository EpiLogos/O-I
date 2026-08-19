import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './nara.css';

export type NaraDailySurfaceReading = {
  schema: 'epi.nara-daily-surface/v1';
  providerContract: 'epi.nara-daily-provider/v1';
  nativeOwner: 'epi';
  dayRef: string;
  episodeRef: string;
  episodeRevision: number;
  episodeType: 'daily-note';
  privacyClass: 'protected-local-body';
  sourceClass: string;
  body: string;
  livedContext: {
    dayId: string;
    nowPath: string;
    tick: number;
    tick12: number;
    harmonicRole: string;
    conjugateFormCharacter: string;
    position: number;
    helix: string;
    resonance72Index: number;
    qlAddress: string;
    lensRef: string;
    sublensRef: string;
    contextFrame?: string;
    coordinateRef: string;
    profileRef: string;
    vakStatus: string;
  };
  identityOrientation: string;
  explain: {
    sourceRevision: string;
    qlProviderRevision: string;
    providerContract: string;
    computation: string[];
    semanticSources: string[];
    readiness: string[];
  };
};

export type NaraActionReceipt = {
  schema: 'oi.epi-nara-action-receipt/v1';
  actionRef: string;
  subjectRef: string;
  authoritySubjectRef: string;
  grantRef: string;
  operationId: string;
  agentContextScope: string[];
  selection: {
    schema: 'epi.nara-selection/v1';
    episodeRef: string;
    selectionRef: string;
    episodeRevision: number;
    startByte: number;
    endByte: number;
    selectedText: string;
    dayId: string;
    nowPath: string;
    qlAddress: string;
    coordinateRef: string;
    profileRef: string;
    privacyClass: string;
    disclosureScope: string[];
  };
};

type PersonalDepthKind = 'explain' | 'review' | 'source' | 'bimba' | 'provenance' | 'proposal';

type PersonalDepthReceipt = {
  schema: 'oi.epi-personal-depth-receipt/v1';
  kind: PersonalDepthKind;
  actionRef: string;
  subjectRef: string;
  authoritySubjectRef: string;
  grantRef: string;
  operationId: string;
  reading: Record<string, unknown>;
  centralReturn?: Record<string, unknown>;
  centralNow?: Record<string, unknown>;
};

type Props = {
  onActionReceipt: (receipt: NaraActionReceipt) => Promise<void> | void;
};

export function NaraSurface({ onActionReceipt }: Props) {
  const [reading, setReading] = useState<NaraDailySurfaceReading | null>(null);
  const [body, setBody] = useState('');
  const [selection, setSelection] = useState<[number, number]>([0, 0]);
  const [actionReceipt, setActionReceipt] = useState<NaraActionReceipt | null>(null);
  const [depth, setDepth] = useState<PersonalDepthReceipt | null>(null);
  const [history, setHistory] = useState<Record<string, unknown> | null>(null);
  const [proposalDraft, setProposalDraft] = useState('');
  const [depthBusy, setDepthBusy] = useState(false);
  const [state, setState] = useState<'loading' | 'saved' | 'saving' | 'degraded'>('loading');
  const [message, setMessage] = useState('Opening protected Nara day…');
  const editor = useRef<HTMLTextAreaElement | null>(null);
  const lastSaved = useRef('');
  const loaded = useRef(false);

  useEffect(() => {
    invoke<NaraDailySurfaceReading | null>('nara_daily_snapshot')
      .then((next) => {
        if (!next) throw new Error('No Epi-owned Nara provider is configured.');
        setReading(next);
        setBody(next.body);
        lastSaved.current = next.body;
        loaded.current = true;
        setState('saved');
        setMessage(next.episodeRevision ? `Episode r${next.episodeRevision}` : 'New day · ready to write');
        requestAnimationFrame(() => editor.current?.focus());
      })
      .catch((error) => {
        setState('degraded');
        setMessage(String(error));
      });
  }, []);

  useEffect(() => {
    if (!loaded.current || body === lastSaved.current || !body.trim()) return;
    const timer = window.setTimeout(() => {
      void save(body);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [body]);

  async function save(nextBody = body) {
    if (!nextBody.trim()) return reading;
    setState('saving');
    setMessage('Saving locally…');
    try {
      const next = await invoke<NaraDailySurfaceReading>('nara_save_daily', { body: nextBody });
      setReading(next);
      setBody(next.body);
      lastSaved.current = next.body;
      setState('saved');
      setMessage(`Saved · episode r${next.episodeRevision}`);
      return next;
    } catch (error) {
      setState('degraded');
      setMessage(String(error));
      return null;
    }
  }

  async function sendSelection() {
    const source = editor.current;
    if (!source) return;
    const startUnit = source.selectionStart;
    const endUnit = source.selectionEnd;
    if (startUnit === endUnit) return;

    const current = body === lastSaved.current ? reading : await save(body);
    if (!current) return;
    const startByte = utf8ByteOffset(body, startUnit);
    const endByte = utf8ByteOffset(body, endUnit);
    const operationId = `nara-selection-${Date.now()}-${startByte}-${endByte}`;

    setMessage('Requesting governed selected-context disclosure…');
    try {
      const receipt = await invoke<NaraActionReceipt>('nara_send_selection', {
        episodeRef: current.episodeRef,
        revision: current.episodeRevision,
        startByte,
        endByte,
        operationId,
      });
      setActionReceipt(receipt);
      setDepth(null);
      setHistory(null);
      setProposalDraft(receipt.selection.selectedText);
      await onActionReceipt(receipt);
      setMessage('Selection shared with the situated Epi context');
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function summon(kind: PersonalDepthKind, proposedContent?: string) {
    if (!actionReceipt) return;
    setDepthBusy(true);
    setHistory(null);
    const selected = actionReceipt.selection;
    const currentReading = depth?.reading;
    const reviewRef = stringField(currentReading, 'reviewRef');
    const groundRef = stringField(currentReading, 'groundRef');
    try {
      const next = await invoke<PersonalDepthReceipt>('epi_personal_depth', {
        kind,
        episodeRef: selected.episodeRef,
        revision: selected.episodeRevision,
        startByte: selected.startByte,
        endByte: selected.endByte,
        operationId: `epi-personal-${kind}-${Date.now()}`,
        reviewRef,
        groundRef,
        proposedContent,
      });
      if (next.subjectRef !== selected.selectionRef || next.authoritySubjectRef !== selected.episodeRef) {
        throw new Error('Personal depth returned identity drift from the governed Nara selection.');
      }
      setDepth(next);
      setMessage(`${humanDepthName(kind)} opened around the same Nara selection`);
    } catch (error) {
      setMessage(String(error));
    } finally {
      setDepthBusy(false);
    }
  }

  async function openHistory() {
    if (!actionReceipt) return;
    setDepthBusy(true);
    try {
      const next = await invoke<Record<string, unknown> | null>('central_now_snapshot');
      if (!next) throw new Error('Central NOW is not configured for this O:I session.');
      setDepth(null);
      setHistory(next);
      setMessage('Central NOW history opened around the same Nara selection');
    } catch (error) {
      setMessage(String(error));
    } finally {
      setDepthBusy(false);
    }
  }

  async function rejectProposal() {
    if (!depth || depth.kind !== 'proposal') return;
    const proposalRef = stringField(depth.reading, 'proposalRef');
    const handoff = objectField(depth.centralReturn, 'handoff');
    const handoffId = stringField(handoff, 'id');
    if (!proposalRef || !handoffId) return;
    setDepthBusy(true);
    try {
      await invoke('reject_personal_proposal', { handoffId, proposalRef });
      setMessage('Proposal rejected · no personal source was adopted');
      setDepth(null);
    } catch (error) {
      setMessage(String(error));
    } finally {
      setDepthBusy(false);
    }
  }

  if (!reading) {
    return (
      <section className="nara-surface" aria-label="M4 prime Nara daily surface">
        <p className="oi-eyebrow">Epi / Pratibimba · M4′ Nara</p>
        <h1 className="nara-title">Today.</h1>
        <p className="nara-state" data-state={state}>{message}</p>
      </section>
    );
  }

  const { livedContext: context } = reading;
  const selected = selection[0] !== selection[1];
  return (
    <section className="nara-surface" aria-label="M4 prime Nara daily surface">
      <header className="nara-header">
        <div>
          <p className="oi-eyebrow">Epi / Pratibimba · {history ? 'Central NOW · read-only temporal return' : depth ? depthCoordinate(depth.kind) : 'M4′ Nara'}</p>
          <h1 className="nara-title">{history ? 'History' : depth ? humanDepthName(depth.kind) : 'Today.'}</h1>
        </div>
        <div className="nara-orientation" aria-label="Current Epi orientation">
          <span>{context.dayId}</span>
          <span>{context.nowPath}</span>
          <span>{humanForm(context.conjugateFormCharacter)} · {context.harmonicRole}</span>
          <span>P{context.position} {context.helix} · {context.contextFrame ?? 'context frame not active'}</span>
        </div>
      </header>

      {history && actionReceipt ? (
        <HistorySurface reading={history} selection={actionReceipt} onBack={() => setHistory(null)} />
      ) : depth && actionReceipt ? (
        <PersonalDepthSurface
          receipt={depth}
          selection={actionReceipt}
          proposalDraft={proposalDraft}
          setProposalDraft={setProposalDraft}
          busy={depthBusy}
          onBack={() => setDepth(null)}
          onSummon={(kind) => void summon(kind)}
          onHistory={() => void openHistory()}
          onCreateProposal={() => void summon('proposal', proposalDraft)}
          onReject={() => void rejectProposal()}
        />
      ) : (
        <>
          <textarea
            ref={editor}
            className="nara-editor"
            aria-label="Today’s Nara journal"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onSelect={(event) => {
              const target = event.currentTarget;
              setSelection([target.selectionStart, target.selectionEnd]);
            }}
            placeholder="Write here…"
            spellCheck
          />

          {actionReceipt && (
            <nav className="nara-summons" aria-label="Summon Epi depth around selected passage">
              <span>Same passage</span>
              <button type="button" disabled={depthBusy} onClick={() => void summon('explain')}>Explain</button>
              <button type="button" disabled={depthBusy} onClick={() => void summon('review')}>Review</button>
              <button type="button" disabled={depthBusy} onClick={() => void summon('source')}>Source</button>
              <button type="button" disabled={depthBusy} onClick={() => void summon('bimba')}>Bimba</button>
              <button type="button" disabled={depthBusy} onClick={() => void summon('provenance')}>Provenance</button>
              <button type="button" disabled={depthBusy} onClick={() => void summon('proposal')}>Proposal</button>
              <button type="button" disabled={depthBusy} onClick={() => void openHistory()}>History</button>
            </nav>
          )}

          <div className="nara-footer">
            <div className="nara-persistence">
              <span className="nara-state" data-state={state}>{message}</span>
              <span>{reading.identityOrientation}</span>
              <span>{reading.sourceClass} · {reading.privacyClass}</span>
            </div>
            <button type="button" className="nara-send" disabled={!selected} onClick={() => void sendSelection()}>
              Send selection to Epi
            </button>
          </div>

          <details className="nara-explain">
            <summary>Explain this reading</summary>
            <div className="nara-explain__grid">
              <div>
                <strong>Where / when</strong>
                <p>{context.coordinateRef}</p>
                <p>{context.qlAddress}</p>
                <p>{context.lensRef} · {context.sublensRef}</p>
              </div>
              <div>
                <strong>Shared profile</strong>
                <p>{context.profileRef}</p>
                <p>tick {context.tick} / {context.tick12} · resonance72 {context.resonance72Index}</p>
                <p>VĀK current state: {context.vakStatus}</p>
              </div>
              <div>
                <strong>Provenance</strong>
                <p>Epi {shortRevision(reading.explain.sourceRevision)}</p>
                <p>QL {shortRevision(reading.explain.qlProviderRevision)}</p>
                <p>{reading.explain.computation.join(' → ')}</p>
              </div>
              <div>
                <strong>Readiness</strong>
                <p>{reading.explain.readiness.join(' · ')}</p>
                <p>Private identity and full personal history are not part of this daily reading.</p>
              </div>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

function PersonalDepthSurface({
  receipt,
  selection,
  proposalDraft,
  setProposalDraft,
  busy,
  onBack,
  onSummon,
  onHistory,
  onCreateProposal,
  onReject,
}: {
  receipt: PersonalDepthReceipt;
  selection: NaraActionReceipt;
  proposalDraft: string;
  setProposalDraft: (value: string) => void;
  busy: boolean;
  onBack: () => void;
  onSummon: (kind: PersonalDepthKind) => void;
  onHistory: () => void;
  onCreateProposal: () => void;
  onReject: () => void;
}) {
  const reading = receipt.reading;
  const explanation = stringArray(reading, 'explanation');
  const questions = stringArray(reading, 'reviewQuestions');
  const reasons = stringArray(objectField(reading, 'relation'), 'reason');
  const anchors = stringArray(reading, 'sourceAnchors');
  const ql = stringArray(reading, 'qlOrientation');
  const proposalRef = stringField(reading, 'proposalRef');
  const adoptionState = stringField(reading, 'adoptionState');
  const sourceMutation = booleanField(reading, 'sourceMutationPerformed');
  const handoff = objectField(receipt.centralReturn, 'handoff');
  const handoffId = stringField(handoff, 'id');

  return (
    <article className="nara-depth" data-depth={receipt.kind}>
      <div className="nara-depth__subject">
        <button type="button" onClick={onBack}>← Nara</button>
        <blockquote>{selection.selection.selectedText}</blockquote>
        <small>
          same selection {selection.selection.selectionRef} · r{selection.selection.episodeRevision} · {selection.selection.startByte}–{selection.selection.endByte}
        </small>
      </div>

      {(receipt.kind === 'explain' || receipt.kind === 'review') && (
        <div className="nara-depth__body">
          {explanation.map((item) => <p key={item}>{item}</p>)}
          {questions.length > 0 && <><h3>Questions Epii keeps open</h3><ul>{questions.map((item) => <li key={item}>{item}</li>)}</ul></>}
          <details>
            <summary>Standing and provenance</summary>
            <pre>{pretty(objectField(reading, 'standing'))}</pre>
            <pre>{pretty(objectField(reading, 'provenance'))}</pre>
          </details>
        </div>
      )}

      {(receipt.kind === 'source' || receipt.kind === 'bimba' || receipt.kind === 'provenance') && (
        <div className="nara-depth__body">
          <h3>Why this ground</h3>
          <ul>{reasons.map((item) => <li key={item}>{item}</li>)}</ul>
          <dl className="nara-depth__refs">
            <dt>Bimba</dt><dd>{stringField(objectField(reading, 'bimba'), 'semanticRef') ?? 'unresolved'}</dd>
            <dt>Current locus</dt><dd>{stringField(objectField(reading, 'bimba'), 'currentLocusRef') ?? selection.selection.coordinateRef}</dd>
            <dt>Provider</dt><dd>{stringField(objectField(reading, 'bimba'), 'providerStatus') ?? 'not invoked'}</dd>
          </dl>
          <h3>Source anchors</h3>
          <ul>{anchors.map((item) => <li key={item}>{item}</li>)}</ul>
          <details><summary>Formal orientation</summary><ul>{ql.map((item) => <li key={item}>{item}</li>)}</ul></details>
        </div>
      )}

      {receipt.kind === 'proposal' && (
        <div className="nara-depth__body">
          <p>A proposal is a candidate return, not adopted personal source. Edit the candidate below; creating it may return only bounded refs to Central NOW when that owner is configured.</p>
          <textarea
            className="nara-proposal"
            aria-label="Personal return proposal"
            value={proposalDraft}
            onChange={(event) => setProposalDraft(event.target.value)}
          />
          <div className="nara-depth__actions">
            <button type="button" disabled={busy || !proposalDraft.trim()} onClick={onCreateProposal}>Create proposal</button>
            {proposalRef && handoffId && <button type="button" disabled={busy} onClick={onReject}>Reject / do not adopt</button>}
          </div>
          {proposalRef && (
            <dl className="nara-depth__refs">
              <dt>Proposal</dt><dd>{proposalRef}</dd>
              <dt>Adoption</dt><dd>{adoptionState ?? 'unreviewed'}</dd>
              <dt>Source mutation</dt><dd>{sourceMutation === false ? 'none' : 'unexpected'}</dd>
              <dt>Central NOW</dt><dd>{handoffId ? `handoff ${handoffId}` : 'not configured · proposal remains Epi-local reading'}</dd>
            </dl>
          )}
          <p className="oi-muted">Durable human return is deliberately separate: author/adopt the desired wording in human-owned Central NOW source, then use Central’s human-accepted promotion path. Epii cannot promote this generated proposal as if it were authored ground.</p>
        </div>
      )}

      <nav className="nara-summons nara-summons--depth" aria-label="Move through Personal depth">
        <button type="button" disabled={busy} onClick={() => onSummon('explain')}>Explain</button>
        <button type="button" disabled={busy} onClick={() => onSummon('review')}>Review</button>
        <button type="button" disabled={busy} onClick={() => onSummon('source')}>Source</button>
        <button type="button" disabled={busy} onClick={() => onSummon('bimba')}>Bimba</button>
        <button type="button" disabled={busy} onClick={() => onSummon('provenance')}>Provenance</button>
        <button type="button" disabled={busy} onClick={() => onSummon('proposal')}>Proposal</button>
        <button type="button" disabled={busy} onClick={onHistory}>History</button>
      </nav>
      <small className="nara-depth__receipt">{receipt.actionRef} · {receipt.subjectRef} · authority {receipt.authoritySubjectRef}</small>
    </article>
  );
}

function HistorySurface({ reading, selection, onBack }: { reading: Record<string, unknown>; selection: NaraActionReceipt; onBack: () => void }) {
  return (
    <article className="nara-depth" data-depth="history">
      <div className="nara-depth__subject">
        <button type="button" onClick={onBack}>← Nara</button>
        <blockquote>{selection.selection.selectedText}</blockquote>
        <small>same selection {selection.selection.selectionRef} · Central NOW is a temporal working field, not canon</small>
      </div>
      <div className="nara-depth__body">
        <p>History here is Central-owned NOW/DAY working context. It can show the current return field around this lived concern without rewriting Nara, Epi theory, or durable human source.</p>
        <details open>
          <summary>Current NOW reading</summary>
          <pre>{pretty(reading)}</pre>
        </details>
      </div>
    </article>
  );
}

function utf8ByteOffset(value: string, utf16Offset: number) {
  return new TextEncoder().encode(value.slice(0, utf16Offset)).length;
}

function humanForm(value: string) {
  if (value === 'ShadowInversion') return 'Shadow';
  return value;
}

function shortRevision(value: string) {
  return value.length > 12 ? value.slice(0, 12) : value;
}

function humanDepthName(kind: PersonalDepthKind) {
  if (kind === 'explain') return 'Epii · Explain';
  if (kind === 'review') return 'Epii · Review';
  if (kind === 'proposal') return 'Epii · Proposal';
  return kind === 'bimba' ? 'Anuttara · Bimba' : kind === 'source' ? 'Anuttara · Source' : 'Anuttara · Provenance';
}

function depthCoordinate(kind: PersonalDepthKind) {
  return kind === 'source' || kind === 'bimba' || kind === 'provenance' ? 'M0′ Anuttara / Bimba' : 'M5′ Epii';
}

function objectField(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = (value as Record<string, unknown>)[key];
  return candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : undefined;
}

function stringField(value: unknown, key: string) {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' ? candidate : undefined;
}

function booleanField(value: unknown, key: string) {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'boolean' ? candidate : undefined;
}

function stringArray(value: unknown, key: string) {
  if (!value || typeof value !== 'object') return [];
  const candidate = (value as Record<string, unknown>)[key];
  return Array.isArray(candidate) ? candidate.filter((item): item is string => typeof item === 'string') : [];
}

function pretty(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}
