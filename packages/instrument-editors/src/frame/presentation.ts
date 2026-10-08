/** Instrument view state only. The native binding is supplied by its owner;
 * relocation never serialises a document, changes its target, or starts work. */
export type EditorDepth = 'folded' | 'compact' | 'full';
export type EditorPlacement = 'rack' | 'dock' | 'floating' | 'focused' | 'popout';
export interface EditorTarget {
  ownerRef: string;
  subjectRef: string;
  instanceRef: string;
  label: string;
  sourceRef?: string;
  sourceRevision?: string;
  sceneRef?: string;
}
export interface EditorGeometry {x: number; y: number; width: number; height: number}
export interface EditorConstraints {
  compact: {width: number; height: number; minWidth: number; minHeight: number};
  full: {width: number; height: number; minWidth: number; minHeight: number};
  aspect: 'free' | 'wide' | 'square';
  resize: 'reflow' | 'viewport';
  focusTargets: readonly string[];
  placements: readonly EditorPlacement[];
}
export interface EditorCheckpoint {
  schema: 'oi.instrument-editor-view/v1';
  instanceRef: string;
  target: EditorTarget;
  depth: EditorDepth;
  /** Retain the useful editor depth when a folded device is reopened after
   * workspace or native-window recovery. Older checkpoints remain valid. */
  unfoldedDepth?: 'compact' | 'full';
  placement: EditorPlacement;
  geometry: EditorGeometry;
  returnTo: {placement: EditorPlacement; geometry: EditorGeometry; depth: EditorDepth} | null;
  followSelection: boolean;
  view: Record<string, unknown>;
}
export interface EditorPresentationHost {
  /** Same native Surface and model/checkpoint route. It acknowledges the
   * presentation request; it must NOT create a new instrument/document. */
  relocate(request: Readonly<EditorCheckpoint>): Promise<void>;
  checkpoint?(reading: Readonly<EditorCheckpoint>): void;
  setVisible?(visible: boolean): void;
}
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
function validateTarget(target: EditorTarget) {
  if (![target.ownerRef, target.subjectRef, target.instanceRef, target.label].every(s => typeof s === 'string' && s.trim() && s.length <= 4096)) throw Error('An editor requires a disclosed native owner, subject and installed instance');
}
function geometry(value: EditorGeometry, constraints: EditorConstraints, depth: EditorDepth): EditorGeometry {
  if (![value.x,value.y,value.width,value.height].every(finite) || value.width > 32768 || value.height > 32768) throw Error('Invalid editor geometry');
  const size = depth === 'full' ? constraints.full : constraints.compact;
  return {...value, width: Math.max(size.minWidth,value.width), height: Math.max(size.minHeight,value.height)};
}
export function sameTarget(a: EditorTarget, b: EditorTarget) {
  return a.ownerRef === b.ownerRef && a.subjectRef === b.subjectRef && a.instanceRef === b.instanceRef && a.sceneRef === b.sceneRef;
}
/** A bound view survives React/window lifetimes. Its checkpoint is received
 * by the existing workspace state owner; this module has no storage runtime. */
