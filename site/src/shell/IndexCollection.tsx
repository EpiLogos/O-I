import type { FacetSet, Item } from './content';

/** Presentation follows the supplied information; no new copy or taxonomy. */
export function collectionKind(items: Item[]): 'sequence' | 'atlas' {
  return items.every(item => !item.detail) ? 'sequence' : 'atlas';
}

function GitHubGlyph() {
  return <svg className="facet__glyph" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
  </svg>;
}

/** The note names the README in its own words; that phrase becomes the link. */
function Note({ set }: { set: FacetSet }) {
  const at = set.note.indexOf(set.readme.label);
  const link = <a className="sec__link" href={set.readme.href} target="_blank" rel="noreferrer">
    {set.readme.label}<span className="sec__arrow" aria-hidden="true"> ↗</span><span className="sr-only"> (opens in a new tab)</span>
  </a>;
  return <p className="facets__note">
    {at === -1 ? <>{set.note} {link}</> : <>{set.note.slice(0, at)}{link}{set.note.slice(at + set.readme.label.length)}</>}
  </p>;
}

/** The six facets of an agent's world, each with the product that holds it:
 * the facet's name and line, then the product, its command and its repository. */
export function FacetField({ set }: { set: FacetSet }) {
  return <div className="facets">
    <ul className="facets__grid" aria-label={set.label}>
      {set.facets.map(facet => <li className="facet" key={facet.id} data-product={facet.id}>
        <h3 className="facet__role">{facet.role}</h3>
        <p className="facet__line">{facet.line}</p>
        <div className="facet__holder">
          <a className="facet__product" href={facet.repo} target="_blank" rel="noreferrer">
            <GitHubGlyph />{facet.product}<span className="sr-only"> on GitHub (opens in a new tab)</span>
          </a>
          <code className="facet__cli"><span className="facet__prompt" aria-hidden="true">$</span>{facet.cli}</code>
        </div>
      </li>)}
    </ul>
    <Note set={set} />
  </div>;
}

export function IndexCollection({ items }: { items: Item[] }) {
  const kind = collectionKind(items);
  if (kind === 'sequence') {
    return <ol className="method-sequence">{items.map((item, index) => (
      <li className="method-step" key={item.name}>
        <span className="method-step__track" aria-hidden="true">
          <span className="collection-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="method-step__line" />
          <span className="method-step__arrow">{index === items.length - 1 ? '↶' : '→'}</span>
        </span>
        <strong className="sec__cell-name">{item.name}</strong>
      </li>
    ))}</ol>;
  }
  return <ul className="resource-atlas">{items.map((item, index) => (
    <li className="resource-atlas__entry" key={item.name}>
      <span className="collection-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <strong className="sec__cell-name">{item.name}</strong>
      {item.detail && (/^https?:\/\//.test(item.detail)
        ? <a className="sec__detail sec__link" href={item.detail} target="_blank" rel="noreferrer">
            {item.detail.replace('https://github.com/', '')}<span className="sec__arrow" aria-hidden="true"> ↗</span><span className="sr-only"> (opens in a new tab)</span>
          </a>
        : <span className="sec__detail">{item.detail}</span>)}
    </li>
  ))}</ul>;
}
