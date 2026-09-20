// The T3 lens probe page (test-only aperture) — the six M′ lenses mounted
// through the REAL parent seam (lensMount.ts) with the REAL disclosure hook
// (useTechneDisclosure) over a counting fixture provider, plus a Studio
// recorder that renders the parked nodes for the probe to inspect.
import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {
  registerTechneLens,
  techneLenses,
  type TechneLens,
  type TechneLensBodyProps,
  type TechneLensStudio,
} from '../src/techne/lensMount';
import {registerTechneReadingProvider, useTechneDisclosure, type TechneDisclosureState, type TechneSubject} from '../src/techne/techneReading';
import {KernelProvider} from '../src/kernel/KernelProvider';
import {VisualsProvider} from '../src/visuals/ParticleExpression';
import {ExpressionStageProvider} from '../src/stage/ExpressionStage';
import {disclosureSession} from '../src/techne/session';
// The one side-effect registration the surface will import.
import '../src/techne/instrumentLenses';
import '@epilogos/oi-design-system/tokens.css';

// The full contract reading the fixture provider serves (same shape the
// node probe asserts against).
const READING = {
  contract: 'ql.techne/v1',
  reading_ref: 'ql.techne:reading:probe',
  snapshot: {revision: 'rev-1', basis_ref: null},
  subject: {subject_ref: 'wiki:node:alpha', native_owner: 'aikit', kind: 'wiki-node'},
  whole: {
    whole_ref: 'wiki:constellation:alpha',
    member_refs: ['wiki:node:alpha', 'wiki:node:beta'],
    relations: [{relation: 'supports', from_ref: 'wiki:node:alpha', to_ref: 'wiki:node:beta'}],
    focus_refs: [],
  },
  temporal: [{facet_ref: 't:1', kind: 'occurrence', instant: '2026-09-19T10:00:00Z', precision: 'day'}],
  spatial: [{place_ref: 'place:here', precision: 'region', identity: {names: [{name: 'Here'}]}}],
  provenance: [{source_ref: 'central:source:probe', native_owner: 'central'}],
  expressions: [
    {expression_ref: 'oi.expression:probe', revision: '7', scene_ref: 'oi.expression:probe:scene:one'},
    {expression_ref: 'oi.expression:probe', scene_ref: 'oi.expression:probe:scene:two'},
  ],
  actions: [{action_ref: 'oi.probe.action', native_owner: 'aikit', authority: 'owner'}],
  disclosure: {
    instruments: [
      {instrument: 'project', available: true, m_prime: 0, reading: '4:2-deep'},
      {instrument: 'canvas', available: true, m_prime: 1, reading: '4:2-deep'},
      {instrument: 'timeline', available: true, m_prime: 2, reading: '4:2-deep'},
      {instrument: 'journey', available: true, m_prime: 3, reading: '4:2-deep'},
      {instrument: 'place', available: true, m_prime: 4, reading: '4:2-deep'},
      {instrument: 'palace', available: false, reason: 'the reading names no unclaimed composition', m_prime: 5, reading: '4:2-deep'},
      {instrument: 'expressions', available: true, reading: '3:3-conjugate'},
    ],
    application_cuts: [{cut: '4:2-deep', available: true}],
    degraded: [],
    suggestions: [],
  },
};

const SUBJECT: TechneSubject = {ref: 'wiki:node:alpha', kind: 'wiki-node', title: 'Alpha', project: 'probe'};

let readCount = 0;
registerTechneReadingProvider({
  ref: 'probe.ql-techne',
  async read() {
    readCount += 1;
    return READING;
  },
});

// The Studio recorder: parks the lens's nodes into real DOM so the probe can
// assert they render — and records every set/release.
interface StudioCall {slot: 'body' | 'tools'; value: 'node' | 'null'}
function makeStudio(calls: StudioCall[]): TechneLensStudio {
  const record = (slot: StudioCall['slot']) => (value: React.ReactNode) => {
    calls.push({slot, value: value === null ? 'null' : 'node'});
    setStateOf(slot, value);
  };
  return {setBody: record('body'), setTools: record('tools')};
}
const studioState = {body: null as React.ReactNode, tools: null as React.ReactNode};
let bumpStudio: (() => void) | null = null;
function setStateOf(slot: 'body' | 'tools', value: React.ReactNode) {
  studioState[slot] = value;
  bumpStudio?.();
}

