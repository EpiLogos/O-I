import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ShellMark } from './ShellMark';
import { PAGES } from './content';

type ShellNavProps = { page: string; onNavigate: (id: string) => void };
const hrefFor = (id: string) => id === 'home' ? '#/' : `#/${id}`;

/** Native modal supplies inert background, Escape, focus containment and return. */
export function ShellNav({ page, onNavigate }: ShellNavProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const close = () => { dialogRef.current?.close(); setOpen(false); };
  const go = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    close();
    onNavigate(id);
  };
  const brand = (
    <a className="sn__brand" href="#/" onClick={event => go(event, 'home')} aria-label="O:I home">
      <ShellMark className="sn__mark" />
    </a>
  );

  return (
    <header className={`sn${page === 'home' ? ' sn--light' : ''}`}>
      {brand}
      <button type="button" className="sn__toggle" aria-expanded={open} aria-controls="shell-menu" onClick={() => {
        dialogRef.current?.showModal();
        setOpen(true);
      }}>
        <span className="sn__toggle-label">Menu</span>
        <span className="sn__toggle-icon" aria-hidden="true">+</span>
      </button>
      <dialog ref={dialogRef} id="shell-menu" className="sn__panel" aria-label="Site navigation" onClose={() => setOpen(false)} data-lenis-prevent>
        <div className="sn__panel-head">
          {brand}
          <button type="button" className="sn__toggle" onClick={close} autoFocus>
            <span className="sn__toggle-label">Close</span>
            <span className="sn__toggle-icon" aria-hidden="true">×</span>
          </button>
        </div>
        <nav aria-label="Main navigation">
          <ol className="sn__list">
            {PAGES.map(entry => (
              <li key={entry.id} className="sn__item">
                <a className={`sn__link${page === entry.id ? ' sn__link--active' : ''}`} href={hrefFor(entry.id)} onClick={event => go(event, entry.id)} aria-current={page === entry.id ? 'page' : undefined}>
                  <span className="sn__index">{entry.index}</span>
                  <span className="sn__label">{entry.label}</span>
                  <span className="sn__hint">{entry.hint}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="sn__foot">O:I — World and Life</div>
      </dialog>
    </header>
  );
}
