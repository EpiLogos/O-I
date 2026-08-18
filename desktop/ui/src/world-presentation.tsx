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
};

type Renderer = (props: RendererProps) => ReactNode;

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function records(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
    : [];
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
  const eyebrow = text(binding.props.eyebrow);
  const title = text(binding.props.title, text(binding.fallback.title, binding.component_ref));
  const copy = text(binding.props.copy, text(binding.fallback.text));
  return <header className="world-component world-component--heading" data-component-ref={binding.component_ref}>{eyebrow ? <div className="world-component__eyebrow">{eyebrow}</div> : null}<h2>{title}</h2>{copy ? <p>{copy}</p> : null}</header>;
}

function Text({ binding }: RendererProps) {
  const title = text(binding.props.title, text(binding.fallback.title));
  const body = text(binding.props.text, text(binding.fallback.text, 'No portable text representation is available.'));
  return <article className="world-component world-component--text" data-component-ref={binding.component_ref}>{title ? <h3>{title}</h3> : null}<p>{body}</p></article>;
}

function Lede({ binding }: RendererProps) {
  const title = text(binding.props.title, text(binding.fallback.title));
  const body = text(binding.props.text, text(binding.fallback.text));
  return <header className="world-component world-component--heading" data-component-ref={binding.component_ref}><div className="world-component__eyebrow">Account reading</div>{title ? <h2>{title}</h2> : null}{body ? <p>{body}</p> : null}</header>;
}

function Distinction({ binding }: RendererProps) {
  const title = text(binding.props.title, text(binding.fallback.title, 'Distinction'));
  const body = text(binding.props.text, text(binding.fallback.text));
  return <article className="world-component world-component--text" data-component-ref={binding.component_ref}><div className="world-component__eyebrow">{text(binding.props.standing, 'Key distinction')}</div><h3>{title}</h3>{body ? <p>{body}</p> : null}</article>;
}

function Collection({ binding, onOpenRef }: RendererProps) {
  const title = text(binding.props.title, text(binding.fallback.title, 'Selection'));
  const items = Array.isArray(binding.props.items) ? binding.props.items : [];
  return <section className="world-component world-component--collection" data-component-ref={binding.component_ref}><h3>{title}</h3><div className="world-component__collection">{items.map((value, index) => {
    const item = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
    const label = text(item.label, text(item.ref, `Item ${index + 1}`));
    const description = text(item.description);
    const ref = text(item.ref);
    const href = safeHref(item.href);
    const content = <><strong>{label}</strong>{description ? <span>{description}</span> : null}</>;
    if (ref && onOpenRef) return <button type="button" key={`${ref}:${index}`} onClick={() => onOpenRef(ref)}>{content}</button>;
    if (href) return <a key={`${href}:${index}`} href={href} target="_blank" rel="noreferrer">{content}</a>;
    return <div key={`${label}:${index}`}>{content}</div>;
  })}</div></section>;
}

function ReferenceCard({ binding, onOpenRef }: RendererProps) {
  const title = text(binding.props.title, text(binding.fallback.title, 'Related material'));
  const body = text(binding.props.text, text(binding.fallback.text));
  const refs = strings(binding.props.refs);
  return <section className="world-component world-component--collection" data-component-ref={binding.component_ref}><h3>{title}</h3>{body ? <p>{body}</p> : null}{refs.length ? <div className="world-component__refs">{refs.map((ref) => <button type="button" key={ref} onClick={() => onOpenRef?.(ref)}>{ref}</button>)}</div> : null}</section>;
}

function WikiReading({ binding, onOpenRef }: RendererProps) {
  const title = text(binding.props.title, text(binding.fallback.title, 'Wiki reading'));
  const body = text(binding.props.text, text(binding.fallback.text));
  const refs = strings(binding.props.refs);
  return <article className="world-component world-component--wiki" data-component-ref={binding.component_ref}><div className="world-component__eyebrow">Wiki reading</div><h3>{title}</h3>{body ? <p>{body}</p> : null}{refs.length ? <div className="world-component__refs">{refs.map((ref) => <button type="button" key={ref} onClick={() => onOpenRef?.(ref)}>{ref}</button>)}</div> : null}</article>;
}

