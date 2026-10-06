/**
 * Page over page: the tab strip. (Port of the site's tabs.ts presentation; the behaviour is `fieldApply`.)
 *
 * The first tab is the MAIN page and stays exactly where it was left. A tangent is an italic preview tab; the
 * next tangent of its kind replaces it; double-click keeps it; ↗ makes it the main page; an Expression is a tab
 * of its own kind. Every verb here is one `FieldOp` — the same ones the keyboard and an agent use.
 */
import type {CorpusIndex} from "./corpusIndex";
import type {FieldEncounter, FieldOp, FieldTab} from "./model";
import type {FieldExpression} from "./source";
import {Icon} from "./icons";

export interface TabsProps {
  index: CorpusIndex;
  state: FieldEncounter;
  expressions: ReadonlyMap<string, FieldExpression>;
  shortTitle(t: string): string;
  apply(op: FieldOp): void;
  /** Reading position of the main page, for the "M16" mark. */
  posLabel(ref: string, span: string | undefined): string | null;
}

export function Tabs({index, state, expressions, shortTitle, apply, posLabel}: TabsProps) {
  const entry = (t: FieldTab) => (t.kind === "expression" ? expressions.get(t.ref) : undefined);
  const item = (key: string, selected: boolean, cls: string, title: string, rc: string, mark: React.ReactNode, label: string, pos: string | null, tab: FieldTab | null) => (
    <div key={key} className={`ftab${cls}`} role="tab" tabIndex={0} aria-selected={selected} data-tab={tab?.id ?? "primary"} title={title} style={{"--rc": rc} as React.CSSProperties}
      onClick={e => { if ((e.target as Element).closest("[data-close],[data-promote]")) return; apply({op: "focus", tab: tab?.id ?? "primary"}); }}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return;                       // a key on the tab's own buttons is that button's
        if (e.key === "Enter" && e.shiftKey && tab) { e.preventDefault(); apply({op: "promote", tab: tab.id}); }        // ↗ : open as the main page
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); apply({op: "focus", tab: tab?.id ?? "primary"}); }
        else if (tab && !e.metaKey && !e.ctrlKey && !e.altKey) {
          if (e.key.toLowerCase() === "k" && tab.preview) { e.preventDefault(); apply({op: "keep", tab: tab.id}); }  // double-click, by keyboard
          else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); apply({op: "close", tab: tab.id}); }  // middle-click, by keyboard
        }
      }}
      onDoubleClick={() => { if (tab?.preview) apply({op: "keep", tab: tab.id}); }}
      onAuxClick={e => { if (e.button === 1 && tab) apply({op: "close", tab: tab.id}); }}>
      {mark}<span className="ftab__t">{label}</span>{pos ? <span className="ftab__pos">{pos}</span> : null}
      {tab ? <>
        <button className="ftab__x ftab__up" type="button" data-promote={tab.id} aria-label={`Open ${label} as ${tab.kind === "expression" ? "its own page" : "the main page"}`} title={tab.kind === "expression" ? "Open the Expression on its own page (Shift+Enter on the tab)" : "Open as the main page (Shift+Enter on the tab)"} onClick={e => { e.stopPropagation(); apply({op: "promote", tab: tab.id}); }}><Icon name="external" size={11}/></button>
        <button className="ftab__x" type="button" data-close={tab.id} aria-label={`Close ${label}`} onClick={e => { e.stopPropagation(); apply({op: "close", tab: tab.id}); }}><Icon name="x" size={10}/></button>
      </> : null}
    </div>
  );

  const main = index.node(state.primary.ref);
  const tabs = [
    main ? item("primary", state.focus === "primary", " ftab--main", main.title, `var(--c-${index.group(main.group)?.tone ?? main.group})`, <i className="dot"/>, main.label, posLabel(state.primary.ref, state.primary.span), null) : null,
    ...state.tabs.map(t => {
      if (t.kind === "expression") {
        const e = entry(t);
        const label = shortTitle(e?.title ?? t.ref);
        return item(t.id, state.focus === t.id, `${t.preview ? " ftab--preview" : ""} ftab--x`, `Expression — ${e?.title ?? t.ref}${t.preview ? " — preview (double-click or press K to keep)" : ""} · Shift+Enter opens it on its own page`, "var(--gold)", <Icon name="expression" size={12} style={{flex: "none", color: "var(--gold)"}}/>, label, null, t);
      }
      const n = index.node(t.ref);
      const label = n ? (n.coord ? n.coord + " · " : "") + n.label : t.ref;
      return item(t.id, state.focus === t.id, t.preview ? " ftab--preview" : "", `${n?.title ?? t.ref}${t.preview ? " — preview (double-click or press K to keep)" : ""} · Shift+Enter opens it as the main page`, `var(--c-${n ? index.group(n.group)?.tone ?? n.group : "essay"})`, <i className="dot"/>, label, posLabel(t.ref, t.span), t);
    }),
  ];
  return <div className="ftabs" role="tablist" aria-label="Open pages">{tabs}</div>;
}
