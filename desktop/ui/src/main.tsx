import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import '@epilogos/oi-design-system/tokens.css';
import './shell.css';
import { NaraSurface, type NaraActionReceipt } from './NaraSurface';

type Destination = 'home' | 'epi' | 'personal' | 'build' | 'explore' | 'system';
type SuiteCondition = 'empty' | 'partial' | 'broken' | 'full';
type ContributionAvailability = 'ready' | 'degraded' | 'pending_native_adapter' | 'unavailable';
type PersonalSummon = 'explain' | 'review' | 'source' | 'bimba' | 'provenance' | 'proposal';

type SemanticRef = {
  ref: string;
  kind: string;
  native_owner: string;
  provenance: { source: string; revision?: string };
};

type Surface = {
  id: string;
  public_name: string;
  function: string;
  repository: string;
  native_entry: string;
  state: 'missing' | 'installed' | 'registered' | 'broken';
  detail?: string;
};

type Snapshot = {
  schema: 'oi.desktop-shell/v1';
  destination: Destination;
  suite_condition: SuiteCondition;
  destinations: Destination[];
  surfaces: Surface[];
  selection?: SemanticRef;
  warnings: string[];
};

type Contribution = {
  contribution: {
    contribution_ref: string;
    native_owner: string;
    target_contract?: string;
    availability: ContributionAvailability;
    regions: string[];
    read_model_ref?: SemanticRef;
    detail?: string;
    provenance: { source: string; revision?: string };
  };
  package?: { package_ref: string; source_revision: string };
};

type FactoryBuildSnapshot = {
  contract: 'factory.build-view/v1';
  providerContract: 'factory.build-view-provider/v1';
  revision: number;
  provenance: {
    owner: string;
    factoryStateRevision: number;
    runRevision: number;
    runMapRevision: number;
    source: string;
  };
  view: {
    project: { projectRef: string; label: string };
    run: { runRef: string; runMapRef: string; label: string; status: string };
    frontier: { subjectRef: string; title: string; mode: string; summary: string };
    candidates: Array<{
      candidateRef: string;
      label: string;
      status: string;
      claimRefs: string[];
      evidenceRefs: string[];
      producingExecutionRefs: string[];
    }>;
    humanRequests: Array<{
      humanRequestRef: string;
      question: string;
      whyHuman: string;
      evidenceRefs?: string[];
    }>;
    executions: Array<{
      executionRef: string;
      status: string;
      sessionSpaceRef?: string;
      harnessRef?: string;
      nativeTrajectoryRef?: string;
    }>;
    actions: Array<{
      actionRef: string;
      label: string;
      subjectKinds: string[];
      requiredCapabilityRef: string;
    }>;
  };
};

type PersonalSubject = {
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
};

type CanonicalEpiAgent = {
  canonicalAgentRef: string;
  bimbaRef: string;
  name: string;
  position: number;
  epiFunction: string;
  materialisationOwner: string;
  bridgeRuntime: string;
};

type EpiiReading = {
  schema: 'epi.personal-epii-review/v1';
  actionRef: string;
  reviewRef: string;
  mode: 'explain' | 'review';
  subject: PersonalSubject;
  agent: CanonicalEpiAgent;
  standing: Record<'authored' | 'observed' | 'inferred' | 'derived' | 'formal' | 'research', string[]>;
  explanation: string[];
  reviewQuestions: string[];
  summons: string[];
  returnLaw: string[];
  provenance: PersonalProvenance;
};

type GroundReading = {
  schema: 'epi.personal-ground-orientation/v1';
  actionRef: string;
  groundRef: string;
  subject: PersonalSubject;
  agent: CanonicalEpiAgent;
  relation: { fromRef: string; viaRef: string; toRef: string; reason: string[] };
  bimba: {
    semanticRef: string;
    currentLocusRef: string;
    applicationContract: string;
    providerStatus: string;
    providerIdentityIsSemanticIdentity: boolean;
    promotion: string;
  };
  sourceAnchors: string[];
  qlOrientation: string[];
  provenance: PersonalProvenance;
};

