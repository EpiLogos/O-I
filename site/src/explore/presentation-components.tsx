import type { CSSProperties, ReactNode } from 'react';

export type PresentationBinding = {
  binding_ref: string;
  component_ref: string;
  contribution_ref?: string;
  surface_ref?: string;
  projection_ref?: string;
  subject_ref?: string;
  portable_renderer?: string;
  props: Record<string, unknown>;
  fallback: Record<string, unknown>;
  provenance: Array<Record<string, unknown>>;
};

export type PresentationRegion = {
  region_ref: string;
  role: string;
  label?: string;
  bindings: PresentationBinding[];
};

export type WorldPresentation = {
  schema: 'oi.world-presentation/v1';
  presentation_ref: string;
  world_ref: string;
  revision: number;
  title: string;
  summary?: string;
  theme: { name?: string; tokens: Record<string, string> };
  regions: PresentationRegion[];
  provenance: Array<Record<string, unknown>>;
};

type RendererProps = {
  binding: PresentationBinding;
  onOpenRef?: (ref: string) => void;
  authoring?: boolean;
  onEditProps?: (bindingRef: string, patch: Record<string, unknown>) => void;
};

type Renderer = (props: RendererProps) => ReactNode;

function textProp(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function safeHref(value: unknown) {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? value : undefined;
  } catch {
    return undefined;
  }
}

function editableText(
  authoring: boolean | undefined,
  value: string,
  onCommit: (value: string) => void,
  className?: string,
) {
  if (!authoring) return value;
  return (
    <span
      className={className ? `${className} world-editable` : 'world-editable'}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      onBlur={(event) => onCommit(event.currentTarget.textContent ?? '')}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') event.currentTarget.blur();
      }}
    >
      {value}
    </span>
  );
}

function Heading({ binding, authoring, onEditProps }: RendererProps) {
  const eyebrow = textProp(binding.props.eyebrow);
  const title = textProp(binding.props.title, textProp(binding.fallback.title, binding.component_ref));
  const copy = textProp(binding.props.copy, textProp(binding.fallback.text));
  return (
    <header className="world-component world-component--heading" data-component-ref={binding.component_ref}>
      {eyebrow ? <div className="world-component__eyebrow">{eyebrow}</div> : null}
      <h2>{editableText(authoring, title, (value) => onEditProps?.(binding.binding_ref, { title: value }))}</h2>
      {copy || authoring ? <p>{editableText(authoring, copy, (value) => onEditProps?.(binding.binding_ref, { copy: value }))}</p> : null}
    </header>
  );
}

function Text({ binding, authoring, onEditProps }: RendererProps) {
  const title = textProp(binding.props.title, textProp(binding.fallback.title));
  const body = textProp(binding.props.text, textProp(binding.fallback.text));
  return (
    <article className="world-component world-component--text" data-component-ref={binding.component_ref}>
      {title || authoring ? <h3>{editableText(authoring, title, (value) => onEditProps?.(binding.binding_ref, { title: value }))}</h3> : null}
      <p>{editableText(authoring, body || 'No portable text representation is available.', (value) => onEditProps?.(binding.binding_ref, { text: value }))}</p>
    </article>
  );
}

function Collection({ binding, onOpenRef }: RendererProps) {
  const title = textProp(binding.props.title, textProp(binding.fallback.title, 'Selection'));
  const rawItems = Array.isArray(binding.props.items) ? binding.props.items : [];
  return (
    <section className="world-component world-component--collection" data-component-ref={binding.component_ref}>
      <h3>{title}</h3>
      <div className="world-component__collection">
        {rawItems.map((value, index) => {
          const item = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
          const label = textProp(item.label, textProp(item.ref, `Item ${index + 1}`));
          const ref = textProp(item.ref);
          const href = safeHref(item.href);
          const description = textProp(item.description);
          const content = <><strong>{label}</strong>{description ? <span>{description}</span> : null}</>;
          if (ref && onOpenRef) return <button type="button" key={`${ref}:${index}`} onClick={() => onOpenRef(ref)}>{content}</button>;
          if (href) return <a key={`${href}:${index}`} href={href} target="_blank" rel="noreferrer">{content}</a>;
          return <div key={`${label}:${index}`}>{content}</div>;
        })}
      </div>
    </section>
  );
}

function WikiReading({ binding, onOpenRef, authoring, onEditProps }: RendererProps) {
  const title = textProp(binding.props.title, textProp(binding.fallback.title, 'Wiki reading'));
  const body = textProp(binding.props.text, textProp(binding.fallback.text));
  const refs = stringArray(binding.props.refs);
  return (
    <article className="world-component world-component--wiki" data-component-ref={binding.component_ref}>
      <div className="world-component__eyebrow">Wiki reading</div>
      <h3>{editableText(authoring, title, (value) => onEditProps?.(binding.binding_ref, { title: value }))}</h3>
      {body || authoring ? <p>{editableText(authoring, body, (value) => onEditProps?.(binding.binding_ref, { text: value }))}</p> : null}
      {refs.length ? <div className="world-component__refs">{refs.map((ref) => <button type="button" key={ref} onClick={() => onOpenRef?.(ref)}>{ref}</button>)}</div> : null}
    </article>
  );
}

function Link({ binding }: RendererProps) {
  const label = textProp(binding.props.label, textProp(binding.fallback.title, 'Open'));
  const copy = textProp(binding.props.copy, textProp(binding.fallback.text));
  const href = safeHref(binding.props.href);
  return (
    <article className="world-component world-component--link" data-component-ref={binding.component_ref}>
      <div><strong>{label}</strong>{copy ? <span>{copy}</span> : null}</div>
      {href ? <a href={href} target="_blank" rel="noreferrer" aria-label={`Open ${label}`}>↗</a> : null}
    </article>
  );
}

