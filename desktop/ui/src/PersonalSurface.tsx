import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { AgentEncounterSurface, WorkbenchEvidence, WorkbenchSemanticRef } from './workbench';
import './personal.css';

type PersonalApplication = {
  schema: 'epi.personal-450-application/v1';
  productId: 'epi.personal.450';
  nativeOwner: 'epi';
  subject: {
    subjectRef: string;
    episodeRef: string;
    episodeRevision: number;
    dayRef: string;
    dayId: string;
    nowPath: string;
    coordinateRef: string;
    qlAddress: string;
    profileRef: string;
    privacyClass: string;
    sourceClass: string;
    protectedBodyDisclosed: false;
  };
  activities: Array<{
    activityRef: string;
    label: string;
    kind: string;
    disposition: string[];
    readiness: string;
    subjectRef: string;
    surfaceRef?: string;
    canonicalAgentRef?: string;
    nativeActionRefs: string[];
    bodyRequirement: string;
    disclosureLaw: string[];
  }>;
  boundaries: Array<{
    domain: string;
    groundCoordinate: string;
    groundMeaning: string;
    groundRef: string;
    returnCoordinate: string;
    returnMeaning: string;
    returnRef: string;
    sourceAnchor: string;
    parentInnerLaw: string;
  }>;
  deepOpen: Array<{
    productId: string;
    coordinateRoot: string;
    subjectRef: string;
    selectionRef?: string;
    surfaceRef?: string;
    readiness: string;
    preservesSubjectIdentity: boolean;
    presentationOwnedByHost: boolean;
  }>;
  eventBinding: {
    subjectRef: string;
    eventRef?: string;
    bindableToEventRef: boolean;
    parallelPersonalEventState: boolean;
    law: string;
  };
  authority: {
    selectionIsAgentContextDisclosure: false;
    proposalIsAdoptedHumanSource: false;
    canonicalEpiiAgentRef: string;
    agentSessionOwner: string;
    knowledgeOwner: string;
    durableReturnOwner: string;
    protectedBodyProjection: string;
  };
  provenance: {
    epiSourceRevision: string;
    qlProviderRevision: string;
    semanticSources: string[];
    productScale: string;
  };
};

type NaraDaily = {
  schema: 'epi.nara-daily-surface/v1';
  episodeRef: string;
  episodeRevision: number;
  dayRef: string;
  privacyClass: string;
  sourceClass: string;
  body: string;
  livedContext: {
    dayId: string;
    nowPath: string;
    harmonicRole: string;
    conjugateFormCharacter: string;
    position: number;
    helix: string;
    qlAddress: string;
    coordinateRef: string;
    profileRef: string;
    contextFrame?: string;
  };
};