type ProposalReading = {
  schema: 'epi.personal-proposal/v1';
  actionRef: string;
  proposalRef: string;
  subject: PersonalSubject;
  proposedContent: string;
  sourceClass: 'proposal';
  adoptionState: string;
  sourceMutationPerformed: boolean;
  reviewRef?: string;
  groundRef?: string;
  allowedResolutions: string[];
  centralReturn: {
    actionRef: string;
    kind: string;
    status: string;
    actorRef: string;
    requiresHumanAcceptanceForDurableGround: boolean;
    durablePromotionActionRef: string;
  };
  provenance: PersonalProvenance;
};

type PersonalProvenance = {
  epiSourceRevision: string;
  qlProviderRevision: string;
  semanticSources: string[];
  resultClass: string;
  promotion: string;
};

type PersonalDepthReceipt = {
  schema: 'oi.epi-personal-depth-receipt/v1';
  kind: PersonalSummon;
  actionRef: string;
  subjectRef: string;
  authoritySubjectRef: string;
  grantRef: string;
  operationId: string;
  reading: EpiiReading | GroundReading | ProposalReading;
  centralReturn?: {
    source?: string;
    handoff?: { id: string; status: string };
  };
  centralNow?: unknown;
};

const preview: Snapshot = {
  schema: 'oi.desktop-shell/v1',
  destination: 'home',
  suite_condition: 'empty',
  destinations: ['home', 'epi', 'personal', 'build', 'explore', 'system'],
  surfaces: [],
  warnings: ['Browser preview: native O:I composition is unavailable outside the Rust shell.'],
};

