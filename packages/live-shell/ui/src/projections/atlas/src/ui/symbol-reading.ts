import type { Model } from '../data/model';
import { el } from './dom';

/** Both surfaces identify the source and retain its printed-page provenance. */
export function symbolReading(model: Model, familyId: string, onFamily: (id: string) => void, compact = false): HTMLElement | null {
  const entry = model.symbols.get(familyId);
  const source = model.symbolSource;
  if (!entry || !source) return null;
  // [C2-b8] the source label is the symbols bundle's own title from its data
  // (was the literal 'The Book of Symbols'), in the heading and the aria-label
  const section = el(compact ? 'details' : 'section', { class: `symbol-reading ${compact ? 'symbol-compact' : ''}`, 'aria-label': `${source.title} reading` });
  section.append(el(compact ? 'summary' : 'h3', { class: compact ? 'symbol-summary' : 'dp-sub', text: source.title }),
    el('p', { class: 'symbol-source', text: `${entry.title} · ${entry.pages.length > 1 ? 'pp.' : 'p.'} ${entry.pages.join(', ')} · ${source.year}` }));
  for (const text of entry.body) section.append(el('p', { class: compact ? 'rv-para' : 'dp-para', text }));
  if (entry.resonances.length) {
    const links = el('p', { class: 'symbol-links' }, [el('span', { text: 'Related symbols · ' })]);
    for (const id of entry.resonances) {
      const family = model.famById.get(id);
      if (!family) continue;
      links.append(el('button', { type: 'button', class: 'link-quiet', text: family.name, onclick: () => onFamily(id) }), ' ');
    }
    section.append(links);
  }
  section.append(el('p', { class: 'symbol-source', text: `${source.title} · edited by ${source.editor}` }));
  return section;
}
