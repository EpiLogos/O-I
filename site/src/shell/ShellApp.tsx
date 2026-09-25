import { useEffect, useRef } from 'react';
import { ShellNav } from './ShellNav';
import { ENTRANCE } from './content';
import './shell.css';

/** Public home. Two doors, as Plate A: Library and the essay. No product tiles. */
export default function ShellApp() {
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    document.title = ENTRANCE.brand;
  }, []);

  return (
    <div className="shell shell--entrance">
      <a className="skip-link" href="#main-content" onClick={event => {
        event.preventDefault();
        mainRef.current?.focus({ preventScroll: true });
      }}>Skip to content</a>
      <ShellNav />
      <main id="main-content" ref={mainRef} tabIndex={-1} className="entrance" data-page="home">
        <p className="entrance__eyebrow">{ENTRANCE.eyebrow}</p>
        <h1>{ENTRANCE.title[0]}<br />{ENTRANCE.title[1]}</h1>
        <p className="entrance__lede">{ENTRANCE.lede}</p>
        <div className="entrance__doors">
          {ENTRANCE.doors.map(door => (
            <a className="entrance__door" key={door.href} href={door.href}>
              <span>{door.index}</span>
              <strong>{door.label}</strong>
              <p>{door.accessibleName ? <span className="sr-only">{door.accessibleName}. </span> : null}{door.body}</p>
            </a>
          ))}
        </div>
        <p className="entrance__coming">{ENTRANCE.coming}</p>
      </main>
    </div>
  );
}
