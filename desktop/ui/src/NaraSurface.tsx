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

type Props = {
  onActionReceipt: (receipt: NaraActionReceipt) => Promise<void> | void;
};

export function NaraSurface({ onActionReceipt }: Props) {
  const [reading, setReading] = useState<NaraDailySurfaceReading | null>(null);
  const [body, setBody] = useState('');
  const [selection, setSelection] = useState<[number, number]>([0, 0]);
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
      await onActionReceipt(receipt);
      setMessage('Selection shared with the situated Epi context');
    } catch (error) {
      setMessage(String(error));
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
          <p className="oi-eyebrow">Epi / Pratibimba · M4′ Nara</p>
          <h1 className="nara-title">Today.</h1>
        </div>
        <div className="nara-orientation" aria-label="Current Epi orientation">
          <span>{context.dayId}</span>
          <span>{context.nowPath}</span>
          <span>{humanForm(context.conjugateFormCharacter)} · {context.harmonicRole}</span>
          <span>P{context.position} {context.helix} · {context.contextFrame ?? 'context frame not active'}</span>
        </div>
      </header>

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
    </section>
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
