/**
 * The Epi-Logos mode's LEFT body: the four families, each its own section —
 * never one merged tree. Each section shows its own standing and either its
 * entrances or its unavailable reason. This is also where the four family
 * adapters are registered for the mode (see `sources.ts`): the navigator is
 * the region that is always mounted while the mode is active, so it owns
 * the registration; the surface reads whatever is registered and may also
 * register its own copy if it is ever opened without the navigator.
 *
 *   ↑ / ↓    move between entrance rows
 *   Enter    open the focused entrance
 */
import {useCallback, useRef, useState, type KeyboardEvent} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {
  productsSnapshotFromNavigator, useEpiFamilyStates, useEpiRegistryGeneration, useEpiSourcesRegistered,
  type EpiEntrance, type EpiFamily, type EpiFamilyState,
} from "./sources";
import {selectEpiPlace, useEpiPlace, type EpiPlaceRef} from "./places";
import "./epilogos.css";

const FAMILIES: {family: EpiFamily; title: string}[] = [
  {family: "essay", title: "The essay"},
  {family: "bimba", title: "Bimba"},
  {family: "epii", title: "Epii · the Antichrist material"},
  {family: "products", title: "The products"},
];

const STANDING_LABEL: Record<string, string> = {available: "available", partial: "partial", unavailable: "not connected"};

export function EpiPlacesNavigator({onOpenPlace, onMessage}: {onOpenPlace: (place: EpiPlaceRef) => void; onMessage: (message: string) => void}) {
  const kernel = useKernel();
  const message = useRef(onMessage); message.current = onMessage;

  const productsGetter = useRef(() => productsSnapshotFromNavigator(kernel.snapshot.navigator));
  productsGetter.current = () => productsSnapshotFromNavigator(kernel.snapshot.navigator);
  useEpiSourcesRegistered(useCallback(() => productsGetter.current(), []));

  const generation = useEpiRegistryGeneration();
  const families = useEpiFamilyStates(generation);

  const place = useEpiPlace();
  const open = useCallback((family: EpiFamily, entrance: EpiEntrance) => {
    const next: EpiPlaceRef = {family, ref: entrance.ref, title: entrance.title};
    selectEpiPlace(next);
    onOpenPlace(next);
  }, [onOpenPlace]);

  const root = useRef<HTMLDivElement>(null);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    const rows = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('button[role="treeitem"]:not(:disabled)') ?? []);
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    event.preventDefault();
    rows[Math.min(rows.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)))]?.focus();
  };

  return (
    <nav className="epi-navigator oi-scroll-quiet" aria-label="Epi-Logos places" ref={root} onKeyDown={onKeyDown}>
      {FAMILIES.map(({family, title}) => (
        <FamilySection key={family} family={family} title={title} state={families[family]} current={place} onOpen={entrance => open(family, entrance)}/>
      ))}
    </nav>
  );
}

function FamilySection({family, title, state, current, onOpen}: {
  family: EpiFamily; title: string; state: EpiFamilyState; current: EpiPlaceRef | null; onOpen: (entrance: EpiEntrance) => void;
}) {
  const [expandedReason, setExpandedReason] = useState(false);
  return (
    <section className="epi-nav-family" aria-label={title}>
      <div className="oi-panel-head epi-nav-head">
        <span className="oi-eyebrow">{title}</span>
        {state.standing && (
          <button type="button" className="oi-state" data-standing={state.standing.state}
            title={state.standing.reason} aria-expanded={expandedReason}
            onClick={() => setExpandedReason(value => !value)}>
            {STANDING_LABEL[state.standing.state]}
          </button>
        )}
      </div>
      {state.standing && expandedReason && (
        <p className="oi-note epi-nav-reason">{state.standing.reason} — supplied by {state.standing.owner}.</p>
      )}
      {state.loading && <p className="oi-note" role="status">Reading…</p>}
      {!state.loading && state.error && <p className="oi-refusal" role="alert">{state.error}</p>}
      {!state.loading && !state.error && state.entrances.length === 0 && state.standing && state.standing.state !== "available" && (
        <p className="oi-empty" role="status">{state.standing.reason} — supplied by {state.standing.owner}.</p>
      )}
      {!state.loading && !state.error && state.entrances.length > 0 && (
        <ul className="epi-nav-list" role="group">
          {state.entrances.map(entrance => (
            <li key={entrance.ref} role="none">
              <button type="button" role="treeitem" className="oi-row epi-nav-row"
                aria-selected={current?.family === family && current.ref === entrance.ref}
                title={entrance.sourceLocation ?? entrance.ref}
                onClick={() => onOpen(entrance)}>
                <span className="oi-row-title">{entrance.title}</span>
                <span className="epi-nav-line">{entrance.line}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