function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>(preview);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [factoryBuild, setFactoryBuild] = useState<FactoryBuildSnapshot | null>(null);
  const [naraReceipt, setNaraReceipt] = useState<NaraActionReceipt | null>(null);
  const [personalDepth, setPersonalDepth] = useState<PersonalDepthReceipt | null>(null);
  const [centralHistory, setCentralHistory] = useState<unknown | null>(null);
  const [personalMessage, setPersonalMessage] = useState('');

  useEffect(() => {
    invoke<Snapshot>('shell_snapshot').then(setSnapshot).catch(() => setSnapshot(preview));
    invoke<Contribution[]>('contribution_catalog').then(setContributions).catch(() => setContributions([]));
    void refreshFactoryBuild();
  }, []);

  async function refreshFactoryBuild() {
    try {
      const next = await invoke<FactoryBuildSnapshot | null>('factory_build_snapshot');
      setFactoryBuild(next);
      setContributions(await invoke<Contribution[]>('contribution_catalog'));
    } catch {
      setFactoryBuild(null);
    }
  }

  async function openDestination(destination: Destination) {
    try {
      await invoke('open_destination', { destination });
      setSnapshot(await invoke<Snapshot>('shell_snapshot'));
      if (destination === 'build') await refreshFactoryBuild();
    } catch {
      setSnapshot((current) => ({ ...current, destination }));
    }
  }

  async function receiveNaraAction(receipt: NaraActionReceipt) {
    setNaraReceipt(receipt);
    setPersonalDepth(null);
    setCentralHistory(null);
    setPersonalMessage('');
    try {
      setSnapshot(await invoke<Snapshot>('shell_snapshot'));
      setContributions(await invoke<Contribution[]>('contribution_catalog'));
    } catch {
      // The receipt still carries the exact governed context packet; failure to
      // refresh shell chrome must not broaden or reconstruct it.
    }
  }

  async function summonPersonal(kind: PersonalSummon) {
    if (!naraReceipt) return;
    const selection = naraReceipt.selection;
    const reviewRef = personalDepth?.reading.schema === 'epi.personal-epii-review/v1'
      ? personalDepth.reading.reviewRef
      : personalDepth?.reading.schema === 'epi.personal-ground-orientation/v1'
        ? personalDepth.reading.relation.viaRef
        : personalDepth?.reading.schema === 'epi.personal-proposal/v1'
          ? personalDepth.reading.reviewRef
          : undefined;
    const groundRef = personalDepth?.reading.schema === 'epi.personal-ground-orientation/v1'
      ? personalDepth.reading.groundRef
      : personalDepth?.reading.schema === 'epi.personal-proposal/v1'
        ? personalDepth.reading.groundRef
        : undefined;

    setPersonalMessage(`Opening ${kind} around the same Nara selection…`);
    setCentralHistory(null);
    try {
      const receipt = await invoke<PersonalDepthReceipt>('epi_personal_depth', {
        kind,
        episodeRef: selection.episodeRef,
        revision: selection.episodeRevision,
        startByte: selection.startByte,
        endByte: selection.endByte,
        operationId: `epi-personal-${kind}-${Date.now()}-${selection.startByte}-${selection.endByte}`,
        reviewRef,
        groundRef,
        proposedContent: null,
      });
      if (receipt.subjectRef !== selection.selectionRef || receipt.authoritySubjectRef !== selection.episodeRef) {
        throw new Error('Personal depth returned identity drift from the governed Nara selection.');
      }
      setPersonalDepth(receipt);
      setPersonalMessage('');
    } catch (error) {
      setPersonalMessage(String(error));
    }
  }

  async function openHistory() {
    setPersonalMessage('Reading Central NOW history…');
    setPersonalDepth(null);
    try {
      const reading = await invoke<unknown | null>('central_now_snapshot');
      if (!reading) throw new Error('Central NOW is not configured for this O:I session.');
      setCentralHistory(reading);
      setPersonalMessage('');
    } catch (error) {
      setCentralHistory(null);
      setPersonalMessage(String(error));
    }
  }

  async function rejectProposal(receipt: PersonalDepthReceipt) {
    if (receipt.reading.schema !== 'epi.personal-proposal/v1') return;
    const handoffId = receipt.centralReturn?.handoff?.id;
    if (!handoffId) {
      setPersonalMessage('This proposal has no Central NOW handoff to reject. The Epi proposal remains unadopted.');
      return;
    }
    try {
      const updated = await invoke<{ handoff?: { id: string; status: string } }>('reject_personal_proposal', {
        handoffId,
        proposalRef: receipt.reading.proposalRef,
      });
      setPersonalDepth({ ...receipt, centralReturn: { ...receipt.centralReturn, ...updated } });
      setPersonalMessage('Proposal return resolved without adoption. Protected Nara source remains unchanged.');
    } catch (error) {
      setPersonalMessage(String(error));
    }
  }

  const visibleContributions = useMemo(
    () => contributions.filter((entry) => ownerVisibleAt(entry.contribution.native_owner, snapshot.destination)),
    [contributions, snapshot.destination],
  );
  const rootAgency = contributions.find((entry) => entry.contribution.native_owner === 'actuation');

  return (
    <main className="oi-shell oi-surface-light" data-suite-state={snapshot.suite_condition}>
      <header className="oi-shell__topbar">
        <div className="oi-mark" aria-label="O:I">O:I</div>
        <nav aria-label="O:I destinations">
          {snapshot.destinations.map((destination) => (
            <button
              key={destination}
              className={snapshot.destination === destination ? 'is-active' : ''}
              onClick={() => openDestination(destination)}
            >
              {destination === 'home' ? 'Home' : destination === 'epi' ? 'Epi' : destination[0].toUpperCase() + destination.slice(1)}
            </button>
          ))}
        </nav>
        <span className="oi-state" data-state={snapshot.suite_condition}>{snapshot.suite_condition}</span>
      </header>

      <section className="oi-shell__canvas" aria-label="Primary content canvas">
        {snapshot.destination === 'epi' ? (
          personalDepth ? (
            <PersonalDepthSurface
              receipt={personalDepth}
              onBack={() => { setPersonalDepth(null); setPersonalMessage(''); }}
              onSummon={summonPersonal}
              onReject={rejectProposal}
              message={personalMessage}
            />
          ) : centralHistory ? (
            <CentralHistorySurface
              reading={centralHistory}
              selection={naraReceipt?.selection}
              onBack={() => { setCentralHistory(null); setPersonalMessage(''); }}
            />
          ) : (
            <NaraSurface onActionReceipt={receiveNaraAction} />
          )
        ) : (
          <>
            <p className="oi-eyebrow">{snapshot.destination}</p>
            <h1>{titleFor(snapshot.destination)}</h1>
            <p className="oi-lead">{copyFor(snapshot.destination)}</p>
            {snapshot.destination === 'build' && factoryBuild && (
              <FactoryBuildSurface snapshot={factoryBuild} onRefresh={refreshFactoryBuild} />
            )}
            {snapshot.destination === 'system' && <SystemSurface surfaces={snapshot.surfaces} />}
            <ContributionSurface contributions={visibleContributions} />
          </>
        )}
      </section>

      <aside className="oi-shell__inspector" aria-label="Context and root agency region">
        <p className="oi-eyebrow">Encounter</p>
        <h2>{snapshot.destination === 'epi' ? 'Situated Epi context' : 'Shared reference'}</h2>
        {snapshot.destination === 'epi' && naraReceipt ? (
          <SituatedNaraPacket
            receipt={naraReceipt}
            onSummon={summonPersonal}
            onHistory={openHistory}
            message={personalMessage}
          />
        ) : snapshot.selection ? (
          <dl className="oi-ref">
            <dt>Ref</dt><dd>{snapshot.selection.ref}</dd>
            <dt>Kind</dt><dd>{snapshot.selection.kind}</dd>
            <dt>Owner</dt><dd>{snapshot.selection.native_owner}</dd>
            <dt>Source</dt><dd>{snapshot.selection.provenance.source}</dd>
          </dl>
        ) : (
          <p className="oi-muted">
            {snapshot.destination === 'epi'
              ? 'Select text in Nara and invoke the governed sendoff. The situated region receives only that bounded packet, never ambient access to the journal.'
              : 'No object selected. Canvas and root-agency regions share one stable Ref; O:I does not copy wholesale Context into contributions.'}
          </p>
        )}
        <div className="oi-root-agency">
          <p className="oi-eyebrow">Root Agency</p>
          {rootAgency ? (
            <>
              <strong>{rootAgency.contribution.availability}</strong>
              <p className="oi-muted">{rootAgency.contribution.target_contract ?? 'native adapter pending'}</p>
              <small>{rootAgency.contribution.provenance.source}</small>
            </>
          ) : <p className="oi-muted">No Actuation reading disclosed.</p>}
        </div>
      </aside>

      <footer className="oi-shell__drawer" aria-label="Deep drawer">
        <span>Trajectory / terminal / events</span>
        <span>{snapshot.destination === 'epi' ? 'closed unless germane to Nara work' : 'reserved native Surface slot'}</span>
      </footer>
    </main>
  );
}

