import { ShellMark } from './ShellMark';
import { ENTRANCE } from './content';

/** Plate A header: the mark on the left, Library and Essay on the right. */
export function ShellNav() {
  return (
    <header className="sn">
      <a className="sn__brand" href="#/">
        <ShellMark className="sn__mark" />
        <small>{ENTRANCE.brand}</small>
      </a>
      <nav className="sn__links" aria-label="Primary">
        {ENTRANCE.doors.map(door => (
          <a key={door.href} href={door.href} aria-label={door.accessibleName ? `${door.label}, ${door.accessibleName}` : undefined}>
            {door.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