export const portablePresentationRenderers: Record<string, Renderer> = {
  'oi.presentation/heading/v1': Heading,
  'oi.presentation/text/v1': Text,
  'oi.presentation/collection/v1': Collection,
  'oi.presentation/wiki-reading/v1': WikiReading,
  'oi.presentation/link/v1': Link,
};

function Fallback({ binding }: RendererProps) {
  const title = textProp(binding.fallback.title, binding.component_ref);
  const text = textProp(binding.fallback.text, 'This component is not available on the current Surface.');
  return (
    <article className="world-component world-component--fallback" data-component-ref={binding.component_ref}>
      <div className="world-component__eyebrow">Portable fallback</div><h3>{title}</h3><p>{text}</p><code>{binding.component_ref}</code>
    </article>
  );
}

export function presentationThemeStyle(presentation: WorldPresentation): CSSProperties {
  const style: Record<string, string> = {};
  const mapping: Record<string, string> = {
    surface: '--oi-surface', foreground: '--oi-foreground', muted: '--oi-muted', rule: '--oi-rule', relation: '--oi-relation',
    focus: '--oi-focus', projection: '--oi-projection', human: '--oi-human', agent: '--oi-agent',
  };
  for (const [token, variable] of Object.entries(mapping)) if (presentation.theme.tokens[token]) style[variable] = presentation.theme.tokens[token];
  return style as CSSProperties;
}

export function WorldPresentationRenderer({
  presentation,
  onOpenRef,
  authoring = false,
  selectedBindingRef,
  selectedRegionRef,
  onSelectBinding,
  onSelectRegion,
  onEditProps,
  onInsert,
  onMoveBinding,
  onDuplicateBinding,
  onRemoveBinding,
}: {
  presentation: WorldPresentation;
  onOpenRef?: (ref: string) => void;
  authoring?: boolean;
  selectedBindingRef?: string | null;
  selectedRegionRef?: string | null;
  onSelectBinding?: (bindingRef: string, regionRef: string) => void;
  onSelectRegion?: (regionRef: string) => void;
  onEditProps?: (bindingRef: string, patch: Record<string, unknown>) => void;
  onInsert?: (regionRef: string, index: number) => void;
  onMoveBinding?: (bindingRef: string, regionRef: string, index: number) => void;
  onDuplicateBinding?: (bindingRef: string) => void;
  onRemoveBinding?: (bindingRef: string) => void;
}) {
  return (
    <article className={authoring ? 'world-presentation world-presentation--authoring' : 'world-presentation'} data-presentation-ref={presentation.presentation_ref} data-world-ref={presentation.world_ref} style={presentationThemeStyle(presentation)}>
      <header className="world-presentation__masthead">
        <div><div className="world-component__eyebrow">Projected world</div><h1>{presentation.title}</h1></div>
        <div className="world-presentation__revision">presentation {presentation.revision}</div>
        {presentation.summary ? <p>{presentation.summary}</p> : null}
      </header>
      {presentation.regions.map((region) => (
        <section
          key={region.region_ref}
          className={selectedRegionRef === region.region_ref ? 'world-region world-region--selected' : 'world-region'}
          data-region-ref={region.region_ref}
          data-region-role={region.role}
          onClick={(event) => { if (authoring && event.target === event.currentTarget) onSelectRegion?.(region.region_ref); }}
        >
          {region.label ? <div className="world-region__label">{region.label}</div> : null}
          {authoring ? <button type="button" className="world-insert" onClick={() => onInsert?.(region.region_ref, 0)} aria-label={`Insert at start of ${region.label ?? region.role}`}>＋</button> : null}
          <div className="world-region__components">
            {region.bindings.map((binding, index) => {
              const rendererKey = binding.portable_renderer ?? binding.component_ref;
              const Renderer = portablePresentationRenderers[rendererKey] ?? Fallback;
              const selected = selectedBindingRef === binding.binding_ref;
              return (
                <div
                  key={binding.binding_ref}
                  className={selected ? 'world-binding world-binding--selected' : 'world-binding'}
                  data-binding-ref={binding.binding_ref}
                  data-component-ref={binding.component_ref}
                  data-contribution-ref={binding.contribution_ref}
                  data-surface-ref={binding.surface_ref}
                  onClick={(event) => { if (authoring) { event.stopPropagation(); onSelectBinding?.(binding.binding_ref, region.region_ref); } }}
                >
                  {authoring && selected ? (
                    <div className="world-binding__tools" role="toolbar" aria-label="Selected presentation binding">
                      <button type="button" onClick={(event) => { event.stopPropagation(); onMoveBinding?.(binding.binding_ref, region.region_ref, Math.max(0, index - 1)); }} disabled={index === 0}>↑</button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); onMoveBinding?.(binding.binding_ref, region.region_ref, index + 1); }} disabled={index === region.bindings.length - 1}>↓</button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); onDuplicateBinding?.(binding.binding_ref); }}>Duplicate</button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); onRemoveBinding?.(binding.binding_ref); }}>Remove</button>
                    </div>
                  ) : null}
                  <Renderer binding={binding} onOpenRef={onOpenRef} authoring={authoring} onEditProps={onEditProps} />
                  {authoring ? <button type="button" className="world-insert world-insert--after" onClick={(event) => { event.stopPropagation(); onInsert?.(region.region_ref, index + 1); }} aria-label={`Insert after ${binding.binding_ref}`}>＋</button> : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </article>
  );
}
