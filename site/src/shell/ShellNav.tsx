'use client';

import { useEffect, useState } from 'react';
import { ShellMark } from './ShellMark';
import { PAGES } from './pages';

type ShellNavProps = {
  page: string;
  onNavigate: (id: string) => void;
};

/**
 * Fully transparent header (no tint, no darkening). The page list lives in a
 * full-screen accordion panel styled in the page's own voice: paper ground,
 * thin rules, uppercase labels.
 */
export function ShellNav({ page, onNavigate }: ShellNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const go = (id: string) => {
    setOpen(false);
    onNavigate(id);
  };

  return (
    <header className={`sn${open ? ' sn--open' : ''}`}>
      <button className="sn__brand" onClick={() => go('home')} aria-label="O:I home">
        <ShellMark className="sn__mark" />
      </button>

      <button
        className="sn__toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="shell-menu"
      >
        <span className="sn__toggle-label">{open ? 'Close' : 'Menu'}</span>
        <span className="sn__toggle-icon" aria-hidden="true">
          {open ? '×' : '+'}
        </span>
      </button>

      <nav id="shell-menu" className="sn__panel" aria-hidden={!open}>
        <ol className="sn__list">
          {PAGES.map((entry) => (
            <li key={entry.id} className="sn__item">
              <button
                className={`sn__link${page === entry.id ? ' sn__link--active' : ''}`}
                onClick={() => go(entry.id)}
              >
                <span className="sn__index">{entry.index}</span>
                <span className="sn__label">{entry.label}</span>
                <span className="sn__hint">{entry.hint}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="sn__foot">O:I — World and Life</div>
      </nav>
    </header>
  );
}
