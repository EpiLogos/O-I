import {useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent} from "react";
import {useLayout} from "../knowledge/useLayout";
import type {GraphReading} from "../knowledge/graph";
import type {KnowledgeEncounterView} from "./navigate";

export type EncounterGraphNode = {ref:string; kind:string; label:string; revision?:string; availability?:string};
export type EncounterGraphEdge = {from:string; to:string; relation:string; origin:string; provenance:{ref:string; revision?:string}[]};

const WIDTH = 800, HEIGHT = 520, CENTRE = {x:400,y:260}, MIN_ZOOM = .4, MAX_ZOOM = 3, DOUBLE_MS = 400, DRAG_SLOP = 3;
const relationLabel = (value:string) => {const parts=value.split(/[/.]/).filter(Boolean);return (parts[parts.length-1]??value).replace(/-/g," ");};
const clamp = (value:number, low:number, high:number) => Math.min(high, Math.max(low, value));

/** A projected local whole as the same live force world the Knowledge
 * surface uses: nodes settle under the layout worker, a press selects and
 * highlights a neighbourhood, a drag moves a subject and lets its
 * neighbourhood answer, the ground pans, and only a deliberate double-click
 * (or Enter) opens the subject. Positions are disposable presentation; the
 * encounter's own nodes and relations are never altered. */