function ClaimEvidence({ binding }: RendererProps) {
  const evidence = strings(binding.props.evidence);
  return <article className="world-component world-component--text" data-component-ref={binding.component_ref}><div className="world-component__eyebrow">{text(binding.props.standing, 'Claim / evidence')}</div><h3>{text(binding.props.title, text(binding.fallback.title, 'Claim and evidence'))}</h3>{text(binding.props.claim, text(binding.fallback.text)) ? <p>{text(binding.props.claim, text(binding.fallback.text))}</p> : null}{evidence.length ? <ul>{evidence.map((item) => <li key={item}>{item}</li>)}</ul> : null}</article>;
}

function Timeline({ binding }: RendererProps) {
  const items = records(binding.props.items);
  return <section className="world-component world-component--text" data-component-ref={binding.component_ref}><h3>{text(binding.props.title, text(binding.fallback.title, 'History'))}</h3>{items.length ? <ol>{items.map((item, index) => {
    const label = text(item.label, text(item.time, `Step ${index + 1}`));
    const copy = text(item.text, text(item.description));
    return <li key={`${label}:${index}`}><strong>{label}</strong>{copy ? ` — ${copy}` : ''}</li>;
  })}</ol> : <p>{text(binding.fallback.text, 'No timeline items are available.')}</p>}</section>;
}

function Diagram({ binding }: RendererProps) {
  const relations = strings(binding.props.relations);
  return <figure className="world-component world-component--text" data-component-ref={binding.component_ref}><div className="world-component__eyebrow">Diagram reading</div><h3>{text(binding.props.title, text(binding.fallback.title, 'Diagram'))}</h3>{relations.length ? <div className="world-component__collection">{relations.map((relation) => <div key={relation}>{relation}</div>)}</div> : null}{text(binding.props.description, text(binding.fallback.text)) ? <figcaption>{text(binding.props.description, text(binding.fallback.text))}</figcaption> : null}</figure>;
}

function Comparison({ binding }: RendererProps) {
  const rows = records(binding.props.rows);
  return <section className="world-component world-component--collection" data-component-ref={binding.component_ref}><h3>{text(binding.props.title, text(binding.fallback.title, 'Comparison'))}</h3><div className="world-component__collection">{rows.map((row, index) => {
    const label = text(row.label, text(row.name, `Item ${index + 1}`));
    const value = text(row.value, text(row.text));
    return <div key={`${label}:${index}`}><strong>{label}</strong>{value ? <span>{value}</span> : null}</div>;
  })}</div></section>;
}

function CodeSchema({ binding }: RendererProps) {
  return <article className="world-component world-component--text" data-component-ref={binding.component_ref}><div className="world-component__eyebrow">{text(binding.props.language, 'Code / schema')}</div><h3>{text(binding.props.title, text(binding.fallback.title, 'Code / schema'))}</h3><pre><code>{text(binding.props.code, text(binding.fallback.text))}</code></pre></article>;
}

function ImageFigure({ binding }: RendererProps) {
  const title = text(binding.props.title, text(binding.fallback.title, 'Image'));
  const src = safeHref(binding.props.src);
  const caption = text(binding.props.caption, text(binding.fallback.text));
  return <figure className="world-component world-component--text" data-component-ref={binding.component_ref}><h3>{title}</h3>{src ? <img src={src} alt={text(binding.props.alt, title)} loading="lazy" /> : null}{caption ? <figcaption>{caption}</figcaption> : null}</figure>;
}

function Mockup({ binding }: RendererProps) {
  const body = text(binding.props.text, text(binding.props.description, text(binding.fallback.text)));
  return <section className="world-component world-component--text" data-component-ref={binding.component_ref}><div className="world-component__eyebrow">Interface / mockup</div><h3>{text(binding.props.title, text(binding.fallback.title, 'Mockup'))}</h3><div className="world-component__collection"><div>{body}</div></div></section>;
}

function Source({ binding }: RendererProps) {
  const title = text(binding.props.title, text(binding.fallback.title, 'Source'));
  const copy = text(binding.props.text, text(binding.fallback.text));
  const href = safeHref(binding.props.href);
  return <article className="world-component world-component--link" data-component-ref={binding.component_ref}><div><strong>{title}</strong>{copy ? <span>{copy}</span> : null}</div>{href ? <a href={href} target="_blank" rel="noreferrer" aria-label={`Open ${title}`}>↗</a> : null}</article>;
}

