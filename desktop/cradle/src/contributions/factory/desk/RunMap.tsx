/**
 * Map — the meaning of the work (11-FACTORY §3.2): the SSSF multi-lane map
 * over the owner's run map (`factory development run`) and workflow
 * inspection (`factory workflow inspect`).
 *
 * One lane per work unit, columns by edge depth (runModel.layoutRunMap);
 * independent units stack as parallel lanes (fork); `converges_to` edges join
 * lanes; a gate is a vertical bar across the lanes it holds; a nested run is a
 * unit with ⊞. The frontier unit is outlined in ink. Selecting a unit opens a
 * detail band: required difference and return, each required check with its
 * state, permitted effects, stop conditions, attempts — with Message, Open
 * activity and Open page. The map never invents a graph, never shows fixed
 * lanes, never shows a percentage.
 */
import {useMemo, useState} from "react";
import {openRunPage, peekDeskReading, type RunEntry} from "./deskStore";
import {EDGE_WORD, attemptsFor, layoutRunMap, legStanding, refTail, unitChecks, unitOf, type MapCell, type WorkflowUnit} from "./runModel";
import type {RunPageHost} from "./RunPage";

const CELL_W = 196, CELL_H = 78, GAP_X = 74, LANE_H = 104, PAD = 18, DEST_W = 132, GATE_W = 10;
const STANDING_WORD: Record<string, string> = {"not-started": "not started", active: "active", returned: "returned", failed: "failed"};

function cellBox(cell: MapCell) {
  const x = PAD + cell.column * (CELL_W + GAP_X);
  const y = PAD + cell.lane * LANE_H;
  if (cell.node.kind === "destination") return {x: x + CELL_W - DEST_W, y: y + 10, w: DEST_W, h: CELL_H - 20};
  if (cell.node.kind === "gate") return {x: x + CELL_W / 2 - GATE_W / 2, y, w: GATE_W, h: CELL_H};
  return {x, y, w: CELL_W, h: CELL_H};
}

export function RunMap({entry, runKey, host}: {entry: RunEntry; runKey: string; host: RunPageHost}) {
  const {run, inspection} = entry;
  const layout = useMemo(() => layoutRunMap(run), [run]);
  const [selected, setSelected] = useState<string>();

  if (layout.workUnits === 0) {
    return <div className="frun-empty" data-map-empty="no-units"><p>This run has no work units yet.</p></div>;
  }
  const width = PAD * 2 + layout.columns * CELL_W + (layout.columns - 1) * GAP_X;
  const gateSpan = new Map(layout.gates.map(gate => [gate.cell.id, gate]));
  const height = PAD * 2 + (layout.lanes - 1) * LANE_H + CELL_H;
  const boxes = new Map(layout.cells.map(cell => {
    const box = cellBox(cell);
    const gate = gateSpan.get(cell.id);
    if (gate) { box.y = PAD + gate.laneFrom * LANE_H; box.h = (gate.laneTo - gate.laneFrom) * LANE_H + CELL_H; }
    return [cell.id, box];
  }));
  const selectedCell = layout.cells.find(cell => cell.id === selected);

  return <div className="fmap">
    <div className="fmap-canvas" role="group" aria-label={`Run map — ${layout.workUnits} work unit${layout.workUnits === 1 ? "" : "s"}`}>
      <div className="fmap-plane" style={{width, height}}>
        {Array.from({length: layout.lanes}, (_, lane) => <div key={lane} className="fmap-lane" style={{top: PAD + lane * LANE_H - 10, height: CELL_H + 20}}><span>Lane {lane + 1}</span></div>)}
        <svg className="fmap-edges" width={width} height={height} aria-hidden="true">
          {layout.edges.map(edge => {
            const from = boxes.get(edge.from)!, to = boxes.get(edge.to)!;
            const x1 = from.x + from.w, y1 = from.y + from.h / 2, x2 = to.x, y2 = to.y + to.h / 2;
            const mid = (x1 + x2) / 2;
            return <g key={`${edge.from}>${edge.to}`} data-relation={edge.relation}>
              <path d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}/>
              <text x={mid} y={(y1 + y2) / 2 - 5} textAnchor="middle">{(EDGE_WORD[edge.relation] ?? edge.relation).toUpperCase()}</text>
            </g>;
          })}
        </svg>
        {layout.cells.map(cell => <MapNode key={cell.id} cell={cell} box={boxes.get(cell.id)!} entry={entry}
          selected={selected === cell.id} onSelect={() => setSelected(value => value === cell.id ? undefined : cell.id)}/>)}
      </div>
    </div>
    {selectedCell?.node.kind === "work" && <UnitBand cell={selectedCell} entry={entry} runKey={runKey} host={host}/>}
    {selectedCell && selectedCell.node.kind !== "work" && <div className="fmap-band" data-unit-band={selectedCell.id}>
      <h3>{selectedCell.node.label}</h3>
      <p className="frun-note">{selectedCell.node.kind === "gate" ? gateWords(entry, selectedCell.id) : selectedCell.node.kind === "destination" ? "The run's destination." : `${selectedCell.node.kind.replace("_", " ")}${selectedCell.node.state ? ` · ${selectedCell.node.state}` : ""}`}</p>
    </div>}
    {!inspection && entry.inspectionError && <p className="frun-note" data-inspection-refused>The owner's workflow inspection is not available for this run: {entry.inspectionError}</p>}
  </div>;
}

