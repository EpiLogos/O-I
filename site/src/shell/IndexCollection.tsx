import { PRODUCTS, type Item } from './content';

/** Presentation follows the supplied information; no new copy or taxonomy. */
export function collectionKind(items: Item[]): 'offices' | 'sequence' | 'atlas' {
  if (items.length === PRODUCTS.length && items.every(item => PRODUCTS.some(product => product.name === item.name))) return 'offices';
  return items.every(item => !item.detail) ? 'sequence' : 'atlas';
}

export function IndexCollection({ items }: { items: Item[] }) {
  const kind = collectionKind(items);
  if (kind === 'offices') {
    return <ul className="office-grid">{items.map((item, index) => {
      const product = PRODUCTS.find(entry => entry.name === item.name)!;
      return <li className="office-tile" key={item.name}>
        <a className="office-tile__link" href={product.repo} target="_blank" rel="noreferrer">
          <span className="office-tile__head" aria-hidden="true">
            <span className="collection-index">{String(index + 1).padStart(2, '0')}</span>
            <span className="office-tile__locator">{items.map((_, dot) => <i key={dot} className={dot === index ? 'is-current' : undefined} />)}</span>
            <span className="office-tile__arrow">↗</span>
          </span>
          <span className="office-tile__copy">
            <strong className="sec__cell-name">{item.name}</strong>
            {item.detail && <span className="sec__detail">{item.detail}</span>}
          </span>
          <span className="sr-only"> (opens native centre in a new tab)</span>
        </a>
      </li>;
    })}</ul>;
  }
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