function Action({ binding, onOpenRef }: RendererProps) {
  const label = text(binding.props.label, text(binding.props.title, text(binding.fallback.title, 'Open')));
  const ref = text(binding.props.ref, text(binding.subject_ref));
  const href = safeHref(binding.props.href);
  return <article className="world-component world-component--link" data-component-ref={binding.component_ref}><div><strong>{label}</strong>{text(binding.fallback.text) ? <span>{text(binding.fallback.text)}</span> : null}</div>{ref && onOpenRef ? <button type="button" onClick={() => onOpenRef(ref)}>Open</button> : href ? <a href={href} target="_blank" rel="noreferrer">↗</a> : null}</article>;
}

function Link({ binding }: RendererProps) {
  const label = text(binding.props.label, text(binding.fallback.title, 'Open'));
  const copy = text(binding.props.copy, text(binding.fallback.text));
  const href = safeHref(binding.props.href);
  return <article className="world-component world-component--link" data-component-ref={binding.component_ref}><div><strong>{label}</strong>{copy ? <span>{copy}</span> : null}</div>{href ? <a href={href} target="_blank" rel="noreferrer" aria-label={`Open ${label}`}>↗</a> : null}</article>;
}

function Fallback({ binding }: RendererProps) {
  return <article className="world-component world-component--fallback" data-component-ref={binding.component_ref}><div className="world-component__eyebrow">Portable fallback</div><h3>{text(binding.fallback.title, binding.component_ref)}</h3><p>{text(binding.fallback.text, 'This component is not available on the current Surface.')}</p><code>{binding.component_ref}</code></article>;
}

const renderers: Record<string, Renderer> = {
  'oi.presentation/heading/v1': Heading,
  'oi.presentation/text/v1': Text,
  'oi.presentation/collection/v1': Collection,
  'oi.presentation/wiki-reading/v1': WikiReading,
  'oi.presentation/link/v1': Link,
  'oi.presentation/lede/v1': Lede,
  'oi.presentation/prose/v1': Text,
  'oi.presentation/distinction/v1': Distinction,
  'oi.presentation/diagram/v1': Diagram,
  'oi.presentation/source/v1': Source,
  'oi.presentation/claim-evidence/v1': ClaimEvidence,
  'oi.presentation/timeline/v1': Timeline,
  'oi.presentation/comparison/v1': Comparison,
  'oi.presentation/code-schema/v1': CodeSchema,
  'oi.presentation/image/v1': ImageFigure,
  'oi.presentation/mockup/v1': Mockup,
  'oi.presentation/wiki-excerpt/v1': WikiReading,
  'oi.presentation/reference-card/v1': ReferenceCard,
  'oi.presentation/run-history/v1': Timeline,
  'oi.presentation/action/v1': Action,
};

function presentationThemeStyle(presentation: WorldPresentation): CSSProperties {
  const style: Record<string, string> = {};
  const mapping: Record<string, string> = {
    surface: '--oi-surface', foreground: '--oi-foreground', muted: '--oi-muted', rule: '--oi-rule', relation: '--oi-relation',
    focus: '--oi-focus', projection: '--oi-projection', human: '--oi-human', agent: '--oi-agent',
  };
  for (const [token, variable] of Object.entries(mapping)) if (presentation.theme.tokens[token]) style[variable] = presentation.theme.tokens[token];
  return style as CSSProperties;
}

export function WorldPresentationRenderer({ presentation, onOpenRef }: { presentation: WorldPresentation; onOpenRef?: (ref: string) => void }) {
  return <article className="world-presentation" data-presentation-ref={presentation.presentation_ref} data-world-ref={presentation.world_ref} style={presentationThemeStyle(presentation)}>
    <header className="world-presentation__masthead"><div><div className="world-component__eyebrow">Projected world</div><h1>{presentation.title}</h1></div><div className="world-presentation__revision">presentation {presentation.revision}</div>{presentation.summary ? <p>{presentation.summary}</p> : null}</header>
    {presentation.regions.map((region) => <section key={region.region_ref} className="world-region" data-region-ref={region.region_ref} data-region-role={region.role}>{region.label ? <div className="world-region__label">{region.label}</div> : null}<div className="world-region__components">{region.bindings.map((binding) => {
      const Renderer = renderers[binding.portable_renderer ?? binding.component_ref] ?? Fallback;
      return <div key={binding.binding_ref} className="world-binding" data-binding-ref={binding.binding_ref} data-component-ref={binding.component_ref} data-contribution-ref={binding.contribution_ref} data-surface-ref={binding.surface_ref}><Renderer binding={binding} onOpenRef={onOpenRef} /></div>;
    })}</div></section>)}
  </article>;
}
