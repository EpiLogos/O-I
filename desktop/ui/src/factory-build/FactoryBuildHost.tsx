import { useMemo, useState } from 'react'
import { BuildSurface } from './BuildSurface'
import { SpanDetail } from './components/SpanDetail'
import { TraceWaterfall } from './components/TraceWaterfall'
import { chronologicalSpans, orderedTraces } from './read-model'
import type { ActionInvocation, FactoryBuildView } from './types'
import './factory-build-host.css'

export const FACTORY_BUILD_SOURCE_REVISION = '06579aada01a77bd719c0c010a10f91084b4326f'
export const FACTORY_BUILD_GUI_PREDECESSOR = '02627a2373ada04369e9d2d338cfd0809f49725c'
export const SSSF_VISUALIZER_SOURCE_REVISION = 'de31374882e7a4e3e5b7bb9bd09e69dc2f779356'

export type FactoryBuildSnapshot = {
  contract: 'factory.build-view/v1'
  providerContract: 'factory.build-view-provider/v1'
  revision: number
  provenance: {
    owner: string
    factoryStateRevision: number
    runRevision: number
    runMapRevision: number
    source: string
  }
  view: FactoryBuildView
}

export type FactoryBuildSubject = {
  ref: string
  kind: 'project' | 'run' | 'candidate' | 'claim' | 'evidence' | 'execution' | 'human-request'
  label: string
  summary: string
}

export function factoryBuildSubjects(snapshot: FactoryBuildSnapshot): FactoryBuildSubject[] {
  const { view } = snapshot
  return [
    {
      ref: view.project.projectRef,
      kind: 'project',
      label: view.project.label,
      summary: 'Factory Project in the current Build reading',
    },
    {
      ref: view.run.runRef,
      kind: 'run',
      label: view.run.label,
      summary: `${view.frontier.mode} frontier · ${view.frontier.title}`,
    },
    ...view.candidates.map((candidate) => ({
      ref: candidate.candidateRef,
      kind: 'candidate' as const,
      label: candidate.label,
      summary: `${candidate.status} · ${candidate.claimRefs.length} claims · ${candidate.evidenceRefs.length} evidence refs`,
    })),
    ...view.claims.map((claim) => ({
      ref: claim.claimRef,
      kind: 'claim' as const,
      label: claim.statement,
      summary: `${claim.status} · ${claim.evidenceRefs.length} evidence refs`,
    })),
    ...view.evidence.map((evidence) => ({
      ref: evidence.evidenceRef,
      kind: 'evidence' as const,
      label: evidence.label,
      summary: evidence.assessment ?? 'Factory Evidence',
    })),
    ...view.executions.map((execution) => ({
      ref: execution.executionRef,
      kind: 'execution' as const,
      label: execution.executionRef,
      summary: `${execution.status} · ${execution.harnessRef ?? 'harness unavailable'}`,
    })),
    ...view.humanRequests.map((request) => ({
      ref: request.humanRequestRef,
      kind: 'human-request' as const,
      label: request.question,
      summary: request.whyHuman,
    })),
  ]
}

export function FactoryBuildCanvas({
  snapshot,
  onAction,
}: {
  snapshot: FactoryBuildSnapshot
  onAction?: (invocation: ActionInvocation) => void
}) {
  return (
    <section className="oi-factory-build-host" aria-label="Factory-owned Build application">
      <div className="oi-factory-build-provenance">
        <strong>Factory-owned Build body</strong>
        <span>view r{snapshot.revision}</span>
        <code>{snapshot.provenance.source}</code>
        <span>source {FACTORY_BUILD_SOURCE_REVISION.slice(0, 12)}</span>
      </div>
      <BuildSurface view={snapshot.view} onAction={onAction} />
    </section>
  )
}

export function FactoryBuildNavigator({
  snapshot,
  onSelect,
}: {
  snapshot: FactoryBuildSnapshot
  onSelect: (subject: FactoryBuildSubject) => void
}) {
  const subjects = useMemo(() => factoryBuildSubjects(snapshot), [snapshot])
  const groups = [
    ['Project / Run', subjects.filter((subject) => subject.kind === 'project' || subject.kind === 'run')],
    ['Candidates', subjects.filter((subject) => subject.kind === 'candidate')],
    ['Claims / Evidence', subjects.filter((subject) => subject.kind === 'claim' || subject.kind === 'evidence')],
    ['Executions / HumanRequests', subjects.filter((subject) => subject.kind === 'execution' || subject.kind === 'human-request')],
  ] as const

  return (
    <section className="oi-factory-build-navigator" aria-label="Factory Build subjects">
      <p className="oi-eyebrow">Factory · current Build subjects</p>
      <strong>{snapshot.view.frontier.title}</strong>
      <p className="oi-muted">{snapshot.view.frontier.summary}</p>
      {groups.map(([label, items]) => items.length ? (
        <div className="oi-factory-build-navigator__group" key={label}>
          <small>{label}</small>
          {items.map((subject) => (
            <button type="button" key={`${subject.kind}:${subject.ref}`} onClick={() => onSelect(subject)} title={subject.ref}>
              <span>{subject.label}</span>
              <code>{subject.ref}</code>
            </button>
          ))}
        </div>
      ) : null)}
    </section>
  )
}

export function FactoryTrajectoryRegion({ snapshot }: { snapshot: FactoryBuildSnapshot }) {
  const trace = orderedTraces(snapshot.view.trajectories)[0]
  const [spanRef, setSpanRef] = useState<string | undefined>()
  if (!trace) {
    return (
      <section className="oi-factory-trajectory-region">
        <p className="oi-eyebrow">Factory trajectory</p>
        <p className="oi-muted">No portable trajectory is attached to the current Run.</p>
      </section>
    )
  }
  const selectedRef = trace.spans.some((span) => span.spanRef === spanRef)
    ? spanRef
    : chronologicalSpans(trace)[0]?.spanRef
  const selectedSpan = trace.spans.find((span) => span.spanRef === selectedRef)

  return (
    <section className="oi-factory-trajectory-region" aria-label="Factory trajectory lower projection">
      <div className="oi-factory-trajectory-region__head">
        <div>
          <p className="oi-eyebrow">Factory trajectory · lower projection</p>
          <strong>{trace.request ?? snapshot.view.run.label}</strong>
        </div>
        <code>{trace.executionRef}</code>
      </div>
      <TraceWaterfall trace={trace} selectedSpanRef={selectedRef} onSelectSpan={setSpanRef} />
      {selectedSpan ? <SpanDetail span={selectedSpan} onClose={() => setSpanRef(undefined)} /> : null}
    </section>
  )
}
