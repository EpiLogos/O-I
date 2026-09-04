import React from 'react';
import './world-tree.css';
import {
  buildCompositionModel,
  buildWorldTreeModel,
  nodeIsFocused,
  sourceIsFocused,
  subjectRefForNode,
  subjectRefForSource,
  type CompositionReading,
  type TreeSubjectRef,
  type WorldTreeReading,
  type WorldTreeNodeModel,
} from './world-tree-model.mjs';

/** A kernel focus relation (02 §7) — the only source of "selected". */
export type WorldTreeFocus = {
  world?: { ref?: string } | null;
  project?: { ref?: string } | null;
  subject?: { ref?: string } | null;
} | null;

/**
 * The World tree surface — the Cradle's main spatial view (01 §2).
 *
 * Everything rendered here is read from the landed WorldService readings:
 * `oi.world-tree/v1` for the tree, `oi.composition-reading/v1` for the live
 * composition. The tree renders those readings verbatim and owns no tree state
 * of its own: what counts as selected comes from the kernel's one focus
 * relation, never from a node's access facts (K2 review F-M2 — a fresh read
 * never projects selection).
 */
export function WorldTreeSurface({
  reading,
  composition,
  focus,
  error,
  busy = false,
  onOpen,
}: {
  reading?: WorldTreeReading | null;
  composition?: CompositionReading | null;
  focus?: WorldTreeFocus;
  error?: string | null;
  busy?: boolean;
  onOpen: (subject: TreeSubjectRef) => void;
}) {
  const model = buildWorldTreeModel(reading ?? undefined);
  const compositionModel = buildCompositionModel(composition ?? undefined);

  return (
    <div className="oi-world-tree" data-busy={busy}>
      <header className="oi-world-tree__head">
        <div className="oi-world-tree__identity">
          <strong>World</strong>
          {model?.root && <code>{model.root.ref}</code>}
          {model && <span className="oi-world-tree__provider" data-provider={model.provider.class}>{model.provider.class}</span>}
        </div>
        {model && (
          <p className="oi-world-tree__summary">
            {model.summary.projects} project{model.summary.projects === 1 ? '' : 's'}
            {' · '}{model.summary.sources} source{model.summary.sources === 1 ? '' : 's'}
            {model.summary.wikis > 0 && ` · ${model.summary.wikis} Wiki${model.summary.wikis === 1 ? '' : 's'}`}
          </p>
        )}
        {compositionModel && (
          <p className="oi-world-tree__composition" data-condition={compositionModel.condition}>
            {compositionModel.counts.present} present
            {' · '}{compositionModel.counts.degraded} degraded
            {' · '}{compositionModel.counts.absent} absent
          </p>
        )}
        {model && model.warnings.length > 0 && (
          <details className="oi-world-tree__warnings">
            <summary>{model.warnings.length} warning{model.warnings.length === 1 ? '' : 's'}</summary>
            <ul>{model.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
          </details>
        )}
      </header>

      {error && <p className="oi-world-tree__error" role="alert">{error}</p>}

      {!model && !error && (
        <p className="oi-world-tree__empty">
          No World tree reading. The tree is a projection the WorldService composes — without a reading there is no tree to walk.
        </p>
      )}

      {model?.root && (
        <ul className="oi-world-tree__root" role="tree" aria-label="World tree">
          <WorldTreeNodeRow node={model.root} focus={focus} depth={0} onOpen={onOpen} />
        </ul>
      )}
    </div>
  );
}

function WorldTreeNodeRow({
  node,
  focus,
  depth,
  onOpen,
}: {
  node: WorldTreeNodeModel;
  focus: WorldTreeFocus | undefined;
  depth: number;
  onOpen: (subject: TreeSubjectRef) => void;
}) {
  const focused = nodeIsFocused(node, focus ?? null);
  return (
    <li role="treeitem" aria-expanded={node.children.length > 0 ? true : undefined} className="oi-world-tree__item">
      <div className="oi-world-tree__row" data-focused={focused} data-depth={depth}>
        <button
          type="button"
          className="oi-world-tree__node"
          data-focused={focused}
          onClick={() => onOpen(subjectRefForNode(node))}
          title={focused ? `${node.ref} — focused by the kernel` : `Open ${node.ref}`}
        >
          <span className="oi-world-tree__ref">{node.ref}</span>
          {node.wiki && <span className="oi-world-tree__wiki" title={node.wiki.wiki_ref ?? node.wiki.profile}>wiki</span>}
          {node.ground && <span className="oi-world-tree__ground" data-present={node.ground.present}>{node.ground.native_owner}</span>}
          {node.sources.length > 0 && <span className="oi-world-tree__count">{node.sources.length}</span>}
        </button>
        {node.access_facts.length > 0 && (
          <span className="oi-world-tree__facts">{node.access_facts.join(' · ')}</span>
        )}
      </div>
      {node.sources.length > 0 && (
        <ul className="oi-world-tree__sources">
          {node.sources.map((source) => {
            const sourceFocused = sourceIsFocused(source, focus ?? null);
            return (
              <li key={source.ref} className="oi-world-tree__source-row" data-focused={sourceFocused}>
                <button
                  type="button"
                  className="oi-world-tree__source"
                  data-focused={sourceFocused}
                  onClick={() => onOpen(subjectRefForSource(source, node))}
                  title={sourceFocused ? `${source.ref} — focused by the kernel` : `Open ${source.ref}`}
                >
                  <span className="oi-world-tree__ref">{source.ref}</span>
                  <span className="oi-world-tree__treatment">{source.treatment}</span>
                </button>
                {source.access_facts.length > 0 && (
                  <span className="oi-world-tree__facts">{source.access_facts.join(' · ')}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {node.children.length > 0 && (
        <ul className="oi-world-tree__children" role="group">
          {node.children.map((child) => (
            <WorldTreeNodeRow key={child.ref} node={child} focus={focus} depth={depth + 1} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </li>
  );
}
