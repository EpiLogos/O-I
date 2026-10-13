/** The Palace board's face (lane-5 T15): the Palace's regions arranged freely over the Research Canvas itself.
 *
 * It reuses the frame's canvas gesture rather than a second drag system:
 *   - the board IS the vendored `CanvasView` (xyflow): its drag, pan, zoom and fit are the canvas's own;
 *   - marquee is xyflow's box selection (`selectionOnDrag`), the same switch the research canvas's Lasso uses;
 *   - a drag runs through `createGestureTransaction` (canvasGesture.ts): previews on every pointer step, and ONE commit
 *     per gesture (`commitBatch` hands the whole release to the parent in one call), so one gesture is one save;
 *   - grid snap is `snapBoardPoint` over `snapToGrid` (canvasRepertoire.ts), the frame's own snap;
 *   - the viewport is `CanvasView`'s own `onViewportChange` / `initialViewport`, reported to the parent to save once settled.
 * The view holds no arrangement of its own: the parent owns the held points, and a move never touches the Palace's
 * regions, Scenes or bodies. Owners write; this face reads.
 */
import React,{useEffect,useMemo,useReducer,useRef,useState,type ComponentProps} from 'react';
import {CanvasView} from '../../vendor/research-canvas/components';
import {createGestureTransaction,withGesturePreviews,type GestureTransaction} from './canvasGesture.js';
import {boardNodes,boardPositions,boardSelection,commitBatch,snapBoardPoint,type BoardPoint,type BoardPositions} from './palaceBoard.js';

export interface PalaceBoardRegion {name:string;member:{title:string;expression_ref:string}|null}
/** The board's pan and zoom, as `CanvasView` reports them. */
export interface PalaceBoardViewport {x:number;y:number;zoom:number}
export interface PalaceBoardViewProps {
 /** The Palace's own Expression ref: the canvas's key, so a different Palace never inherits this viewport. */
 canvasKey:string;
 regions:readonly PalaceBoardRegion[];
 /** The held points, keyed by region name. A region not held yet is placed in walk order. */
 held:BoardPositions;
 selected:readonly string[];
 /** The restored viewport, stable across renders (`CanvasView` re-applies its initial viewport whenever this identity changes). */
 viewport:PalaceBoardViewport|null;
 /** One call per board gesture, with every region the gesture released. Never called on a preview. */
 onMoves:(points:Record<string,BoardPoint>)=>void;
 /** The viewport once a pan or zoom has been reported. The parent decides when to save it. */
 onViewport:(viewport:PalaceBoardViewport)=>void;
 onSelect:(names:string[])=>void;
}

export function PalaceBoardView({canvasKey,regions,held,selected,viewport,onMoves,onViewport,onSelect}:PalaceBoardViewProps){
 const names=useMemo(()=>regions.map(region=>region.name),[regions]);
 const [snap,setSnap]=useState(false);
 const [marquee,setMarquee]=useState(false);
 const [,redraw]=useReducer((count:number)=>count+1,0);
 const snapRef=useRef(snap);snapRef.current=snap;
 const movesRef=useRef(onMoves);movesRef.current=onMoves;
 const viewportRef=useRef(onViewport);viewportRef.current=onViewport;
 const gesture=useRef<GestureTransaction<BoardPoint>|null>(null);
 // One commit per region per gesture: the canvas's own transaction, with its previews redrawn on every change. The released
 // points of one gesture reach the parent in one call (commitBatch), once the release's synchronous pass has run.
 useEffect(()=>{
  const batch=commitBatch(points=>movesRef.current(points),task=>queueMicrotask(task));
  const transaction=createGestureTransaction<BoardPoint>({
   commit:(name,point)=>{batch(name,point);return Promise.resolve();},
   onChange:()=>redraw(),
  });
  gesture.current=transaction;
  return()=>{transaction.dispose();gesture.current=null;};
 },[]);

 const positions=useMemo(()=>boardPositions(names,held),[names,held]);
 const nodes=withGesturePreviews(
  boardNodes(regions,positions,selected),
  name=>gesture.current?.previewValue(name),
  ()=>undefined,
 );
 // A held drag previews on every pointer step and never arms the idle fallback; the release ends it and flushes at once.
 const preview=(name:string,point:BoardPoint,live:boolean)=>gesture.current?.preview(name,snapBoardPoint(point,snapRef.current),live);
 const release=(name:string,point:BoardPoint)=>{
  gesture.current?.preview(name,snapBoardPoint(point,snapRef.current),false);
  // A multi-node release fires once per dragged node in the same pass; the flush waits one microtask so each lands first.
  queueMicrotask(()=>{void gesture.current?.flushNow();});
 };

 return <section className="palace-board" aria-label="Palace board">
  <div className="palace-board-tools" role="toolbar" aria-label="Board tools">
   <button type="button" aria-pressed={marquee} title="Marquee: drag on the board to select regions" onClick={()=>setMarquee(on=>!on)}>Marquee</button>
   <button type="button" aria-pressed={snap} title="Snap: an authoring aid to the grid; positions stay free" onClick={()=>setSnap(on=>!on)}>Snap</button>
   <span className="palace-note">Drag a region anywhere. The walk order stays in the list below.</span>
  </div>
  <div className="palace-board-canvas">
   <CanvasView
    canvasKey={canvasKey}
    initialViewport={viewport}
    onViewportChange={next=>viewportRef.current(next)}
    nodes={nodes as unknown as ComponentProps<typeof CanvasView>['nodes']}
    edges={[]}
    selectedNodeIds={selected}
    selectionOnDrag={marquee}
    onSelectionChange={ids=>onSelect(boardSelection(names,ids))}
    onSelectNode={id=>onSelect(id===null?[]:boardSelection(names,[id]))}
    onMoveNodePreview={(name,point)=>preview(name,point,true)}
    onMoveNodeEnd={release}
   />
  </div>
 </section>;
}