export class InstrumentPresentation {
  private current: EditorCheckpoint;
  private listeners = new Set<() => void>();
  private transition = 0;
  private pending = false;
  private receivingVisible = true;
  private drafts = new Set<string>();
  private offered: EditorTarget | null = null;
  private unfolded: 'compact' | 'full' = 'compact';
  constructor(target: EditorTarget, readonly constraints: EditorConstraints, private host?: EditorPresentationHost, restored?: unknown) {
    validateTarget(target);
    const size = constraints.compact;
    this.current = {schema:'oi.instrument-editor-view/v1', instanceRef:target.instanceRef, target:{...target}, depth:'compact', unfoldedDepth:'compact', placement:'rack', geometry:{x:0,y:0,width:size.width,height:size.height}, returnTo:null, followSelection:false, view:{}};
    if (restored) this.restore(restored);
  }
  snapshot = (): Readonly<EditorCheckpoint> => this.current;
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  get busy() {return this.pending;}
  get pendingTarget() {return this.offered;}
  get hasDraft() {return this.drafts.size>0;}
  get visible(){return this.receivingVisible&&this.current.depth!=='folded';}
  private touch() {this.current = {...this.current}; this.listeners.forEach(listener => listener());}
  private publish(next: EditorCheckpoint) {
    this.current = next;
    this.host?.setVisible?.(this.receivingVisible&&next.depth !== 'folded');
    this.host?.checkpoint?.(this.checkpoint());
    this.listeners.forEach(listener => listener());
  }
  checkpoint(): EditorCheckpoint {return structuredClone(this.current);}
  setDraft(pending: boolean,source='editor') {if(!source||source.length>128)throw Error('Invalid editor input owner');if(pending)this.drafts.add(source);else this.drafts.delete(source);this.touch();}
  setFollowSelection(follow: boolean) {this.publish({...this.current,followSelection:follow});}
  selection(target: EditorTarget): boolean {
    validateTarget(target);
    if (!this.current.followSelection || sameTarget(this.current.target,target)) return false;
    if (this.hasDraft || this.pending || target.instanceRef !== this.current.instanceRef) {this.offered = {...target}; this.touch(); return false;}
    this.transfer(target); return true;
  }
  /** Deliberate retarget names the new basis; drafts must first be committed
   * or cancelled by their native owner. Focus alone never calls this. */
  transfer(target: EditorTarget) {
    validateTarget(target);
    if (this.hasDraft || this.pending) throw Error('Finish or cancel the current edit before transferring its target');
    if (target.instanceRef !== this.current.instanceRef) throw Error('Transfer cannot replace the installed instrument instance');
    this.offered = null;
    this.publish({...this.current,target:{...target},view:{}});
  }
  setDepth(depth: EditorDepth) {
    if (!['folded','compact','full'].includes(depth)) throw Error('Unknown editor depth');
    if (depth !== 'folded') this.unfolded = depth;
    this.publish({...this.current,depth,unfoldedDepth:this.unfolded,geometry:geometry(this.current.geometry,this.constraints,depth)});
  }
  unfold() {this.setDepth(this.unfolded);}
  resize(bounds: EditorGeometry) {this.publish({...this.current,geometry:geometry(bounds,this.constraints,this.current.depth)});}
  setVisible(visible:boolean){this.receivingVisible=visible;this.host?.setVisible?.(this.visible);}
  updateView(view: Record<string, unknown>) {
    const bytes = JSON.stringify(view);
    if (bytes.length > 4194304) throw Error('Editor view checkpoint exceeds its presentation bound');
    this.publish({...this.current,view:JSON.parse(bytes)});
  }
  async relocate(placement: EditorPlacement) {
    if (this.pending) throw Error('The previous presentation change is still pending');
    if (!this.constraints.placements.includes(placement)) throw Error('This editor does not support that placement');
    if (placement === this.current.placement) return;
    if (!this.host) throw Error('The current host has not supplied its Surface relocation adapter');
    const previous = this.current;
    const returnTo = placement === 'focused' || placement === 'popout'
      ? previous.returnTo ?? {placement:previous.placement, geometry:{...previous.geometry}, depth:previous.depth}
      : null;
    const next = {...previous,placement,depth:placement === 'focused' || placement === 'popout' ? 'full' as const : previous.depth,geometry:geometry(previous.geometry,this.constraints,placement==='focused'||placement==='popout'?'full':previous.depth),returnTo};
    const token = ++this.transition;
    this.pending = true; this.touch();
    try {await this.host.relocate(structuredClone(next)); if (token !== this.transition) throw Error('The editor presentation request was superseded'); if(next.depth!=='folded')this.unfolded=next.depth;this.publish({...this.current,placement:next.placement,depth:next.depth,unfoldedDepth:this.unfolded,geometry:geometry(this.current.geometry,this.constraints,next.depth),returnTo:next.returnTo});}
    finally {this.pending = false; this.touch();}
  }
  async restorePlacement() {
    if (!this.current.returnTo) return;
    if (this.pending) throw Error('The previous presentation change is still pending');
    if (!this.host) throw Error('The current host has not supplied its Surface relocation adapter');
    const returnTo = this.current.returnTo;
    const next = {...this.current,placement:returnTo.placement,geometry:{...returnTo.geometry},depth:returnTo.depth,returnTo:null};
    this.pending = true; this.touch();
    try {await this.host.relocate(structuredClone(next)); if(next.depth!=='folded')this.unfolded=next.depth;this.publish({...next,unfoldedDepth:this.unfolded,view:this.current.view,followSelection:this.current.followSelection});}
    finally {this.pending=false;this.touch();}
  }
  restore(value: unknown) {
    if (!value || typeof value !== 'object') throw Error('Invalid editor checkpoint');
    const v = value as EditorCheckpoint;
    if (v.schema !== 'oi.instrument-editor-view/v1' || v.instanceRef !== this.current.instanceRef || !v.target || !sameTarget(v.target,this.current.target)) throw Error('The checkpoint belongs to another native binding');
    if (!['folded','compact','full'].includes(v.depth) || !this.constraints.placements.includes(v.placement) || !v.view || typeof v.view !== 'object' || Array.isArray(v.view) || typeof v.followSelection !== 'boolean') throw Error('Invalid editor presentation checkpoint');
    validateTarget(v.target);
    if(v.unfoldedDepth!==undefined&&!['compact','full'].includes(v.unfoldedDepth))throw Error('Invalid recovered editor depth');
    if (v.returnTo && (!this.constraints.placements.includes(v.returnTo.placement) || !['folded','compact','full'].includes(v.returnTo.depth))) throw Error('Invalid editor return placement');
    const next = structuredClone(v);
    next.target = {...this.current.target};
    next.geometry = geometry(next.geometry,this.constraints,next.depth);
    if (next.returnTo) next.returnTo.geometry = geometry(next.returnTo.geometry,this.constraints,next.returnTo.depth);
    if (JSON.stringify(next.view).length > 4194304) throw Error('Editor view checkpoint exceeds its presentation bound');
    this.current = next;
    this.unfolded=next.depth==='folded'?(next.unfoldedDepth??'compact'):next.depth;
    this.current.unfoldedDepth=this.unfolded;
  }
}
