/**
 * The Expressions mode's LEFT body: a compact subject/expression graph as a
 * dense tree — Expressions → scenes → entities, each entity carrying its bound
 * subject (role · native owner). It is a list, not a second canvas.
 *
 * Everything is the owner's: the listing is `KernelOp::Expression list`, a
 * branch opens through `inspect`, and the tree re-reads on the kernel's
 * `expression_changed` receipts. Selection is shared with the centre surface
 * through `./selection`: a click asks the centre to show that Expression,
 * scene or entity, and when no centre surface is mounted the navigator calls
 * `onOpenExpressions(ref)` so the composition root opens one.
 *
 * Sidebar law: no visible scrollbar, no scroll chaining. A branch's own read
 * failure renders inline on that branch; a navigator-level failure also goes
 * to the footer status through `onMessage`.
 */
import {useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {ExpressionDocument} from "../expression/types";
import type {ExpressionListing} from "../expression/useExpressionApplication";
import {EXPRESSION_EDITOR_ACTOR as ACTOR} from "../expression/useExpressionApplication";
import {Glyph} from "../workspace/Glyph";
import {ICON} from "./icons";
import {requestExpressionSelection, useExpressionSelection} from "./selection";
import {useExpressionChangeSeq, useExpressionRequest} from "./useExpressionDocument";
import "./expressions.css";

type Row =
  | {kind: "expression"; id: string; level: 1; expressionRef: string; title: string; note: string; expanded: boolean}
  | {kind: "scene"; id: string; level: 2; expressionRef: string; sceneRef: string; title: string; note: string; expanded: boolean}
  | {kind: "entity"; id: string; level: 3; expressionRef: string; sceneRef: string; entityRef: string; title: string; subject: ExpressionDocument["entities"][string]["subject"]}
  | {kind: "inline"; id: string; level: 2 | 3; tone: "note" | "refusal"; text: string};

export function ExpressionGraphNavigator({onOpenExpressions, onOpenTechne, onMessage}: {onOpenExpressions: (expressionRef?: string) => void; onOpenTechne?: () => void; onMessage: (message: string) => void}) {
  const kernel = useKernel();
  const request = useExpressionRequest();
  const seq = useExpressionChangeSeq();
  const selection = useExpressionSelection();
  const [list, setList] = useState<ExpressionListing | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Record<string, ExpressionDocument>>({});
  const [branchErrors, setBranchErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [creating, setCreating] = useState(false);
  const tree = useRef<HTMLUListElement>(null);
  const message = useRef(onMessage); message.current = onMessage;
  const unavailable = kernel.transport.kind === "unavailable" ? kernel.transport.reason : null;

  // The listing: on mount and whenever the kernel says an Expression changed.
  useEffect(() => {
    if (unavailable) return;
    let live = true;
    void request({operation: "list"}).then(
      data => { if (live) { setList(data.expressions ?? []); setListError(null); } },
      cause => { if (!live) return; const text = cause instanceof Error ? cause.message : String(cause); setListError(text); message.current(`Expressions could not be listed: ${text}`); },
    );
    return () => { live = false; };
  }, [request, seq, unavailable]);

  // Open branches read their document; the same receipts re-read them.
  const openExpressionRefs = useMemo(() => (list ?? []).map(entry => entry.expression_ref).filter(ref => expanded.has(ref)), [list, expanded]);
  const openKey = openExpressionRefs.join("\n");
  useEffect(() => {
    if (unavailable) return;
    let live = true;
    for (const ref of openExpressionRefs) {
      void request({operation: "inspect", expression_ref: ref}).then(
        data => { if (!live) return; if (data.document) { const document = data.document; setDocuments(current => ({...current, [ref]: document})); setBranchErrors(current => { if (!(ref in current)) return current; const next = {...current}; delete next[ref]; return next; }); } },
        cause => { if (live) setBranchErrors(current => ({...current, [ref]: cause instanceof Error ? cause.message : String(cause)})); },
      );
    }
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey, seq, request, unavailable]);

  // The centre's selection opens its own path in the tree.
  useEffect(() => {
    if (!selection.expressionRef) return;
    setExpanded(current => {
      const wanted = [selection.expressionRef, selection.sceneRef].filter((ref): ref is string => !!ref && !current.has(ref));
      if (!wanted.length) return current;
      return new Set([...current, ...wanted]);
    });
  }, [selection.expressionRef, selection.sceneRef]);

  const toggle = useCallback((id: string, open?: boolean) => setExpanded(current => {
    const next = new Set(current);
    if (open ?? !next.has(id)) next.add(id); else next.delete(id);
    return next;
  }), []);

  const ask = (row: Exclude<Row, {kind: "inline"}>) => {
    // The Wiki→Expression projection (expression:techne-m0.*) is Instrument
    // 0's own document (O-I #366: one projection, one selection): a row ask
    // records the selection request for the Technè centre (mounted centres
    // park, not unmount — the retention law) and, when no centre stands,
    // enters Technè so the able presenter receives it. The Expressions
    // application is never asked to present another instrument's projection.
    if (row.expressionRef.startsWith("expression:techne-m0.")) {
      requestExpressionSelection(row.kind === "expression"
        ? {expressionRef: row.expressionRef}
        : row.kind === "scene"
          ? {expressionRef: row.expressionRef, sceneRef: row.sceneRef, entityRef: null}
          : {expressionRef: row.expressionRef, sceneRef: row.sceneRef, entityRef: row.entityRef, focus: "entity"});
      if (!onOpenTechne) return;
      onOpenTechne();
      return;
    }
    const mounted = requestExpressionSelection(row.kind === "expression"
      ? {expressionRef: row.expressionRef}
      : row.kind === "scene"
        ? {expressionRef: row.expressionRef, sceneRef: row.sceneRef, entityRef: null}
        : {expressionRef: row.expressionRef, sceneRef: row.sceneRef, entityRef: row.entityRef, focus: "entity"});
    if (!mounted) onOpenExpressions(row.expressionRef);
  };

  const create = async () => {
    setCreating(true);
    try {
      const ref = `expression:${crypto.randomUUID()}`;
      const data = await request({operation: "create", expression_ref: ref, title: "Untitled Expression", actor: ACTOR});
      const created = data.document?.expression_ref ?? ref;
      toggle(created, true);
      if (!requestExpressionSelection({expressionRef: created})) onOpenExpressions(created);
    } catch (cause) {
      onMessage(`A new Expression could not be created: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally { setCreating(false); }
  };

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const entry of list ?? []) {
      const open = expanded.has(entry.expression_ref);
      out.push({kind: "expression", id: entry.expression_ref, level: 1, expressionRef: entry.expression_ref, title: entry.title, note: `r${entry.revision}${entry.dirty ? " · unsaved" : ""}`, expanded: open});
      if (!open) continue;
      const failure = branchErrors[entry.expression_ref], document = documents[entry.expression_ref];
      if (failure) { out.push({kind: "inline", id: `${entry.expression_ref}#refusal`, level: 2, tone: "refusal", text: failure}); continue; }
      if (!document) { out.push({kind: "inline", id: `${entry.expression_ref}#reading`, level: 2, tone: "note", text: "Reading scenes…"}); continue; }
      for (const scene of document.scenes) {
        const sceneOpen = expanded.has(scene.scene_ref);
        out.push({kind: "scene", id: scene.scene_ref, level: 2, expressionRef: entry.expression_ref, sceneRef: scene.scene_ref, title: scene.title, note: `${scene.entity_refs.length}`, expanded: sceneOpen});
        if (!sceneOpen) continue;
        if (!scene.entity_refs.length) out.push({kind: "inline", id: `${scene.scene_ref}#empty`, level: 3, tone: "note", text: "This scene holds nothing yet."});
        for (const entityRef of scene.entity_refs) {
          const entity = document.entities[entityRef];
          if (entity) out.push({kind: "entity", id: `${scene.scene_ref}\n${entityRef}`, level: 3, expressionRef: entry.expression_ref, sceneRef: scene.scene_ref, entityRef, title: entity.title, subject: entity.subject});
        }
      }
    }
    return out;
  }, [list, expanded, documents, branchErrors]);

  const selectedId = selection.expressionRef
    ? selection.entityRef && selection.sceneRef ? `${selection.sceneRef}\n${selection.entityRef}` : selection.sceneRef && expanded.has(selection.expressionRef) ? selection.sceneRef : selection.expressionRef
    : undefined;
  // When the deepest selected row is folded away, its nearest visible ancestor reads as selected.
  const visibleSelected = rows.some(row => row.id === selectedId) ? selectedId
    : rows.some(row => row.id === selection.sceneRef) ? selection.sceneRef : selection.expressionRef;

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const buttons = Array.from(tree.current?.querySelectorAll<HTMLButtonElement>("button[data-row-id]") ?? []);
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const row = rows.find(candidate => candidate.id === buttons[at].dataset.rowId);
    const move = (index: number) => { event.preventDefault(); buttons[Math.min(buttons.length - 1, Math.max(0, index))]?.focus(); };
    if (event.key === "ArrowDown") move(at + 1);
    else if (event.key === "ArrowUp") move(at - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(buttons.length - 1);
    else if (event.key === "ArrowRight" && row && row.kind !== "inline" && row.kind !== "entity") { event.preventDefault(); if (!row.expanded) toggle(row.id, true); else move(at + 1); }
    else if (event.key === "ArrowLeft" && row && row.kind !== "inline") {
      event.preventDefault();
      if (row.kind !== "entity" && row.expanded) toggle(row.id, false);
      else { const parent = row.kind === "entity" ? row.sceneRef : row.kind === "scene" ? row.expressionRef : undefined; if (parent) buttons.find(button => button.dataset.rowId === parent)?.focus(); }
    }
  };

  if (unavailable) return <nav className="xg-navigator" aria-label="Expression graph">
    <div className="xg-head"><span className="oi-eyebrow">Expressions</span></div>
    <p className="oi-empty" role="status">Expressions are unavailable: {unavailable}</p>
  </nav>;

  return <nav className="xg-navigator" aria-label="Expression graph" aria-busy={list === null && !listError}>
    <div className="xg-head oi-panel-head">
      <span className="oi-eyebrow">Expressions</span>
      <button type="button" className="oi-tool" aria-label="New Expression" title="New Expression" data-busy={creating || undefined} disabled={creating} onClick={() => void create()}><Glyph name={ICON.add} size={13}/></button>
    </div>
    {listError && <p className="oi-refusal xg-inline" role="alert">{listError}</p>}
    {list === null && !listError && <p className="oi-note xg-inline" role="status">Reading Expressions…</p>}
    {list !== null && list.length === 0 && <div className="oi-empty" role="status">
      <strong>No Expressions yet</strong>
      <button type="button" className="oi-action oi-action-primary" disabled={creating} onClick={() => void create()}>New Expression</button>
    </div>}
    {list !== null && list.length > 0 && <ul ref={tree} className="xg-tree oi-scroll-quiet" role="tree" aria-label="Expressions, scenes and entities" onKeyDown={onKeyDown}>
      {rows.map(row => row.kind === "inline"
        ? <li key={row.id} role="none"><p className={`${row.tone === "refusal" ? "oi-refusal" : "oi-note"} xg-inline`} style={{"--xg-depth": row.level - 1} as React.CSSProperties} role={row.tone === "refusal" ? "alert" : undefined}>{row.text}</p></li>
        : <li key={row.id} role="none">
            <button type="button" role="treeitem" className="oi-row xg-row" data-row-id={row.id} data-kind={row.kind} aria-level={row.level} aria-selected={row.id === visibleSelected} aria-expanded={row.kind === "entity" ? undefined : row.expanded}
              tabIndex={row.id === visibleSelected || (!visibleSelected && row === rows[0]) ? 0 : -1}
              style={{"--xg-depth": row.level - 1} as React.CSSProperties}
              title={row.kind === "entity" ? (row.subject ? `${row.title} — ${row.subject.subject_ref}` : `${row.title} — unbound`) : row.title}
              onClick={() => { if (row.kind !== "entity") toggle(row.id, row.id === visibleSelected ? undefined : true); ask(row); }}>
              <span className="xg-twist" data-leaf={row.kind === "entity" || undefined} aria-hidden="true"/>
              <Glyph name={row.kind === "expression" ? ICON.expression : row.kind === "scene" ? ICON.scene : ICON.entity} size={13}/>
              <span className="oi-row-title">{row.title}</span>
              {row.kind === "entity"
                ? row.subject ? <span className="oi-chip" data-role={row.subject.presentation_role}>{row.subject.presentation_role} · {row.subject.native_owner}</span> : <span className="oi-state">unbound</span>
                : <span className="oi-state">{row.note}</span>}
            </button>
          </li>)}
    </ul>}
  </nav>;
}
