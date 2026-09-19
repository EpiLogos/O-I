/** The same buttons serve desktop and compact layouts, retaining their live state. */
export function installHeaderMenus(root: HTMLElement) {
  const clusters = [...root.querySelectorAll<HTMLElement>('.header-cluster')];
  const trigger = (cluster: HTMLElement) => cluster.querySelector<HTMLButtonElement>('.header-menu-toggle')!;
  const close = (cluster: HTMLElement, restoreFocus = false) => {
    cluster.classList.remove('is-open');
    trigger(cluster).setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger(cluster).focus();
  };
  for (const cluster of clusters) {
    const button = trigger(cluster);
    const media = matchMedia(`(max-width: ${cluster.dataset.compactAt}px)`);
    const focusFirst = () => cluster.querySelector<HTMLButtonElement>('.header-menu button:not(:disabled)')?.focus();
    button.addEventListener('click', () => {
      const open = !cluster.classList.contains('is-open');
      clusters.forEach(other => close(other));
      if (open && media.matches) {
        cluster.classList.add('is-open');
        button.setAttribute('aria-expanded', 'true');
        focusFirst();
      }
    });
    button.addEventListener('keydown', event => {
      if (event.key !== 'ArrowDown') return;
      event.preventDefault();
      if (!cluster.classList.contains('is-open')) button.click();
      else focusFirst();
    });
    cluster.addEventListener('click', event => {
      const item = (event.target as Element).closest<HTMLButtonElement>('.header-menu button');
      if (item && !item.disabled && cluster.classList.contains('is-open')) close(cluster, true);
    });
    cluster.addEventListener('focusout', event => {
      if (event.relatedTarget && !cluster.contains(event.relatedTarget as Node)) close(cluster);
    });
    media.addEventListener('change', () => {
      const focused = cluster.contains(document.activeElement);
      close(cluster, focused && media.matches);
      if (focused && !media.matches) focusFirst();
    });
  }
  document.addEventListener('pointerdown', event => {
    clusters.forEach(cluster => {
      if (!cluster.contains(event.target as Node)) close(cluster);
    });
  });
  // Escape dismisses only the menu, leaving the underlying workspace intact.
  document.addEventListener('keydown', event => {
    const open = clusters.find(cluster => cluster.classList.contains('is-open'));
    if (event.key !== 'Escape' || !open) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close(open, true);
  }, {capture: true});
}