function LensHost(props: {instrument: string; disclosure?: TechneDisclosureState; mountKey?: string}) {
  const live = useTechneDisclosure(SUBJECT);
  const disclosure = props.disclosure ?? live;
  const lens: TechneLens | undefined = techneLenses().find((entry) => entry.instrument === props.instrument);
  const callsRef = React.useRef<StudioCall[] | null>(null);
  if (callsRef.current === null) {
    callsRef.current = [];
    window.techneProbe.studioCalls = window.techneProbe.studioCalls.concat(['session-start']);
  }
  const Body = lens?.Body;
  if (!Body) return null;
  const mountId = props.instrument + (props.mountKey ?? '');
  if (window.techneProbe) window.techneProbe.lensRoots[mountId] = callsRef.current!;
  const props_: TechneLensBodyProps = {
    binding: {id: 'probe-binding', kind: 'techne', ref: SUBJECT.ref, title: 'Alpha'},
    subject: SUBJECT,
    disclosure,
    sceneId: 'probe-scene',
    studio: makeStudio(callsRef.current),
  };
  return (
    <div className="lens-root" data-lens={props.instrument} data-mount-key={props.mountKey ?? ''}>
      <Body {...props_}/>
    </div>
  );
}

// The live harness: one subject, the ONE disclosure hook, the active lens.
function Harness() {
  const [active, setActive] = React.useState<string>('project');
  const [mountKey, setMountKey] = React.useState(0);
  const [, force] = React.useState(0);
  bumpStudio = () => force((n) => n + 1);
  const disclosure = useTechneDisclosure(SUBJECT);
  window.techneProbe.standing = disclosure.standing;
  window.techneProbe.readCount = readCount;
  window.techneProbe.session = disclosureSession.get();
  return (
    <div>
      <div data-testid="studio">
        <div data-testid="studio-body">{studioState.body}</div>
        <div data-testid="studio-tools">{studioState.tools}</div>
      </div>
      <div data-testid="lens-area">
        <LensHost instrument={active} mountKey={String(mountKey)} disclosure={disclosure}/>
      </div>
      <button data-cmd="switch" onClick={() => {
        const order = ['project', 'canvas', 'timeline', 'journey', 'place', 'palace'];
        setActive(order[(order.indexOf(active) + 1) % order.length]);
      }}>switch</button>
      <button data-cmd="remount" onClick={() => setMountKey((n) => n + 1)}>remount</button>
    </div>
  );
}

// The four synthetic disclosure states, rendered through the same Body.
const synthetic: Record<string, TechneDisclosureState> = {
  'no-subject': {standing: 'no-subject'},
  'loading': {standing: 'reading'},
  'unavailable': {standing: 'unavailable', reason: 'no ql.techne/v1 reading source is registered in this window'},
};

function StatesHarness() {
  const [, force] = React.useState(0);
  bumpStudio = () => force((n) => n + 1);
  return (
    <div>
      {Object.entries(synthetic).map(([key, disclosure]) => (
        <LensHost key={key} instrument="canvas" disclosure={disclosure} mountKey={`state-${key}`}/>
      ))}
      {/* RESOLVED · LENS UNAVAILABLE: the real provider read, palace's own entry */}
      <UnavailableHarness/>
    </div>
  );
}

function UnavailableHarness() {
  const live = useTechneDisclosure(SUBJECT);
  const lens = techneLenses().find((entry) => entry.instrument === 'palace');
  if (!lens || live.standing !== 'read') return null;
  return <LensHost instrument="palace" disclosure={live} mountKey="state-lens-unavailable"/>;
}

declare global {
  interface Window {
    techneProbe: {
      standing: string;
      readCount: number;
      session: ReturnType<typeof disclosureSession.get>;
      studioCalls: StudioCall[];
      lensRoots: Record<string, StudioCall[]>;
      lenses(): string[];
      tryDuplicate(): string;
      mountHarness(): void;
      mountStates(): void;
      unmountAll(): void;
    };
  }
}

let root: Root | null = null;
window.techneProbe = {
  standing: 'none',
  readCount: 0,
  session: null,
  studioCalls: [],
  lensRoots: {},
  lenses: () => techneLenses().map((lens) => lens.instrument),
  tryDuplicate: () => {
    try {
      registerTechneLens({...techneLenses()[0]});
      return 'no-throw';
    } catch (cause) {
      return cause instanceof Error ? cause.message : String(cause);
    }
  },
  mountHarness: () => {
    root = createRoot(document.getElementById('root')!);
    root.render(<React.StrictMode><KernelProvider><VisualsProvider><ExpressionStageProvider><Harness/></ExpressionStageProvider></VisualsProvider></KernelProvider></React.StrictMode>);
  },
  mountStates: () => {
    root = createRoot(document.getElementById('root')!);
    root.render(<React.StrictMode><KernelProvider><VisualsProvider><ExpressionStageProvider><StatesHarness/></ExpressionStageProvider></VisualsProvider></KernelProvider></React.StrictMode>);
  },
  unmountAll: () => {
    root?.unmount();
    root = null;
  },
};
window.techneProbe.mountHarness();