function SituatedNaraPacket({
  receipt,
  onSummon,
  onHistory,
  message,
}: {
  receipt: NaraActionReceipt;
  onSummon: (kind: PersonalSummon) => Promise<void>;
  onHistory: () => Promise<void>;
  message: string;
}) {
  const selection = receipt.selection;
  return (
    <div className="oi-situated-packet">
      <dl className="oi-ref">
        <dt>Selection</dt><dd>{selection.selectionRef}</dd>
        <dt>Episode</dt><dd>{selection.episodeRef}</dd>
        <dt>Range</dt><dd>{selection.startByte}–{selection.endByte} · r{selection.episodeRevision}</dd>
        <dt>DAY/NOW</dt><dd>{selection.dayId} · {selection.nowPath}</dd>
        <dt>QL</dt><dd>{selection.qlAddress}</dd>
        <dt>Coordinate</dt><dd>{selection.coordinateRef}</dd>
        <dt>Profile</dt><dd>{selection.profileRef}</dd>
      </dl>
      <blockquote>{selection.selectedText}</blockquote>
      <div className="oi-personal-summons" aria-label="Personal Epi depth">
        {(['explain', 'review', 'source', 'bimba', 'provenance', 'proposal'] as PersonalSummon[]).map((kind) => (
          <button type="button" key={kind} onClick={() => void onSummon(kind)}>{labelForSummon(kind)}</button>
        ))}
        <button type="button" onClick={() => void onHistory()}>History</button>
      </div>
      {message && <p className="oi-muted oi-personal-message">{message}</p>}
      <details>
        <summary>Exact disclosure scope</summary>
        <ul>{receipt.agentContextScope.map((item) => <li key={item}>{item}</li>)}</ul>
      </details>
      <small>Governed Action {receipt.actionRef} · authority parent {receipt.authoritySubjectRef} · operation {receipt.operationId}</small>
    </div>
  );
}

