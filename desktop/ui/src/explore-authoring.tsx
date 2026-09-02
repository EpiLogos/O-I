import { useEffect, useMemo, useState } from 'react';
import type { WorldPresentation } from './world-presentation';
import './explore-authoring.css';

type Operation = Record<string, unknown> & { type: string };

type Props = {
  presentation: WorldPresentation;
  projectionRef?: string;
  sourceRef?: string;
  sourceRevision?: string;
  dirty: boolean;
  operations: string[];
  onOperate: (operation: Operation) => void;
  onSaveWorking: () => void;
  onResetWorking: () => void;
};

export function DesktopExploreAuthoring({
  presentation,
  projectionRef,
  sourceRef,
  sourceRevision,
  dirty,
  operations,
  onOperate,
  onSaveWorking,
  onResetWorking,
}: Props) {
  const bindings = useMemo(() => presentation.regions.flatMap((region) =>
    region.bindings.map((binding, index) => ({ region, binding, index }))), [presentation]);
  const [selectedBindingRef, setSelectedBindingRef] = useState<string>(bindings[0]?.binding.binding_ref ?? '');
  const selected = bindings.find((item) => item.binding.binding_ref === selectedBindingRef) ?? bindings[0];
  const [propsDraft, setPropsDraft] = useState('{}');
  const [themeDraft, setThemeDraft] = useState('{}');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    setSelectedBindingRef(selected.binding.binding_ref);
    setPropsDraft(JSON.stringify(selected.binding.props, null, 2));
  }, [selected?.binding.binding_ref, presentation.revision]);

  useEffect(() => {
    setThemeDraft(JSON.stringify(presentation.theme.tokens, null, 2));
  }, [presentation.theme.tokens]);

  function applyProps() {
    if (!selected) return;
    try {
      const patch = JSON.parse(propsDraft);
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Props must be a JSON object.');
      onOperate({ type: 'edit-binding-props', binding_ref: selected.binding.binding_ref, patch });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  function applyTheme() {
    try {
      const tokens = JSON.parse(themeDraft);
      if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) throw new TypeError('Theme tokens must be a JSON object.');
      onOperate({ type: 'edit-theme', tokens });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  function move(delta: number) {
    if (!selected) return;
    onOperate({
      type: 'move-binding',
      binding_ref: selected.binding.binding_ref,
      to_region_ref: selected.region.region_ref,
      index: Math.max(0, selected.index + delta),
    });
  }

  return <aside className="desktop-explore-authoring" aria-label="Explore WorldPresentation authoring">
    <header>
      <div><span className="oi-eyebrow">Shared authoring model</span><h3>Working presentation</h3></div>
      <span className={dirty ? 'is-dirty' : ''}>{dirty ? 'working changes' : 'canonical reading'}</span>
    </header>

    <dl className="desktop-explore-authoring__standing">
      <dt>Presentation</dt><dd><code>{presentation.presentation_ref}@{presentation.revision}</code></dd>
      <dt>Projection</dt><dd><code>{projectionRef ?? 'not disclosed'}</code></dd>
      <dt>Source</dt><dd><code>{sourceRef ?? presentation.world_ref}{sourceRevision ? `@${sourceRevision}` : ''}</code></dd>
      <dt>Publication</dt><dd>provider-owned; no desktop publication authority</dd>
    </dl>

    <section>
      <label>Binding<select value={selected?.binding.binding_ref ?? ''} onChange={(event) => setSelectedBindingRef(event.target.value)}>{bindings.map(({ region, binding }) => <option key={binding.binding_ref} value={binding.binding_ref}>{region.label ?? region.role} · {binding.binding_ref}</option>)}</select></label>
      {selected ? <>
        <small>{selected.binding.component_ref}{selected.binding.contribution_ref ? ` · ${selected.binding.contribution_ref}` : ''}</small>
        <label>Props<textarea rows={10} value={propsDraft} onChange={(event) => setPropsDraft(event.target.value)} /></label>
        <div className="desktop-explore-authoring__actions"><button type="button" onClick={applyProps}>Apply props</button><button type="button" onClick={() => move(-1)} disabled={selected.index === 0}>Move up</button><button type="button" onClick={() => move(1)} disabled={selected.index >= selected.region.bindings.length - 1}>Move down</button><button type="button" onClick={() => onOperate({ type: 'duplicate-binding', binding_ref: selected.binding.binding_ref })}>Duplicate</button><button type="button" onClick={() => onOperate({ type: 'remove-binding', binding_ref: selected.binding.binding_ref })}>Remove</button></div>
      </> : <p className="oi-muted">No binding is available in this presentation.</p>}
    </section>

    <section>
      <label>Theme tokens<textarea rows={6} value={themeDraft} onChange={(event) => setThemeDraft(event.target.value)} /></label>
      <button type="button" onClick={applyTheme}>Apply theme</button>
    </section>

    <section className="desktop-explore-authoring__availability">
      <strong>Shared operations</strong>
      <p>{operations.join(' · ')}</p>
      <small>`insert-contribution` and source-return/publication require effective native provider state; desktop does not infer either from what is rendered.</small>
    </section>

    {error ? <p className="desktop-explore-authoring__error">{error}</p> : null}
    <footer><button type="button" onClick={onSaveWorking} disabled={!dirty}>Save working state</button><button type="button" onClick={onResetWorking}>Reset working state</button></footer>
  </aside>;
}