function gateWords(entry: RunEntry, id: string): string {
  const key = id.replace(/^barrier-/, "");
  const barrier = entry.inspection?.barriers?.find(item => item.key === key || `barrier-${item.key}` === id);
  if (!barrier) return "A gate across the lanes it holds.";
  return barrier.complete ? "Gate passed — every unit it waits for has returned." : `Gate held — waiting for ${barrier.notReturned?.length ?? 0} unit${barrier.notReturned?.length === 1 ? "" : "s"} to return.`;
}

function MapNode({cell, box, entry, selected, onSelect}: {cell: MapCell; box: {x: number; y: number; w: number; h: number}; entry: RunEntry; selected: boolean; onSelect: () => void}) {
  const {node} = cell;
  const style = {left: box.x, top: box.y, width: box.w, height: box.h};
  if (node.kind === "gate") {
    const held = entry.inspection?.barriers?.find(item => `barrier-${item.key}` === node.id || item.key === node.id);
    return <button type="button" className="fmap-gate" style={style} data-gate={node.id} data-complete={held?.complete ? "true" : undefined} aria-label={`Gate: ${node.label}`} aria-pressed={selected} onClick={onSelect}/>;
  }
  if (node.kind === "destination") return <button type="button" className="fmap-dest" style={style} aria-pressed={selected} onClick={onSelect}><strong>Destination</strong><span>{node.label}</span></button>;
  const unitRef = node.semanticRef ?? undefined;
  const unit = unitOf(entry.inspection, unitRef);
  const attempts = attemptsFor(entry.inspection, unitRef);
  const required = unit?.requiredVerification ?? (unitRef ? entry.inspection?.legs?.[unitRef]?.requiredVerification : undefined);
  const checks = unitChecks(required, attempts);
  const passed = checks.filter(check => check.state === "passed").length;
  const standing = legStanding(node, unitRef ? entry.inspection?.legs?.[unitRef] : undefined);
  const needs = unit?.agentRequirements?.agentRefs?.map(refTail).filter(Boolean).join(", ");
  const nestedKey = node.kind === "nested_run" && node.semanticRef?.startsWith("run:") ? Object.keys(peekDeskReading()?.runs ?? {}).find(key => key.endsWith(`\u0000${node.semanticRef}`)) : undefined;
  return <div className="fmap-unit" style={style} data-frontier={cell.frontier ? "true" : undefined} data-selected={selected ? "true" : undefined} data-unit={unitRef ?? node.id} data-standing={standing}>
    <button type="button" className="fmap-unit-open" aria-pressed={selected} onClick={onSelect} aria-label={`Work unit: ${unit?.developmentalConcern ?? node.label}`}>
      <strong>{unit?.developmentalConcern ?? node.label}</strong>
      <span>{node.state ?? STANDING_WORD[standing]}{checks.length > 0 ? ` · ${passed} / ${checks.length} checks` : ""}</span>
      {needs && <span>needs: {needs}</span>}
    </button>
    {nestedKey && <button type="button" className="fmap-nested" aria-label="Open the nested run" onClick={() => openRunPage(nestedKey)}>⊞</button>}
  </div>;
}

