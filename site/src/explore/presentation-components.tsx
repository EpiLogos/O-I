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
  theme: {
    name?: string;
    tokens: Record<string, string>;
  };
  regions: PresentationRegion[];
  provenance: Array<Record<string, unknown>>;
};

type RendererProps = {
  binding: PresentationBinding;
  onOpenRef?: (ref: string) => void;
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

function Heading({ binding }: RendererProps) {
  const eyebrow = textProp(binding.props.eyebrow);
  const title = textProp(binding.props.title, textProp(binding.fallback.title, binding.component_ref));
  const copy = textProp(binding.props.copy, textProp(binding.fallback.text));
  return (
    <header className="world-component world-component--heading" data-component-ref={binding.component_ref}>
      {eyebrow ? <div className="world-component__eyebrow">{eyebrow}</div> : null}
      <h2>{title}</h2>
      {copy ? <p>{copy}</p> : null}
    </header>
  );
}

function Text({ binding }: RendererProps) {
  const title = textProp(binding.props.title, textProp(binding.fallback.title));
  const body = textProp(binding.props.text, textProp(binding.fallback.text));
  return (
    <article className="world-component world-component--text" data-component-ref={binding.component_ref}>
      {title ? <h3>{title}</h3> : null}
      <p>{body || 'No portable text representation is available.'}</p>
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
          const content = (
            <>
              <strong>{label}</strong>
              {description ? <span>{description}</span> : null}
            </>
          );
          if (ref && onOpenRef) {
            return (
              <button type="button" key={`${ref}:${index}`} onClick={() => onOpenRef(ref)}>
                {content}
              </button>
            );
          }
          if (href) {
            return (
              <a key={`${href}:${index}`} href={href} target="_blank" rel="noreferrer">
                {content}
              </a>
            );
          }
          return <div key={`${label}:${index}`}>{content}</div>;
        })}
      </div>
    </section>
  );
}

function WikiReading({ binding, onOpenRef }: RendererProps) {
  const title = textProp(binding.props.title, textProp(binding.fallback.title, 'Wiki reading'));
  const body = textProp(binding.props.text, textProp(binding.fallback.text));
  const refs = stringArray(binding.props.refs);
  return (
    <article className="world-component world-component--wiki" data-component-ref={binding.component_ref}>
      <div className="world-component__eyebrow">Wiki reading</div>
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {refs.length ? (
        <div className="world-component__refs">
          {refs.map((ref) => (
            <button type="button" key={ref} onClick={() => onOpenRef?.(ref)}>
              {ref}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function Link({ binding }: RendererProps) {
  const label = textProp(binding.props.label, textProp(binding.fallback.title, 'Open'));
  const copy = textProp(binding.props.copy, textProp(binding.fallback.text));
  const href = safeHref(binding.props.href);
  return (
    <article className="world-component world-component--link" data-component-ref={binding.component_ref}>
      <div>
        <strong>{label}</strong>
        {copy ? <span>{copy}</span> : null}
      </div>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" aria-label={`Open ${label}`}>
          ↗
        </a>
      ) : null}
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
      <div className="world-component__eyebrow">Portable fallback</div>
      <h3>{title}</h3>
      <p>{text}</p>
      <code>{binding.component_ref}</code>
    </article>
  );
}

export function presentationThemeStyle(presentation: WorldPresentation): CSSProperties {
  const tokens = presentation.theme.tokens;
  const style: Record<string, string> = {};
  const mapping: Record<string, string> = {
    surface: '--oi-surface',
    foreground: '--oi-foreground',
    muted: '--oi-muted',
    rule: '--oi-rule',
    relation: '--oi-relation',
    focus: '--oi-focus',
    projection: '--oi-projection',
    human: '--oi-human',
    agent: '--oi-agent',
  };
  for (const [token, variable] of Object.entries(mapping)) {
    if (tokens[token]) style[variable] = tokens[token];
  }
  return style as CSSProperties;
}

export function WorldPresentationRenderer({
  presentation,
  onOpenRef,
}: {
  presentation: WorldPresentation;
  onOpenRef?: (ref: string) => void;
}) {
  return (
    <article
      className="world-presentation"
      data-presentation-ref={presentation.presentation_ref}
      data-world-ref={presentation.world_ref}
      style={presentationThemeStyle(presentation)}
    >
      <header className="world-presentation__masthead">
        <div>
          <div className="world-component__eyebrow">Projected world</div>
          <h1>{presentation.title}</h1>
        </div>
        <div className="world-presentation__revision">presentation {presentation.revision}</div>
        {presentation.summary ? <p>{presentation.summary}</p> : null}
      </header>

      {presentation.regions.map((region) => (
        <section key={region.region_ref} className="world-region" data-region-role={region.role}>
          {region.label ? <div className="world-region__label">{region.label}</div> : null}
          <div className="world-region__components">
            {region.bindings.map((binding) => {
              const rendererKey = binding.portable_renderer ?? binding.component_ref;
              const Renderer = portablePresentationRenderers[rendererKey] ?? Fallback;
              return <Renderer key={binding.binding_ref} binding={binding} onOpenRef={onOpenRef} />;
            })}
          </div>
        </section>
      ))}
    </article>
  );
}
