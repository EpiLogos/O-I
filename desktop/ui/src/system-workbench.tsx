import { useMemo, useState } from 'react';
import { buildSystemWorkbench } from './system-workbench-model.mjs';
import type { SystemProduct, SystemStateAxis } from './system-workbench-model.mjs';
import './system-workbench.css';

const AXIS_LABELS: Record<SystemStateAxis, string> = {
  authored: 'Authored',
  effective: 'Effective',
  active: 'Active',
  staged: 'Staged',
  expected_effect: 'Expected effect',
  observed: 'Observed',
  provenance: 'Provenance',
};

export function SystemWorkbench({
  surfaces,
  contributions,
  aikitContext,
  factoryBuild,
  warnings,
  mode = 'canvas',
}: {
  surfaces: unknown[];
  contributions: unknown[];
  aikitContext: unknown;
  factoryBuild: unknown;
  warnings: string[];
  mode?: 'canvas' | 'rail';
}) {
  const model = useMemo(() => buildSystemWorkbench({ surfaces, contributions, aikitContext, factoryBuild, warnings }), [surfaces, contributions, aikitContext, factoryBuild, warnings]);
  const [selectedId, setSelectedId] = useState('ai-kit');
  const selected = model.products.find((product) => product.id === selectedId) ?? model.products[0];

  if (mode === 'rail') {
    return (
      <section className="oi-system oi-system--rail" aria-label="Six-product System composition">
        <div className="oi-system__heading">
          <div><p className="oi-eyebrow">System · composition only</p><strong>{model.condition}</strong></div>
          <span>{model.products.length}/6 owners</span>
        </div>
        <div className="oi-system__rail-products">
          {model.products.map((product) => (
            <button type="button" key={product.id} onClick={() => setSelectedId(product.id)} data-selected={product.id === selected.id}>
              <span>{product.label}</span>
              <small data-state={product.states.observed.status}>{product.states.observed.status.replaceAll('_', ' ')}</small>
            </button>
          ))}
        </div>
        <StateDigest product={selected} compact />
        <p className="oi-system__authority">Authority → {selected.authority}</p>
      </section>
    );
  }

  return (
    <section className="oi-system" aria-label="Six-product System workbench">
      <header className="oi-system__heading">
        <div>
          <p className="oi-eyebrow">Six-product System · read / inspect / configure through native owners</p>
          <h2>One composition, seven different kinds of state.</h2>
          <p className="oi-muted">The workbench does not turn “configured”, “resolved”, “running”, “previewed”, or “observed” into synonyms. Missing native evidence remains visible as missing evidence.</p>
        </div>
        <div className="oi-system__condition">
          <span>Suite</span><strong>{model.condition}</strong>
          <span>Ordinary operation</span><strong>{model.ordinary_operation_blocked ? 'blocked' : 'not blocked'}</strong>
        </div>
      </header>

      <div className="oi-system__tabs" role="tablist" aria-label="System products">
        {model.products.map((product) => (
          <button
            type="button"
            role="tab"
            aria-selected={product.id === selected.id}
            key={product.id}
            onClick={() => setSelectedId(product.id)}
          >
            <span>{product.label}</span>
            <small data-state={product.states.observed.status}>{product.states.observed.status.replaceAll('_', ' ')}</small>
          </button>
        ))}
      </div>

      <div className="oi-system__matrix-wrap">
        <table className="oi-system__matrix">
          <thead><tr><th>Owner</th>{model.state_axes.map((axis) => <th key={axis}>{AXIS_LABELS[axis]}</th>)}</tr></thead>
          <tbody>
            {model.products.map((product) => (
              <tr key={product.id} data-selected={product.id === selected.id} onClick={() => setSelectedId(product.id)}>
                <th><strong>{product.label}</strong><small>{product.authority}</small></th>
                {model.state_axes.map((axis) => {
                  const state = product.states[axis];
                  return <td key={axis}><span className="oi-system__state" data-state={state.status}>{state.status.replaceAll('_', ' ')}</span><p>{state.summary}</p></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="oi-system__detail">
        <div className="oi-system__detail-main">
          <p className="oi-eyebrow">Selected native owner</p>
          <h3>{selected.label}</h3>
          <p>{selected.purpose}</p>
          <p className="oi-system__authority">Native authority → <strong>{selected.authority}</strong></p>
          <StateDigest product={selected} />
        </div>
        <div className="oi-system__inventory">
          <Inventory title="Resources / readings" empty="No native resource/read model is disclosed." items={selected.resources.map((resource) => ({
            id: resource.resource_ref,
            meta: `${resource.kind} · ${resource.availability}`,
            foot: `${resource.native_owner} · ${resource.source}`,
          }))} />
          <Inventory title="Actions" empty="No native Action is disclosed." items={selected.actions.map((action) => ({
            id: action.action_ref,
            meta: `${action.availability} · authority ${action.native_owner}`,
            foot: action.required_capability_ref ? `requires ${action.required_capability_ref}` : 'discovery does not confer authority',
          }))} />
        </div>
      </div>

      {(model.gaps.length > 0 || model.warnings.length > 0) && (
        <details className="oi-system__gaps">
          <summary>Deferred / provider gaps ({model.gaps.length})</summary>
          {model.gaps.map((gap) => <p key={gap}>{gap}</p>)}
          {model.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </details>
      )}
      <div className="oi-system__invariants">{model.invariants.map((invariant) => <span key={invariant}>{invariant}</span>)}</div>
    </section>
  );
}

function StateDigest({ product, compact = false }: { product: SystemProduct; compact?: boolean }) {
  return (
    <div className="oi-system__digest" data-compact={compact}>
      {(['authored', 'effective', 'active', 'staged', 'expected_effect', 'observed', 'provenance'] as SystemStateAxis[]).map((axis) => {
        const state = product.states[axis];
        return (
          <div key={axis}>
            <span>{AXIS_LABELS[axis]}</span>
            <strong data-state={state.status}>{state.status.replaceAll('_', ' ')}</strong>
            {!compact && <p>{state.summary}</p>}
            {!compact && state.refs.length > 0 && <small>{state.refs.join(' · ')}</small>}
          </div>
        );
      })}
    </div>
  );
}

function Inventory({ title, empty, items }: { title: string; empty: string; items: Array<{ id: string; meta: string; foot: string }> }) {
  return (
    <section>
      <p className="oi-eyebrow">{title}</p>
      {items.length === 0 ? <p className="oi-muted">{empty}</p> : items.map((item) => (
        <article key={`${title}:${item.id}`}>
          <code>{item.id}</code>
          <span>{item.meta}</span>
          <small>{item.foot}</small>
        </article>
      ))}
    </section>
  );
}
