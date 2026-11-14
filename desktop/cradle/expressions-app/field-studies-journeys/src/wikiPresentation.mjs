/** Display only: exact source refs and authored labels never become geometry. */
export function wikiDisplayName(title, ref = '') {
  const label = typeof title === 'string' ? title.trim() : '';
  const address = label || ref;
  if (label && label !== ref && !/^(?:\/|~\/|(?:wiki|central|source|project):)/.test(label)) return label;
  let leaf = address.replace(/[\/]+$/, '').split(/[\/]/).pop() || address;
  if (!address.includes('/')) leaf = leaf.split(':').pop() || leaf;
  try { leaf = decodeURIComponent(leaf); } catch { /* A malformed escape is still source text. */ }
  return leaf.replace(/\.(?:md|markdown|json|html?|txt)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Wiki subject';
}
/** Recognise only the exact old generated fallback. Explicit native material wins.
 * This computes a view; it never mutates the document, provenance or source. */
export function generatedWikiAppearance(document, entity) {
  if (!document?.expression_ref?.startsWith('expression:techne-m0.')
      || !document.provenance?.some(p => /^wiki:.*(?:^|\/)wiki\.json$/.test(p.ref))
      || entity?.subject?.native_owner !== 'wiki' || entity.revision !== 1) return null;
  const p = entity.parameters || {};
  if (p.shape || p.kind || p.ascii || p.image || p.glyph?.value !== entity.title.slice(0, 120)) return null;
  const allowed = new Set(['x','y','z','scale','glyph']);
  if (Object.keys(p).some(key => !allowed.has(key)) || Object.values(p).some(value => value.automation)) return null;
  return {title: wikiDisplayName(entity.title, entity.subject.subject_ref), shape: 'disc'};
}