function UnitBand({cell, entry, runKey, host}: {cell: MapCell; entry: RunEntry; runKey: string; host: RunPageHost}) {
  const unitRef = cell.node.semanticRef ?? undefined;
  const unit: WorkflowUnit | undefined = unitOf(entry.inspection, unitRef);
  const attempts = attemptsFor(entry.inspection, unitRef);
  const checks = unitChecks(unit?.requiredVerification, attempts);
  const sessions = [...new Set(attempts.map(attempt => attempt.body?.agentSessionRef).filter((ref): ref is string => !!ref))];
  const [choosing, setChoosing] = useState(false);
  const fields: [string, string | undefined][] = [
    ["Concern", unit?.developmentalConcern ?? cell.node.label],
    ["Must change", unit?.requiredDifference],
    ["Returns", unit?.requiredReturn?.contract],
    ["May", unit?.permittedEffects?.join("; ")],
    ["Stops when", unit?.stopConditions],
    ["Attempts", attempts.length ? attempts.map((attempt, index) => `attempt ${index + 1}${attempt.status ? ` · ${attempt.status}` : ""}`).join(", ") : "None yet"],
  ];
  return <div className="fmap-band" data-unit-band={unitRef ?? cell.id}>
    <h3>{unit?.developmentalConcern ?? cell.node.label}{cell.frontier && <span className="frun-pill">frontier</span>}</h3>
    <div className="fmap-band-grid">
      <dl className="fmap-fields">
        {fields.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      {checks.length > 0 && <ul className="fmap-checks" aria-label="Required checks">
        {checks.map(check => <li key={check.text} data-check-state={check.state}><span className="fcheck" data-state={check.state} aria-label={check.state}/>{check.text}{check.state === "outstanding" ? "" : check.revision ? <small> · {check.state} at {check.revision.slice(0, 7)}</small> : <small> · {check.state}</small>}</li>)}
      </ul>}
    </div>
    <div className="fmap-band-actions">
      {sessions.length <= 1
        ? <button type="button" className="oi-action" disabled={!sessions.length || !host.onOpenConversation} title={sessions.length ? undefined : "No conversation carries this unit yet"} onClick={() => sessions[0] && host.onOpenConversation?.(sessions[0])}>Message</button>
        : <span className="fmenu">
          <button type="button" className="oi-action" aria-expanded={choosing} onClick={() => setChoosing(value => !value)}>Message</button>
          {choosing && <span className="fmenu-pop" data-align="start" role="menu">{sessions.map((session, index) => <button key={session} type="button" role="menuitem" className="fmenu-row" onClick={() => { setChoosing(false); host.onOpenConversation?.(session); }}><span>Conversation {index + 1}</span><small>attempt {index + 1}</small></button>)}</span>}
        </span>}
      <button type="button" className="oi-action" disabled={!host.onOpenActivity} onClick={() => host.onOpenActivity?.({sessionRef: sessions[0]})}>Open activity</button>
      <button type="button" className="oi-action" disabled={!unitRef || !host.onOpenObject} onClick={() => unitRef && host.onOpenObject?.({kind: "work-unit", runKey, unitRef})}>Open page</button>
    </div>
  </div>;
}