type NaraSelection = {
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

type SessionSpaceState = {
  definition: { id: string };
  agent_sessions: Record<string, { agent_session: string; purpose?: string; provenance: string[] }>;
};

type SessionSpaceReading = { state: SessionSpaceState };

type Props = {
  onSelect: (subject: WorkbenchSemanticRef, evidence: WorkbenchEvidence) => Promise<void>;
};

export function PersonalSurface({ onSelect }: Props) {
  const [application, setApplication] = useState<PersonalApplication | null>(null);
  const [daily, setDaily] = useState<NaraDaily | null>(null);
  const [body, setBody] = useState('');
  const [selection, setSelection] = useState<NaraSelection | null>(null);
  const [hasTextSelection, setHasTextSelection] = useState(false);
  const [message, setMessage] = useState('Opening protected Personal subject…');
  const [busy, setBusy] = useState(false);
  const [epiiAgentSession, setEpiiAgentSession] = useState<string | null>(null);
  const [encounterHost, setEncounterHost] = useState<Element | null>(null);
  const editor = useRef<HTMLTextAreaElement | null>(null);
  const saved = useRef('');
  const loaded = useRef(false);

  useEffect(() => {
    setEncounterHost(document.querySelector('.oi-shell__inspector'));
    void openPersonal();
    void discoverEpiiAgentSession();
  }, []);

  useEffect(() => {
    if (!loaded.current || body === saved.current || !body.trim()) return;
    const timer = window.setTimeout(() => void save(body), 650);
    return () => window.clearTimeout(timer);
  }, [body]);

  async function openPersonal() {
    setBusy(true);
    try {
      const [nextApplication, nextDaily] = await Promise.all([
        invoke<PersonalApplication | null>('personal_450_snapshot'),
        invoke<NaraDaily | null>('nara_daily_snapshot'),
      ]);
      if (!nextApplication || !nextDaily) throw new Error('No native Epi Personal 4/5/0 provider is configured.');
      if (
        nextApplication.subject.episodeRef !== nextDaily.episodeRef
        || nextApplication.subject.episodeRevision !== nextDaily.episodeRevision
      ) {
        throw new Error('Personal application subject drifted from the current Nara episode/revision.');
      }
      setApplication(nextApplication);
      setDaily(nextDaily);
      setBody(nextDaily.body);
      saved.current = nextDaily.body;
      loaded.current = true;
      setMessage(nextDaily.episodeRevision ? `Current episode r${nextDaily.episodeRevision}` : 'New day · ready to write');
      await onSelect(subjectRef(nextApplication), {
        title: 'Personal 4/5/0',
        summary: `${nextApplication.subject.dayId} · one protected subject · ${nextApplication.provenance.productScale}`,
        detail: bodyFreeApplication(nextApplication),
      });
      requestAnimationFrame(() => editor.current?.focus());
    } catch (error) {
      setMessage(messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  async function discoverEpiiAgentSession() {
    try {
      const spaces = await invoke<SessionSpaceState[]>('aikit_session_spaces');
      for (const space of spaces) {
        const reading = await invoke<SessionSpaceReading>('aikit_session_space_read', { sessionSpaceRef: space.definition.id });
        const candidate = Object.entries(reading.state.agent_sessions).find(([ref, relation]) => {
          const text = `${ref} ${relation.agent_session} ${relation.purpose ?? ''} ${relation.provenance.join(' ')}`.toLowerCase();
          return text.includes('epii') || text.includes('epi:agent:epii');
        });
        if (candidate) {
          setEpiiAgentSession(candidate[0]);
          return;
        }
      }
      setEpiiAgentSession(null);
    } catch {
      setEpiiAgentSession(null);
    }
  }

  async function save(nextBody = body) {
    if (!nextBody.trim()) return daily;
    setBusy(true);
    try {
      const next = await invoke<NaraDaily>('nara_save_daily', { body: nextBody });
      if (daily && next.episodeRef !== daily.episodeRef) throw new Error('Nara save changed protected episode identity.');
      setDaily(next);
      setBody(next.body);
      saved.current = next.body;
      setSelection(null);
      setHasTextSelection(false);
      setMessage(`Saved · episode r${next.episodeRevision}`);
      return next;
    } catch (error) {
      setMessage(messageFrom(error));
      return null;
    } finally {
      setBusy(false);
    }
  }

  function observeEditorSelection() {
    const source = editor.current;
    setHasTextSelection(Boolean(source && source.selectionStart !== source.selectionEnd));
  }

  async function governSelection() {
    const source = editor.current;
    if (!source || source.selectionStart === source.selectionEnd) return;
    const startUtf16 = source.selectionStart;
    const endUtf16 = source.selectionEnd;
    const current = body === saved.current ? daily : await save(body);
    if (!current) return;
    const startByte = utf8ByteOffset(body, startUtf16);
    const endByte = utf8ByteOffset(body, endUtf16);
    try {
      const selected = await invoke<NaraSelection>('nara_send_selection', {
        episodeRef: current.episodeRef,
        revision: current.episodeRevision,
        startByte,
        endByte,
      });
      if (
        selected.episodeRef !== current.episodeRef
        || selected.episodeRevision !== current.episodeRevision
        || selected.startByte !== startByte
        || selected.endByte !== endByte
      ) {
        throw new Error('Governed selection returned identity drift.');
      }
      setSelection(selected);
      setHasTextSelection(false);
      setMessage('Exact saved range is now the shared Personal subject child; Agent Context remains undisclosed.');
      await onSelect(selectionRef(selected), {
        title: 'Governed Personal selection',
        summary: `r${selected.episodeRevision} · bytes ${selected.startByte}–${selected.endByte} · selection ≠ Agent Context disclosure`,
        detail: {
          disclosureScope: selected.disclosureScope,
          coordinateRef: selected.coordinateRef,
          profileRef: selected.profileRef,
        },
      });
    } catch (error) {
      setMessage(messageFrom(error));
    }
  }

  async function review(mode: 'explain' | 'review') {
    if (!selection) return;
    setBusy(true);
    try {
      const reading = await invoke<Record<string, unknown>>('epi_personal_review', selectionArgs(selection, { mode }));
      await onSelect(selectionRef(selection), {
        title: mode === 'explain' ? 'Epii · Explain' : 'Epii · Review',
        summary: 'Epi-native bounded reading over the exact governed range; dialogue remains the canonical AgentSession.',
        detail: reading,
      });
      setMessage(`${mode === 'explain' ? 'Explain' : 'Review'} returned in Inspector without replacing the Nara canvas.`);
    } catch (error) {
      setMessage(messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  async function revealBimba() {
    if (!selection) return;
    setBusy(true);
    try {
      const ground = await invoke<Record<string, unknown>>('epi_personal_ground', selectionArgs(selection, { reviewRef: null }));
      const bimbaRef = nestedString(ground, ['bimba', 'semanticRef']);
      let sharedKnowledge: unknown = null;
      let sharedKnowledgeAbsence: string | null = null;
      if (bimbaRef) {
        try {
          const [reading, explanation] = await Promise.all([
            invoke('knowledge_read', { resourceRef: bimbaRef }),
            invoke('knowledge_explain', { resourceRef: bimbaRef }),
          ]);
          sharedKnowledge = { reading, explanation };
        } catch (error) {
          sharedKnowledgeAbsence = messageFrom(error);
        }
        await onSelect({
          ref: bimbaRef,
          kind: 'bimba-ref',
          native_owner: 'epi',
          provenance: { source: 'Epi native ground ref; shared Knowledge resolves presentation when available' },
        }, {
          title: 'Anuttara / Bimba',
          summary: sharedKnowledge
            ? 'Native Epi source ref resolved through shared Knowledge.'
            : 'Native Epi source ref retained; shared Knowledge provider is currently unavailable for this ref.',
          detail: { ground, sharedKnowledge, sharedKnowledgeAbsence },
        });
      }
      setMessage('Bimba/source reveal moved to the shared Knowledge/Inspector path; no Epi-local graph was opened.');
    } catch (error) {
      setMessage(messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  async function history() {
    if (!application) return;
    setBusy(true);
    try {
      const reading = await invoke<Record<string, unknown> | null>('central_now_snapshot');
      if (!reading) throw new Error('Central NOW/DAY is not configured.');
      await onSelect(subjectRef(application), {
        title: 'Central NOW / DAY',
        summary: 'Central-owned temporal return field; read-only from this Personal review path.',
        detail: reading,
      });
      setMessage('History returned in Inspector from Central NOW/DAY.');
    } catch (error) {
      setMessage(messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  async function propose() {
    if (!selection) return;
    setBusy(true);
    try {
      const result = await invoke<Record<string, unknown>>('epi_personal_proposal', selectionArgs(selection, {
        reviewRef: null,
        groundRef: null,
        proposedContent: selection.selectedText,
      }));
      await onSelect(selectionRef(selection), {
        title: 'Personal return proposal',
        summary: 'Proposal created from the exact selected wording. It is not adopted human source; Central receives refs/lineage only when configured.',
        detail: result,
      });
      setMessage('Proposal returned without mutating Nara or human-owned source.');
    } catch (error) {
      setMessage(messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  async function inspectDeep(productId: string) {
    const descriptor = application?.deepOpen.find((entry) => entry.productId === productId);
    if (!descriptor) return;
    await onSelect({
      ref: productId,
      kind: 'epi-deep-product',
      native_owner: 'epi',
      provenance: { source: 'epi.personal.450 deep-open descriptor' },
    }, {
      title: productId,
      summary: `${descriptor.coordinateRoot} · ${descriptor.readiness} · same Personal subject retained`,
      detail: descriptor,
    });
    setMessage(`${productId} descriptor is stable; C does not fabricate its deep renderer.`);
  }

  if (!application || !daily) {
    return (
      <section className="epi-personal" aria-label="Epi Personal 4/5/0">
        <p className="oi-eyebrow">Epi · epi.personal.450</p>
        <h2>Personal</h2>
        <p className="oi-muted">{message}</p>
        <button type="button" disabled={busy} onClick={() => void openPersonal()}>Re-read native Personal state</button>
      </section>
    );
  }

  return (
    <>
      <section className="epi-personal" aria-label="Epi Personal 4/5/0">
        <header className="epi-personal__header">
          <div>
            <p className="oi-eyebrow">Epi · epi.personal.450</p>
            <h2>{daily.livedContext.dayId}</h2>
            <p className="oi-muted">One governed Personal subject · {daily.episodeRef} · r{daily.episodeRevision}</p>
          </div>
          <div className="epi-personal__now" aria-label="DAY NOW current orientation">
            <strong>NOW</strong>
            <span>{daily.livedContext.nowPath}</span>
            <span>{daily.livedContext.coordinateRef}</span>
            <span>{humanForm(daily.livedContext.conjugateFormCharacter)} · {daily.livedContext.harmonicRole}</span>
          </div>
        </header>

        <textarea
          ref={editor}
          className="epi-personal__journal"
          aria-label="Personal journal"
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            setHasTextSelection(false);
          }}
          onSelect={observeEditorSelection}
          placeholder="Write here…"
          spellCheck
        />

        <div className="epi-personal__status">
          <span>{message}</span>
          <span>{daily.sourceClass} · {daily.privacyClass}</span>
        </div>

        <div className="epi-personal__actions" aria-label="Personal activities over the current subject">
          <button type="button" disabled={busy || !hasTextSelection} onClick={() => void governSelection()}>Use selected passage</button>
          <button type="button" disabled={busy || !selection} onClick={() => void review('explain')}>Explain</button>
          <button type="button" disabled={busy || !selection} onClick={() => void review('review')}>Review</button>
          <button type="button" disabled={busy || !selection} onClick={() => void revealBimba()}>Bimba / source</button>
          <button type="button" disabled={busy} onClick={() => void history()}>History</button>
          <button type="button" disabled={busy || !selection} onClick={() => void propose()}>Propose return</button>
        </div>

        <div className="epi-personal__contract">
          <div>
            <p className="oi-eyebrow">M5 · Epii</p>
            {epiiAgentSession
              ? <p>Canonical AgentSession found: <code>{epiiAgentSession}</code></p>
              : <p className="oi-muted">No current AgentSession identifies Epii. O:I will not substitute an arbitrary session.</p>}
          </div>
          <div>
            <p className="oi-eyebrow">Deep-open</p>
            <div className="epi-personal__deep">
              {application.deepOpen.map((descriptor) => (
                <button key={descriptor.productId} type="button" onClick={() => void inspectDeep(descriptor.productId)}>
                  {descriptor.productId}<small>{descriptor.readiness}</small>
                </button>
              ))}
            </div>
          </div>
        </div>

        <details className="epi-personal__boundaries">
          <summary>.0 / .5 boundaries and authority</summary>
          {application.boundaries.map((boundary) => (
            <div key={boundary.domain}>
              <strong>{boundary.domain}</strong>
              <p>{boundary.groundCoordinate} · {boundary.groundMeaning}</p>
              <p>{boundary.returnCoordinate} · {boundary.returnMeaning}</p>
              <small>{boundary.parentInnerLaw}</small>
            </div>
          ))}
          <pre>{JSON.stringify({ authority: application.authority, eventBinding: application.eventBinding }, null, 2)}</pre>
        </details>
      </section>
      {encounterHost && createPortal(
        <div className="epi-personal__agent-sidecar">
          <p className="oi-eyebrow">Epii · canonical AgentSession</p>
          <AgentEncounterSurface agentSessionRef={epiiAgentSession} onSelect={onSelect} />
        </div>,
        encounterHost,
      )}
    </>
  );
}

function subjectRef(application: PersonalApplication): WorkbenchSemanticRef {
  return {
    ref: application.subject.subjectRef,
    kind: 'nara-episode',
    native_owner: 'epi',
    provenance: { source: 'epi.personal.450', revision: `episode-r${application.subject.episodeRevision}` },
  };
}

function selectionRef(selection: NaraSelection): WorkbenchSemanticRef {
  return {
    ref: selection.selectionRef,
    kind: 'nara-selection',
    native_owner: 'epi',
    provenance: { source: 'epi.nara-selection/v1', revision: `episode-r${selection.episodeRevision}` },
  };
}

function selectionArgs(selection: NaraSelection, extra: Record<string, unknown>) {
  return {
    episodeRef: selection.episodeRef,
    revision: selection.episodeRevision,
    startByte: selection.startByte,
    endByte: selection.endByte,
    ...extra,
  };
}

function bodyFreeApplication(application: PersonalApplication) {
  return {
    productId: application.productId,
    subject: application.subject,
    activities: application.activities,
    boundaries: application.boundaries,
    deepOpen: application.deepOpen,
    eventBinding: application.eventBinding,
    authority: application.authority,
    provenance: application.provenance,
  };
}

function nestedString(value: Record<string, unknown>, path: string[]) {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : undefined;
}

function utf8ByteOffset(value: string, utf16Offset: number) {
  return new TextEncoder().encode(value.slice(0, utf16Offset)).length;
}

function humanForm(value: string) {
  return value === 'ShadowInversion' ? 'Shadow' : value;
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
