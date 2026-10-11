import {useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {InstrumentPresentation,type EditorConstraints,type EditorPresentationHost,type EditorTarget} from './presentation.ts';
import './frame.css';
import {EditorFailureBoundary} from './EditorFailureBoundary';
export interface InstrumentDefinition {id:string;name:string;constraints:EditorConstraints;targetIds:readonly string[]}
export interface InstrumentFrameProps {
  definition: InstrumentDefinition;
  presentation: InstrumentPresentation;
  visible?:boolean;
  children: (depth:'compact'|'full',visible:boolean)=>ReactNode;
  commands?: readonly {id:string;title:string;disabled?:boolean;run:()=>Promise<unknown>|void}[];
}
export function createInstrumentPresentation(definition: InstrumentDefinition,target:EditorTarget,host?:EditorPresentationHost,checkpoint?:unknown) {return new InstrumentPresentation(target,definition.constraints,host,checkpoint);}
export function InstrumentFrame({definition,presentation,children,commands=[],visible=true}:InstrumentFrameProps) {
  const state=useSyncExternalStore(presentation.subscribe,presentation.snapshot,presentation.snapshot);
  useEffect(()=>{presentation.setVisible(visible&&state.depth!=='folded');return()=>presentation.setVisible(false);},[presentation,visible,state.depth]);
  const root=useRef<HTMLElement>(null),expand=useRef<HTMLButtonElement>(null),fold=useRef<HTMLButtonElement>(null),contentFocus=useRef<HTMLElement|null>(null),lastDepth=useRef(state.depth);
  useEffect(()=>{
    const prior=lastDepth.current;lastDepth.current=state.depth;
    if(prior===state.depth||!root.current||!root.current.contains(document.activeElement))return;
    if(state.depth==='folded'){fold.current?.focus();return;}
    const retained=contentFocus.current;
    if(retained?.isConnected&&!retained.closest('[hidden]')){retained.focus({preventScroll:true});return;}
    for(const selector of definition.constraints.focusTargets){const target=root.current.querySelector<HTMLElement>(selector);if(target&&!target.closest('[hidden]')&&!target.matches(':disabled')){target.focus({preventScroll:true});if(document.activeElement===target)break;}}
  },[state.depth,definition.constraints.focusTargets]);
  const [notice,setNotice]=useState<string|null>(null),[menu,setMenu]=useState(false);
  const execute=(action:()=>void|Promise<unknown>)=>{setNotice(null);try{Promise.resolve(action()).catch(error=>setNotice(error instanceof Error?error.message:String(error)));}catch(error){setNotice(error instanceof Error?error.message:String(error));}};
  const focused=state.placement==='focused';
  const depth=state.depth==='full'?'full':'compact';
  return <section ref={root} className={`instrument-frame instrument-frame--${state.depth}`} data-instrument={definition.id} data-placement={state.placement} aria-label={`${definition.name}: ${state.target.label}`} onFocusCapture={event=>{const target=event.target as HTMLElement;if(target.closest('.instrument-content'))contentFocus.current=target;}} style={{minWidth:depth==='full'?definition.constraints.full.minWidth:definition.constraints.compact.minWidth,minHeight:state.depth==='folded'?30:depth==='full'?definition.constraints.full.minHeight:definition.constraints.compact.minHeight}} onKeyDown={event=>{
    if (event.defaultPrevented || (event.target as HTMLElement).matches('input,textarea,select,[contenteditable=true]') || event.ctrlKey || event.metaKey || event.altKey) return;
    if(event.key==='Escape'&&focused){event.preventDefault();execute(()=>presentation.restorePlacement());}
    if(event.key==='f'&&definition.constraints.placements.includes('focused')){event.preventDefault();execute(()=>focused?presentation.restorePlacement():presentation.relocate('focused'));}
  }}>
    <header className="instrument-identity">
      <button ref={fold} disabled={presentation.busy} aria-label={state.depth==='folded'?`Reopen ${definition.name}`:`Fold ${definition.name}`} aria-expanded={state.depth!=='folded'} onClick={()=>state.depth==='folded'?presentation.unfold():presentation.setDepth('folded')}>{state.depth==='folded'?'▸':'▾'}</button>
      <strong>{definition.name}</strong><span className="instrument-target" title={[state.target.subjectRef,state.target.sceneRef].filter(Boolean).join(' · ')}>{state.target.label}</span>
      <button aria-pressed={!state.followSelection} title={state.followSelection?'Follow deliberate selection':'Pinned to this target'} onClick={()=>presentation.setFollowSelection(!state.followSelection)}>{state.followSelection?'Follow':'Pin'}</button>
      <button ref={expand} disabled={presentation.busy} aria-label={state.depth==='full'?`Compact ${definition.name}`:`Expand ${definition.name}`} onClick={()=>presentation.setDepth(state.depth==='full'?'compact':'full')}>{state.depth==='full'?'↙':'↗'}</button>
      {state.returnTo&&<button disabled={presentation.busy} onClick={()=>execute(()=>presentation.restorePlacement())}>Return</button>}
      <button aria-label={`${definition.name} presentation and commands`} aria-expanded={menu} onClick={()=>setMenu(!menu)}>⋯</button>
    </header>
    {menu&&<div role="menu" className="instrument-menu">
      {definition.constraints.placements.filter(placement=>placement!==state.placement).map(placement=><button role="menuitem" key={placement} disabled={presentation.busy} onClick={()=>{setMenu(false);execute(()=>presentation.relocate(placement));}}>{placement==='popout'?'Native popout':placement==='focused'?'Focus workspace':`Move to ${placement}`}</button>)}
      {commands.map(command=><button role="menuitem" key={command.id} disabled={command.disabled} onClick={()=>{setMenu(false);execute(command.run);}}>{command.title}</button>)}
      <details><summary>Source and binding</summary><dl><dt>Native subject</dt><dd>{state.target.subjectRef}</dd>{state.target.sceneRef&&<><dt>Native Scene</dt><dd>{state.target.sceneRef}</dd></>}<dt>Instrument instance</dt><dd>{state.target.instanceRef}</dd><dt>Owner</dt><dd>{state.target.ownerRef}</dd>{state.target.sourceRef&&<><dt>Source</dt><dd>{state.target.sourceRef} {state.target.sourceRevision}</dd></>}</dl></details>
    </div>}
    {notice&&<p className="instrument-notice" role="alert">{notice}</p>}
    {presentation.pendingTarget&&<p className="instrument-notice">Selection changed to {presentation.pendingTarget.label}. Finish this edit before transferring the target.</p>}
    <div className="instrument-content" hidden={state.depth==='folded'||!visible}><EditorFailureBoundary key={`${state.target.ownerRef}:${state.target.subjectRef}:${state.target.sceneRef??''}`} name={definition.name} presentation={presentation}>{children(depth,visible&&state.depth!=='folded')}</EditorFailureBoundary></div>
  </section>;
}
