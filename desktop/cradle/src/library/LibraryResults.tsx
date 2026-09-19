/**
 * The Library's result treatments: a dense `.oi-row` list grouped by kind.
 * When a "shared" query returns items this instance itself owns (item-level
 * `scope:"local"`, disclosed by the provider — see providers.ts), those
 * items are nested under "Your instance (subset)" ahead of the rest, so the
 * subset relation stays legible instead of reading as two unrelated lists.
 *
 * Coverage states are distinguished by their own static English, never by
 * colour alone. Ranking is presentation order only — the muted closing line
 * says so.
 */
import type {GlyphName} from "../workspace/Glyph";
import {Glyph} from "../workspace/Glyph";
import type {LibraryCoverage, LibraryItem, LibraryKind} from "./scope";

const KIND_ORDER: LibraryKind[] = ["composition", "world", "projected-object", "place", "page"];
const KIND_LABEL: Record<LibraryKind, string> = {
  composition: "Compositions", world: "Worlds", "projected-object": "Projected objects", place: "Places", page: "Pages",
};
const KIND_GLYPH: Record<LibraryKind, GlyphName> = {
  composition: "field", world: "graph", "projected-object": "material", place: "wiki", page: "file",
};

function groupByKind(items: LibraryItem[]): [LibraryKind, LibraryItem[]][] {
  return KIND_ORDER.map((kind): [LibraryKind, LibraryItem[]] => [kind, items.filter(item => item.kind === kind)]).filter(([, rows]) => rows.length > 0);
}

/** The coverage block — the providers' own states about what they could and
 * could not read, in static English. Shared with the columnar view
 * (LibraryBrowse) so both presentations name absence identically. */
export function LibraryCoverageLines({coverage}: {coverage: LibraryCoverage[]}) {
  const unavailable = coverage.filter(entry => entry.state === "unavailable");
  const stale = coverage.filter(entry => entry.state === "stale");
  const truncated = coverage.filter(entry => entry.state === "partial" && /truncat/i.test(entry.reason ?? ""));
  const partial = coverage.filter(entry => entry.state === "partial" && !truncated.includes(entry));
  return <>
    {unavailable.map(entry => <p key={entry.provider} className="oi-refusal lib-coverage-line" data-coverage="unavailable">Unavailable — {entry.provider}: {entry.reason ?? "no reading available"}</p>)}
    {stale.map(entry => <p key={entry.provider} className="oi-note lib-coverage-line" data-coverage="stale">Stale — {entry.provider}{entry.reason ? `: ${entry.reason}` : ""}</p>)}
    {truncated.map(entry => <p key={entry.provider} className="oi-note lib-coverage-line" data-coverage="truncated">Truncated — {entry.provider}: {entry.reason}</p>)}
    {partial.map(entry => <p key={entry.provider} className="oi-note lib-coverage-line" data-coverage="partial">Partial coverage — {entry.provider}{entry.reason ? `: ${entry.reason}` : ""}</p>)}
  </>;
}

export function LibraryResults({items, coverage, selectedRef, onSelect, onOpen}: {
  items: LibraryItem[];
  coverage: LibraryCoverage[];
  selectedRef?: string;
  onSelect: (item: LibraryItem) => void;
  onOpen: (item: LibraryItem, how: "page" | "expression" | "instrument" | "source") => void;
}) {
  const hasLocal = items.some(item => item.scope === "local");
  const hasShared = items.some(item => item.scope === "shared");
  const mixed = hasLocal && hasShared;
  const localRows = mixed ? items.filter(item => item.scope === "local") : [];
  const sharedRows = mixed ? items.filter(item => item.scope === "shared") : items;

  const renderRow = (item: LibraryItem) => {
    const selected = item.ref === selectedRef;
    return <div key={`${item.provider}:${item.ref}`} className="lib-row-wrap">
      <button type="button" role="option" aria-selected={selected} className="oi-row lib-row" onClick={() => onSelect(item)}>
        <Glyph name={KIND_GLYPH[item.kind]} size={14}/>
        <span className="oi-row-title">{item.title}{item.fixture && <span className="oi-state lib-fixture-mark">Fixture — not native data</span>}</span>
        <span className="oi-row-meta">{item.owner} · {mixed && item.scope === "local" ? "this instance" : item.scope}{item.revision ? <span className="oi-ref"> · {item.revision}</span> : null}</span>
      </button>
      {selected && <div className="lib-detail oi-kv" role="group" aria-label={`${item.title} actions`}>
        {item.summary && <p className="oi-note lib-summary">{item.summary}</p>}
        <div className="oi-action-group">
          <button type="button" className="oi-action" onClick={() => onOpen(item, "page")}>Open page</button>
          {item.expressionRef && <button type="button" className="oi-action" onClick={() => onOpen(item, "expression")}>Open Expression</button>}
          {item.kind === "projected-object" && <button type="button" className="oi-action" onClick={() => onOpen(item, "instrument")}>Examine in Instrument 0</button>}
          {item.sourceLocation && <button type="button" className="oi-action" onClick={() => onOpen(item, "source")}>Open exact source</button>}
        </div>
      </div>}
    </div>;
  };

  const renderGroups = (rows: LibraryItem[]) => groupByKind(rows).map(([kind, kindRows]) => <section key={kind} className="lib-kind-group">
    <div className="oi-eyebrow lib-kind-heading">{KIND_LABEL[kind]}</div>
    <div role="listbox" aria-label={KIND_LABEL[kind]}>{kindRows.map(renderRow)}</div>
  </section>);

  return <div className="lib-results oi-scroll">
    {coverage.length > 0 && <div className="lib-coverage">
      <LibraryCoverageLines coverage={coverage}/>
    </div>}
    {items.length === 0
      ? <p className="oi-empty" role="status">No matches.</p>
      : <>
        {mixed && <section className="lib-scope-group">
          <h4 className="oi-eyebrow lib-subset-heading">Your instance (subset)</h4>
          {renderGroups(localRows)}
        </section>}
        {mixed && <h4 className="oi-eyebrow lib-subset-heading">Shared web</h4>}
        {renderGroups(sharedRows)}
        <p className="oi-note lib-order-note">Order is not evidential standing.</p>
      </>}
  </div>;
}
