import { portablePresentationRenderers, type WorldPresentation } from './presentation-components';
// @ts-ignore -- shared application operations are intentionally language-neutral JS.
import { authoringDisclosure, bindingAvailability } from '../../../shared-field/presentation-authoring.mjs';

type Contribution = {
  contribution_ref: string;
  component_ref: string;
  surface_ref?: string;
  portable_renderer?: string;
  label: string;
  available: boolean;
  degraded: boolean;
  reason?: string;
  action_refs: string[];
  default_props: Record<string, unknown>;
  fallback: Record<string, unknown>;
  provenance: Array<Record<string, unknown>>;
};

type Context = {
  resource: { ref: string; world_ref: string; label: string; revision?: string };
  projection_ref?: string | null;
  source_ref?: string | null;
  source_revision?: string | null;
};

const THEME_TOKENS = ['surface', 'foreground', 'muted', 'rule', 'relation', 'focus', 'projection', 'human', 'agent'] as const;

function provenanceText(value: Array<Record<string, unknown>> | undefined) {
  if (!value?.length) return 'No provenance disclosed';
  return value.map((item) => [item.source_system, item.ref, item.revision].filter(Boolean).join(' · ')).join('\n');
}

export function AuthoringInspector({
  context,
  presentation,
  selectedBindingRef,
  selectedRegionRef,
  contributions,
  dirty,
  sourceReturn,
  onOperation,
}: {
  context: Context;
  presentation: WorldPresentation;
  selectedBindingRef: string | null;
  selectedRegionRef: string | null;
  contributions: Contribution[];
  dirty: boolean;
  sourceReturn?: Record<string, unknown> | null;
  onOperation: (operation: Record<string, unknown>) => void;
}) {
  const disclosure = authoringDisclosure({
    presentation,
    projection_ref: context.projection_ref ?? null,
    source_ref: context.source_ref ?? context.resource.ref,
    source_revision: context.source_revision ?? context.resource.revision ?? null,
    selected_binding_ref: selectedBindingRef,
    selected_region_ref: selectedBindingRef ? null : selectedRegionRef,
    contributions,
    source_return: sourceReturn ?? null,
    mode: 'author',
    dirty,
  });
  const availability = bindingAvailability(presentation, contributions, portablePresentationRenderers);
  const selectedAvailability = selectedBindingRef ? availability.find((item: any) => item.binding_ref === selectedBindingRef) : null;
  const selectedBinding = selectedBindingRef
    ? presentation.regions.flatMap((region) => region.bindings).find((binding) => binding.binding_ref === selectedBindingRef)
    : undefined;
  const selectedRegionIndex = selectedRegionRef ? presentation.regions.findIndex((region) => region.region_ref === selectedRegionRef) : -1;
  const selectedRegion = selectedRegionIndex >= 0 ? presentation.regions[selectedRegionIndex] : undefined;

  return <div className="direct-inspector-body">
    <div className="direct-eyebrow">Context</div>
    <h2>{context.resource.label}</h2>
    <dl>
      <dt>Ref</dt><dd><code>{context.resource.ref}</code></dd>
      <dt>World</dt><dd><code>{context.resource.world_ref}</code></dd>
      <dt>Presentation</dt><dd><code>{presentation.presentation_ref}</code></dd>
      <dt>Revision</dt><dd>{presentation.revision}</dd>
      <dt>Working</dt><dd>{dirty ? 'modified' : 'clean'}</dd>
    </dl>

    {selectedBinding ? <section>
      <div className="direct-eyebrow">Selected binding</div>
      <dl>
        <dt>Binding</dt><dd><code>{selectedBinding.binding_ref}</code></dd>
        <dt>Component</dt><dd><code>{selectedBinding.component_ref}</code></dd>
        <dt>Contribution</dt><dd><code>{selectedBinding.contribution_ref ?? 'not disclosed'}</code></dd>
        <dt>Surface</dt><dd><code>{selectedBinding.surface_ref ?? 'not disclosed'}</code></dd>
      </dl>
      <label className="direct-inspector-control">
        <span>Replace presentation contribution</span>
        <select
          value={selectedBinding.contribution_ref ?? ''}
          onChange={(event) => event.target.value && onOperation({ type: 'replace-contribution', binding_ref: selectedBinding.binding_ref, contribution_ref: event.target.value })}
        >
          <option value="">Current component identity</option>
          {contributions.map((contribution) => <option key={contribution.contribution_ref} value={contribution.contribution_ref} disabled={!contribution.available}>{contribution.label}{contribution.degraded ? ' — degraded' : ''}</option>)}
        </select>
      </label>
      {disclosure.selected?.action_refs?.length ? <div className="direct-action-reading"><div className="direct-eyebrow">Canonical Actions</div><div className="direct-chips">{disclosure.selected.action_refs.map((actionRef: string) => <span key={actionRef}>{actionRef}</span>)}</div><small>Action identity is native. This inspector does not supply or replace its owner/handler.</small></div> : null}
      {selectedAvailability ? <div className="direct-availability"><strong>{selectedAvailability.renderer_available ? 'Renderer available' : 'Portable fallback'}</strong>{selectedAvailability.reason ? <small>{selectedAvailability.reason}</small> : null}</div> : null}
    </section> : null}

    {selectedRegion ? <section>
      <div className="direct-eyebrow">Selected region</div>
      <label className="direct-inspector-control"><span>Label</span><input defaultValue={selectedRegion.label ?? ''} key={`${selectedRegion.region_ref}:label:${selectedRegion.label}`} onBlur={(event) => onOperation({ type: 'edit-region', region_ref: selectedRegion.region_ref, label: event.target.value })} /></label>
      <label className="direct-inspector-control"><span>Role</span><input defaultValue={selectedRegion.role} key={`${selectedRegion.region_ref}:role:${selectedRegion.role}`} onBlur={(event) => event.target.value.trim() && onOperation({ type: 'edit-region', region_ref: selectedRegion.region_ref, role: event.target.value.trim() })} /></label>
      <div className="direct-region-order" role="group" aria-label="Region order">
        <button type="button" disabled={selectedRegionIndex <= 0} onClick={() => onOperation({ type: 'move-region', region_ref: selectedRegion.region_ref, index: selectedRegionIndex - 1 })}>Move region up</button>
        <button type="button" disabled={selectedRegionIndex < 0 || selectedRegionIndex >= presentation.regions.length - 1} onClick={() => onOperation({ type: 'move-region', region_ref: selectedRegion.region_ref, index: selectedRegionIndex + 1 })}>Move region down</button>
      </div>
    </section> : null}

    <section>
      <div className="direct-eyebrow">World theme</div>
      <p className="direct-inspector-note">Semantic roles remain the persisted meaning. The host-owned meta-relation role is intentionally not authorable here.</p>
      <div className="direct-theme-grid">
        {THEME_TOKENS.map((token) => <label key={`${token}:${presentation.theme.tokens[token] ?? ''}`} className="direct-inspector-control"><span>{token}</span><input defaultValue={presentation.theme.tokens[token] ?? ''} placeholder="inherit" onBlur={(event) => { const value = event.target.value.trim(); if (value && value !== presentation.theme.tokens[token]) onOperation({ type: 'edit-theme', tokens: { [token]: value } }); }} /></label>)}
      </div>
    </section>

    <section>
      <div className="direct-eyebrow">Projection / source</div>
      <dl><dt>Projection</dt><dd><code>{String(disclosure.projection_ref ?? 'working representation only')}</code></dd><dt>Source</dt><dd><code>{String(disclosure.source_ref ?? 'not disclosed')}</code></dd><dt>Source revision</dt><dd><code>{String(disclosure.source_revision ?? 'not disclosed')}</code></dd></dl>
      <div className="direct-source-return" data-available={disclosure.source_return.available}><strong>{disclosure.source_return.available ? `Return to ${disclosure.source_return.owner}` : 'Source return unavailable'}</strong>{disclosure.source_return.reason ? <p>{disclosure.source_return.reason}</p> : null}{disclosure.source_return.action_refs.length ? <div className="direct-chips">{disclosure.source_return.action_refs.map((ref: string) => <span key={ref}>{ref}</span>)}</div> : null}</div>
    </section>

    <section><div className="direct-eyebrow">Provenance</div><pre>{selectedBinding ? provenanceText(selectedBinding.provenance) : provenanceText(presentation.provenance)}</pre></section>
    <section><div className="direct-eyebrow">Agent-visible operations</div><div className="direct-chips">{disclosure.operations.map((operation: string) => <span key={operation}>{operation}</span>)}</div></section>
  </div>;
}
