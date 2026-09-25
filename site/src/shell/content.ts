import { getPage, getSection, getChild, getTitle, getBody } from '../lib/public-content';

export type Item = { name: string; detail?: string };

const ids = ['central', 'actuation', 'aikit', 'factory', 'workcell', 'ql'];
export const PRODUCTS = ids.map(id => {
  const p = getSection('products', id);
  return {
    id,
    name: p.title,
    office: getChild(p, 'lede').title,
    repo: getBody(p, 'repo'),
    what: getBody(p, 'what'),
    change: getBody(p, 'change'),
  };
});

/** Published expressions. Matches publicationHref() with no subject selected. */
export const LIBRARY_HREF = '#/library?published=1';
/** The essay is a sibling of this public entrance, not a hash route inside it. */
export const ESSAY_HREF = './essay/';

const entrance = getSection('home', 'entrance');

function door(id: 'library' | 'essay', href: string) {
  const node = getChild(entrance, id);
  return {
    index: id === 'library' ? '01' : '02',
    label: node.title,
    href,
    body: node.body,
    accessibleName: id === 'essay' ? getTitle(entrance, 'essay-title') : '',
  };
}

export const ENTRANCE = {
  eyebrow: getTitle(entrance, 'eyebrow'),
  title: [getTitle(entrance, 'line-one'), getTitle(entrance, 'line-two')] as const,
  lede: getBody(entrance, 'lede'),
  doors: [door('library', LIBRARY_HREF), door('essay', ESSAY_HREF)],
  coming: getBody(entrance, 'coming'),
  brand: getTitle(entrance, 'brand'),
  essayTitle: getTitle(entrance, 'essay-title'),
};

export const PUBLIC_PAGE_IDS = getPage('products').children.filter(n => ids.includes(n.id)).map(n => n.id);