function PersonalDepthSurface({
  receipt,
  onBack,
  onSummon,
  onReject,
  message,
}: {
  receipt: PersonalDepthReceipt;
  onBack: () => void;
  onSummon: (kind: PersonalSummon) => Promise<void>;
  onReject: (receipt: PersonalDepthReceipt) => Promise<void>;
  message: string;
}) {
  const reading = receipt.reading;
  const subject = reading.subject;
  const isProposal = reading.schema === 'epi.personal-proposal/v1';
  return (
    <section className="oi-personal-depth" aria-label="Summoned Personal Epi depth">
      <header className="oi-personal-depth__header">
        <div>
          <p className="oi-eyebrow">Epi / Personal · same Nara object</p>
          <h1>{personalDepthTitle(reading)}</h1>
          <p className="oi-lead">{personalDepthLead(reading)}</p>
        </div>
        <button type="button" onClick={onBack}>Back to Nara</button>
      </header>

      <article className="oi-personal-subject">
        <span className="oi-contribution-state" data-state="ready">same object</span>
        <dl className="oi-ref">
          <dt>Selection</dt><dd>{subject.selectionRef}</dd>
          <dt>Episode</dt><dd>{subject.episodeRef} · r{subject.episodeRevision}</dd>
          <dt>Range</dt><dd>{subject.startByte}–{subject.endByte}</dd>
          <dt>DAY/NOW</dt><dd>{subject.dayId} · {subject.nowPath}</dd>
          <dt>Coordinate</dt><dd>{subject.coordinateRef}</dd>
          <dt>Profile</dt><dd>{subject.profileRef}</dd>
        </dl>
        <blockquote>{subject.selectedText}</blockquote>
        <small>Governed Action {receipt.actionRef} · grant {receipt.grantRef}</small>
      </article>

      {reading.schema === 'epi.personal-epii-review/v1' && <EpiiSurface reading={reading} />}
      {reading.schema === 'epi.personal-ground-orientation/v1' && <GroundSurface reading={reading} />}
      {reading.schema === 'epi.personal-proposal/v1' && (
        <ProposalSurface reading={reading} centralReturn={receipt.centralReturn} onReject={() => void onReject(receipt)} />
      )}

      <nav className="oi-personal-summons" aria-label="Continue Personal Epi relation">
        <button type="button" onClick={() => void onSummon('explain')}>Explain</button>
        <button type="button" onClick={() => void onSummon('review')}>Review</button>
        <button type="button" onClick={() => void onSummon('source')}>Source</button>
        <button type="button" onClick={() => void onSummon('bimba')}>Bimba</button>
        <button type="button" onClick={() => void onSummon('provenance')}>Provenance</button>
        {!isProposal && <button type="button" onClick={() => void onSummon('proposal')}>Proposal</button>}
      </nav>
      {message && <p className="oi-muted oi-personal-message">{message}</p>}
    </section>
  );
}