export function EncounterGraph({nodes, edges, focus, visualLocus, camera, picked, onCamera, onPick, onOpen}:{nodes:EncounterGraphNode[]; edges:EncounterGraphEdge[]; focus:string; visualLocus:string; camera:KnowledgeEncounterView["camera"]; picked?:string; onCamera:(camera:KnowledgeEncounterView["camera"])=>void; onPick:(ref?:string)=>void; onOpen:(ref:string)=>void}) {
  const reading = useMemo<GraphReading>(() => ({
    schema:"oi.cradle.graph-reading/v1",
    nodes:nodes.map(node => ({ref:node.ref, kind:node.kind, label:node.label, native_owner:"shared-field", provenance:{source:"explore.local-whole"}, actions:[]})),
    edges:edges.map(edge => ({relation:edge.relation, from_ref:edge.from, to_ref:edge.to, provenance:{source:"explore.local-whole"}})),
    inputs:{central_wiki:{state:"available",owner_operation:"explore.local-whole"}, aikit_resolution:{state:"available",owner_operation:"explore.local-whole"}, shared_field:{state:"available",owner_operation:"explore.local-whole"}, wiki_links:{state:"available",owner_operation:"explore.local-whole"}},
    counts:{spaces:0, wiki_nodes:nodes.length, knowledge_rows:0, link_rows:0, nodes:nodes.length, edges:edges.length},
  }), [nodes, edges]);
  const layout = useLayout(reading);
  const svg = useRef<SVGSVGElement>(null);
  const callbacks = useRef({onCamera, onPick}); callbacks.current = {onCamera, onPick};
  const setCamera = (next:KnowledgeEncounterView["camera"] | ((current:KnowledgeEncounterView["camera"])=>KnowledgeEncounterView["camera"])) => {
    const value = typeof next === "function" ? next(cameraRef.current) : next;
    cameraRef.current = value; callbacks.current.onCamera(value);
  };
  const setPicked = (ref?:string) => callbacks.current.onPick(ref);
  const cameraRef = useRef(camera); cameraRef.current = camera;
  const drag = useRef<{id:number; sx:number; sy:number; camera:typeof camera; ref?:string; world?:{x:number;y:number}; moved:boolean}>();
  const lastTap = useRef<{ref:string; at:number}>();
  const openable = (ref:string) => nodes.find(node => node.ref === ref)?.availability !== "unavailable";
  const index = new Map(nodes.map((node, i) => [node.ref, i]));
  const at = (ref:string) => layout.points[index.get(ref) ?? -1] ?? CENTRE;

  // Ctrl/⌘ + wheel (and trackpad pinch) zooms; a plain wheel pans. Registered
  // natively because React's wheel listener is passive.
  useEffect(() => {
    const el = svg.current; if(!el) return;
    const wheel = (event:WheelEvent) => {
      event.preventDefault();
      const unit = svgScale(el);
      if(event.ctrlKey || event.metaKey) setCamera(current => ({...current, zoom:clamp(current.zoom * Math.exp(-event.deltaY * .008), MIN_ZOOM, MAX_ZOOM)}));
      else setCamera(current => ({...current, x:current.x - event.deltaX / unit, y:current.y - event.deltaY / unit}));
    };
    el.addEventListener("wheel", wheel, {passive:false});
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  const down = (event:ReactPointerEvent<SVGSVGElement>) => {
    if(event.button !== 0) return;
    const target = (event.target as Element).closest("[data-knowledge-ref]");
    const ref = target?.getAttribute("data-knowledge-ref") ?? undefined;
    const point = ref ? at(ref) : undefined;
    drag.current = {id:event.pointerId, sx:event.clientX, sy:event.clientY, camera:{...cameraRef.current}, ref, world:point ? {x:point.x, y:point.y} : undefined, moved:false};
    event.currentTarget.setPointerCapture(event.pointerId);
    if(ref)setPicked(ref);
  };
  const move = (event:ReactPointerEvent<SVGSVGElement>) => {
    const gesture = drag.current; if(!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.sx, dy = event.clientY - gesture.sy;
    if(!gesture.moved && Math.hypot(dx, dy) <= DRAG_SLOP) return;
    gesture.moved = true;
    const unit = svgScale(event.currentTarget);
    if(gesture.ref && gesture.world) layout.dragNode(gesture.ref, gesture.world.x + dx / unit / gesture.camera.zoom, gesture.world.y + dy / unit / gesture.camera.zoom);
    else setCamera({...gesture.camera, x:gesture.camera.x + dx / unit, y:gesture.camera.y + dy / unit});
  };
  const finish = (event:ReactPointerEvent<SVGSVGElement>, cancelled:boolean) => {
    const gesture = drag.current; if(!gesture || gesture.id !== event.pointerId) return;
    drag.current = undefined;
    if(event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if(gesture.ref) layout.releaseNode(gesture.ref);
    if(cancelled || gesture.moved) return;
    if(!gesture.ref){setPicked(undefined); lastTap.current = undefined; return;}
    const now = performance.now(), previous = lastTap.current;
    if(previous?.ref === gesture.ref && now - previous.at < DOUBLE_MS){lastTap.current = undefined; if(openable(gesture.ref))onOpen(gesture.ref);}
    else lastTap.current = {ref:gesture.ref, at:now};
  };

  const shown = picked;
  const near = useMemo(() => {
    if(!shown) return undefined;
    const set = new Set([shown]);
    for(const edge of edges) if(edge.from === shown || edge.to === shown){set.add(edge.from); set.add(edge.to);}
    return set;
  }, [shown, edges]);
  const showAllEdgeLabels = !near && edges.length <= 16;
  // Geometry follows the exact admitted locus, including its live worker
  // position. Camera offsets are deliberate pan relative to that locus.
  const anchor = at(visualLocus);
  const transform = `translate(${CENTRE.x + camera.x},${CENTRE.y + camera.y}) scale(${camera.zoom}) translate(${-anchor.x},${-anchor.y})`;
  return <svg ref={svg} className="knowledge-encounter__graph" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="Bounded typed knowledge constellation. Drag a subject to move it, drag the background or scroll to pan, Control plus scroll to zoom. Select a subject with a click and open it with a double-click or Enter." data-visual-locus={visualLocus} data-selected={shown} data-layout-error={layout.error}
    onPointerDown={down} onPointerMove={move} onPointerUp={event => finish(event, false)} onPointerCancel={event => finish(event, true)}>
    <g transform={transform}>
      {edges.map((edge, i) => {
        if(!index.has(edge.from) || !index.has(edge.to)) return null;
        const from = at(edge.from), to = at(edge.to), strong = !near || (near.has(edge.from) && near.has(edge.to));
        const label = showAllEdgeLabels || (near !== undefined && strong && (edge.from === shown || edge.to === shown));
        return <g key={`${edge.from}:${edge.relation}:${edge.to}:${i}`} className={`knowledge-encounter__edge${strong ? "" : " is-receded"}`}>
          <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}/>
          {label && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 6}>{relationLabel(edge.relation)}</text>}
          <title>{edge.relation} · {edge.origin} · {edge.provenance.map(row => `${row.ref}@${row.revision ?? "unrevisioned"}`).join(", ")}</title>
        </g>;
      })}
      {nodes.map(node => {
        const point = at(node.ref), isFocus = node.ref === focus, unavailable = node.availability === "unavailable";
        const classes = [isFocus && "is-focus", unavailable && "is-unavailable", node.ref === shown && "is-selected", near && !near.has(node.ref) && "is-receded"].filter(Boolean).join(" ");
        const radius = isFocus ? 26 : 16;
        return <g key={node.ref} className={classes} data-knowledge-ref={node.ref} transform={`translate(${point.x},${point.y})`} role="button" aria-disabled={unavailable} aria-pressed={node.ref === shown} tabIndex={unavailable ? -1 : 0}
          onKeyDown={event => {if(event.key === "Enter"){event.preventDefault(); if(!unavailable)onOpen(node.ref);} else if(event.key === " "){event.preventDefault(); setPicked(node.ref);} else if(event.key === "Escape")setPicked(undefined);}}>
          <circle r={radius}/>
          {(nodes.length <= 24 || isFocus || near?.has(node.ref)) && <text y={radius + 16}>{node.label}</text>}
          <title>{node.ref}{node.revision ? ` @ ${node.revision}` : ""}{unavailable ? " · unavailable" : " · double-click to open"}</title>
        </g>;
      })}
    </g>
  </svg>;
}

/** Screen pixels per svg user unit, so pointer deltas map onto the viewBox. */
function svgScale(el:SVGSVGElement) {
  const matrix = el.getScreenCTM();
  return matrix && matrix.a > 0 ? matrix.a : 1;
}
