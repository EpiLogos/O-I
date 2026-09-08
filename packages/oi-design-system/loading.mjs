/** Renderer-neutral DOM body. Host owns lifecycle, authority, focus and inertness.
 * No timers, synthetic progress, owner IO or minimum display duration. */
export function createLoadingIndicator({label, detail = '', scope = 'inline', active = true, document: doc = globalThis.document} = {}) {
  if (!doc) throw new Error('A DOM document is required');
  if (typeof label !== 'string' || !label.trim()) throw new TypeError('A truthful loading label is required');
  if (!['inline', 'surface', 'window'].includes(scope)) throw new TypeError('Unknown loading scope');
  const element = doc.createElement('div');
  element.className = 'oi-loading';
  element.dataset.scope = scope;
  element.dataset.active = String(Boolean(active));
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  element.setAttribute('aria-atomic', 'true');
  const mark = doc.createElement('span');
  mark.className = 'oi-loading-mark';
  mark.setAttribute('aria-hidden', 'true');
  const fallback = doc.createElement('span');
  fallback.className = 'oi-loading-fallback';
  fallback.setAttribute('aria-hidden', 'true');
  fallback.textContent = '{O:I}';
  const copy = doc.createElement('div');
  copy.className = 'oi-loading-copy';
  const heading = doc.createElement('p');
  heading.className = 'oi-loading-label';
  const description = doc.createElement('p');
  description.className = 'oi-loading-detail';
  copy.append(heading, description);
  element.append(mark, fallback, copy);
  function update(next = {}) {
    if (next.label !== undefined) {
      if (typeof next.label !== 'string' || !next.label.trim()) throw new TypeError('A truthful loading label is required');
      heading.textContent = next.label;
    }
    if (next.detail !== undefined) { description.textContent = String(next.detail); description.hidden = !next.detail; }
    if (next.active !== undefined) element.dataset.active = String(Boolean(next.active));
  }
  update({label, detail});
  return {element, update, remove: () => element.remove()};
}

/** Decorative general cluster body. Keep an adjacent accessible operation label. */
export function createPointClusters({active = false, document: doc = globalThis.document} = {}) {
  if (!doc) throw new Error('A DOM document is required');
  const element = doc.createElement('span');
  element.className = 'oi-point-clusters';
  element.dataset.active = String(Boolean(active));
  element.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i++) element.append(doc.createElement('span'));
  return {element, setActive: value => {element.dataset.active = String(Boolean(value));}, remove: () => element.remove()};
}