function EpiiSurface({ reading }: { reading: EpiiReading }) {
  return (
    <div className="oi-personal-depth__body">
      <article>
        <div><span className="oi-contribution-state" data-state="ready">M5′</span><h3>{reading.agent.name} · Epi-specific {reading.mode}</h3></div>
        {reading.explanation.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        <small>{reading.agent.epiFunction}</small>
      </article>
      <article>
        <h3>What is known as what</h3>
        <div className="oi-standing-grid">
          {Object.entries(reading.standing).map(([standing, claims]) => (
            <div key={standing}>
              <strong>{standing}</strong>
              <ul>{claims.map((claim) => <li key={claim}>{claim}</li>)}</ul>
            </div>
          ))}
        </div>
      </article>
      <article>
        <h3>Review, without adoption</h3>
        <ul>{reading.reviewQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
        <p className="oi-muted">{reading.returnLaw.join(' · ')}</p>
      </article>
      <ProvenanceBlock provenance={reading.provenance} />
    </div>
  );
}

function GroundSurface({ reading }: { reading: GroundReading }) {
  return (
    <div className="oi-personal-depth__body">
      <article>
        <div><span className="oi-contribution-state" data-state="ready">M0′</span><h3>{reading.agent.name} · focused ground</h3></div>
        <dl className="oi-ref">
          <dt>From</dt><dd>{reading.relation.fromRef}</dd>
          <dt>Through review</dt><dd>{reading.relation.viaRef}</dd>
          <dt>Ground</dt><dd>{reading.relation.toRef}</dd>
        </dl>
        <h4>Why this ground</h4>
        <ul>{reading.relation.reason.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      </article>
      <article>
        <h3>Bimba orientation</h3>
        <dl className="oi-ref">
          <dt>Semantic ref</dt><dd>{reading.bimba.semanticRef}</dd>
          <dt>Current locus</dt><dd>{reading.bimba.currentLocusRef}</dd>
          <dt>Application contract</dt><dd>{reading.bimba.applicationContract}</dd>
          <dt>Provider status</dt><dd>{reading.bimba.providerStatus}</dd>
          <dt>Provider = Bimba?</dt><dd>{reading.bimba.providerIdentityIsSemanticIdentity ? 'yes' : 'no'}</dd>
          <dt>Promotion</dt><dd>{reading.bimba.promotion}</dd>
        </dl>
      </article>
      <article>
        <h3>Source / formal orientation</h3>
        <ul>{reading.sourceAnchors.map((source) => <li key={source}>{source}</li>)}</ul>
        <ul>{reading.qlOrientation.map((orientation) => <li key={orientation}>{orientation}</li>)}</ul>
      </article>
      <ProvenanceBlock provenance={reading.provenance} />
    </div>
  );
}

function ProposalSurface({
  reading,
  centralReturn,
  onReject,
}: {
  reading: ProposalReading;
  centralReturn?: PersonalDepthReceipt['centralReturn'];
  onReject: () => void;
}) {
  return (
    <div className="oi-personal-depth__body">
      <article>
        <div><span className="oi-contribution-state" data-state="degraded">not adopted</span><h3>Personal return candidate</h3></div>
        <blockquote>{reading.proposedContent}</blockquote>
        <dl className="oi-ref">
          <dt>Proposal</dt><dd>{reading.proposalRef}</dd>
          <dt>Source class</dt><dd>{reading.sourceClass}</dd>
          <dt>Adoption</dt><dd>{reading.adoptionState}</dd>
          <dt>Source mutation</dt><dd>{reading.sourceMutationPerformed ? 'performed' : 'none'}</dd>
          <dt>Central NOW</dt><dd>{centralReturn?.handoff?.status ?? 'not returned / Central not configured'}</dd>
        </dl>
        <p>This proposal can remain derived, be rejected, or enter human review. It is not a durable personal-source mutation.</p>
        {centralReturn?.handoff?.id && <button type="button" onClick={onReject}>Reject / do not adopt</button>}
      </article>
      <article>
        <h3>Recognition boundary</h3>
        <p>Durable personal change is owned by the human in Central. A recognised return must first exist as human-owned <code>ProjectCentral/now/user/**</code> source and then pass Central’s explicit <code>{reading.centralReturn.durablePromotionActionRef}</code> path with human acceptance.</p>
        <p className="oi-muted">Epii can formulate and inspect this candidate; it cannot promote its own generated text into human ground.</p>
      </article>
      <ProvenanceBlock provenance={reading.provenance} />
    </div>
  );
}

function ProvenanceBlock({ provenance }: { provenance: PersonalProvenance }) {
  return (
    <article>
      <h3>Provenance</h3>
      <dl className="oi-ref">
        <dt>Result class</dt><dd>{provenance.resultClass}</dd>
        <dt>Epi</dt><dd>{shortRevision(provenance.epiSourceRevision)}</dd>
        <dt>QL</dt><dd>{shortRevision(provenance.qlProviderRevision)}</dd>
        <dt>Promotion</dt><dd>{provenance.promotion}</dd>
      </dl>
      <ul>{provenance.semanticSources.map((source) => <li key={source}>{source}</li>)}</ul>
    </article>
  );
}

function CentralHistorySurface({ reading, selection, onBack }: { reading: unknown; selection?: NaraActionReceipt['selection']; onBack: () => void }) {
  return (
    <section className="oi-personal-depth" aria-label="Central NOW history">
      <header className="oi-personal-depth__header">
        <div>
          <p className="oi-eyebrow">Central / NOW · temporal working field</p>
          <h1>History around now.</h1>
          <p className="oi-lead">This is Central’s moving working field, not Nara source and not canon.</p>
        </div>
        <button type="button" onClick={onBack}>Back to Nara</button>
      </header>
      {selection && (
        <article className="oi-personal-subject">
          <span className="oi-contribution-state" data-state="ready">same Nara subject retained</span>
          <p>{selection.selectionRef}</p>
          <small>{selection.episodeRef} · r{selection.episodeRevision}</small>
        </article>
      )}
      <article>
        <h3>Central-owned NOW reading</h3>
        <pre className="oi-personal-json">{JSON.stringify(reading, null, 2)}</pre>
      </article>
    </section>
  );
}

function FactoryBuildSurface({ snapshot, onRefresh }: { snapshot: FactoryBuildSnapshot; onRefresh: () => Promise<void> }) {
  return (
    <section className="oi-contributions" aria-label="Live Factory Build Surface">
      <p className="oi-eyebrow">Factory-owned live reading · revision {snapshot.revision}</p>
      <article>
        <div><span className="oi-contribution-state" data-state="ready">ready</span><h3>{snapshot.view.run.label}</h3></div>
        <p>{snapshot.view.frontier.title}</p>
        <dl>
          <dt>Project</dt><dd>{snapshot.view.project.projectRef}</dd>
          <dt>Run</dt><dd>{snapshot.view.run.runRef}</dd>
          <dt>RunMap</dt><dd>{snapshot.view.run.runMapRef}</dd>
          <dt>Frontier</dt><dd>{snapshot.view.frontier.mode} · {snapshot.view.frontier.summary}</dd>
          <dt>Factory revision</dt><dd>{snapshot.provenance.factoryStateRevision}</dd>
          <dt>RunMap revision</dt><dd>{snapshot.provenance.runMapRevision}</dd>
        </dl>
        <button type="button" onClick={() => onRefresh()}>Refresh product reading</button>
      </article>

      {snapshot.view.candidates.map((candidate) => (
        <article key={candidate.candidateRef}>
          <div><span className="oi-contribution-state" data-state="ready">{candidate.status}</span><h3>{candidate.label}</h3></div>
          <p>{candidate.candidateRef}</p>
          <dl>
            <dt>Executions</dt><dd>{candidate.producingExecutionRefs.join(', ') || 'none'}</dd>
            <dt>Claims</dt><dd>{candidate.claimRefs.join(', ') || 'none'}</dd>
            <dt>Evidence</dt><dd>{candidate.evidenceRefs.join(', ') || 'none'}</dd>
          </dl>
        </article>
      ))}

      {snapshot.view.humanRequests.map((request) => (
        <article key={request.humanRequestRef}>
          <div><span className="oi-contribution-state" data-state="degraded">human request</span><h3>{request.question}</h3></div>
          <p>{request.whyHuman}</p>
          <small>{request.humanRequestRef}</small>
        </article>
      ))}

      {snapshot.view.executions.map((execution) => (
        <article key={execution.executionRef}>
          <div><span className="oi-contribution-state" data-state="ready">{execution.status}</span><h3>{execution.executionRef}</h3></div>
          <dl>
            <dt>Harness</dt><dd>{execution.harnessRef ?? 'not observed'}</dd>
            <dt>SessionSpace</dt><dd>{execution.sessionSpaceRef ?? 'not observed'}</dd>
            <dt>Native trajectory</dt><dd>{execution.nativeTrajectoryRef ?? 'not observed'}</dd>
          </dl>
        </article>
      ))}

      {snapshot.view.actions.map((action) => (
        <article key={action.actionRef}>
          <div><span className="oi-contribution-state" data-state="ready">available Action</span><h3>{action.label}</h3></div>
          <p>{action.actionRef}</p>
          <small>Requires explicit Capability grant: {action.requiredCapabilityRef}</small>
        </article>
      ))}
    </section>
  );
}

function ContributionSurface({ contributions }: { contributions: Contribution[] }) {
  if (!contributions.length) return null;
  return (
    <section className="oi-contributions" aria-label="Native product contributions">
      <p className="oi-eyebrow">Native contributions</p>
      {contributions.map(({ contribution, package: envelope }) => (
        <article key={contribution.contribution_ref}>
          <div>
            <span className="oi-contribution-state" data-state={contribution.availability}>{contribution.availability.replaceAll('_', ' ')}</span>
            <h3>{contribution.contribution_ref}</h3>
          </div>
          <p>{contribution.detail ?? 'Native product reading.'}</p>
          <dl>
            <dt>Owner</dt><dd>{contribution.native_owner}</dd>
            <dt>Contract</dt><dd>{contribution.target_contract ?? 'not yet published'}</dd>
            <dt>Revision</dt><dd>{contribution.provenance.revision ?? 'unversioned'}</dd>
            {envelope && <><dt>Package</dt><dd>{envelope.package_ref}</dd></>}
          </dl>
        </article>
      ))}
    </section>
  );
}

function SystemSurface({ surfaces }: { surfaces: Surface[] }) {
  if (!surfaces.length) return <div className="oi-empty">No registered O:I surfaces disclosed.</div>;
  return (
    <div className="oi-surface-list">
      {surfaces.map((surface) => (
        <article key={surface.id}>
          <span className="oi-surface-list__state">{surface.state}</span>
          <h3>{surface.public_name}</h3>
          <p>{surface.function}</p>
          {surface.detail && <small>{surface.detail}</small>}
        </article>
      ))}
    </div>
  );
}

function labelForSummon(kind: PersonalSummon) {
  return kind[0].toUpperCase() + kind.slice(1);
}

function personalDepthTitle(reading: PersonalDepthReceipt['reading']) {
  if (reading.schema === 'epi.personal-epii-review/v1') return reading.mode === 'explain' ? 'Epii explains.' : 'Epii reviews.';
  if (reading.schema === 'epi.personal-ground-orientation/v1') return 'The ground this points into.';
  return 'A return candidate, not a decision.';
}

function personalDepthLead(reading: PersonalDepthReceipt['reading']) {
  if (reading.schema === 'epi.personal-epii-review/v1') return 'M5′ makes the current lived difference intelligible while keeping authored, observed, inferred, derived, formal and research standing visible.';
  if (reading.schema === 'epi.personal-ground-orientation/v1') return 'M0′ opens only the germane Bimba/source/coordinate relation and says why it was selected; provider identity remains separate from semantic identity.';
  return 'A generated proposal can be inspected and returned into NOW, but generation is not adoption and does not acquire human authorship authority.';
}

function shortRevision(value: string) {
  return value.length > 12 ? value.slice(0, 12) : value;
}

function ownerVisibleAt(owner: string, destination: Destination) {
  if (destination === 'home' || destination === 'system') return true;
  if (destination === 'epi') return owner === 'epi' || owner === 'actuation' || owner === 'ai-kit';
  if (destination === 'personal') return owner === 'central' || owner === 'actuation';
  if (destination === 'build') return owner === 'software-factory' || owner === 'factory' || owner === 'ai-kit';
  if (destination === 'explore') return owner === 'oi-explore';
  return false;
}

function titleFor(destination: Destination) {
  return {
    home: 'The local O:I whole.',
    epi: 'Nara.',
    personal: 'Personal ground.',
    build: 'Development in view.',
    explore: 'Addressable worlds.',
    system: 'Composition, disclosed.',
  }[destination];
}

function copyFor(destination: Destination) {
  return {
    home: 'A sparse local surface over the installed six-product field.',
    epi: 'The lived Epi surface begins in protected writing and present context, with technical depth available when asked for.',
    personal: 'Central-owned authored ground and Actuation-owned world-binding readings enter here without moving their semantics into O:I.',
    build: 'Factory exposes a product-owned live FactoryBuildView provider over canonical state. When its local provider binding is configured, this canvas renders that observed revision directly; otherwise the Factory contribution remains explicitly degraded.',
    explore: 'The current shared-field Explore read model is hostable now, with canonical refs independent of SpaceTimeDB transport IDs.',
    system: 'Registration, reachability and native contribution status are shown without inventing product-native health.',
  }[destination];
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
