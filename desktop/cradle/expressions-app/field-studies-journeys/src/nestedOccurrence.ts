/** Nested expression occurrence (lane-3 TARGET-SET E14).
 *
 * Places another saved Expression into a Scene as a bounded occurrence: it
 * plays inside the host Scene's timing and stays addressable by its own
 * `expression_ref`. The occurrence exists only as the kernel's native record,
 * which is the Scene body with carrier `expression_ref` (kernel
 * expression_carrier.rs, `RecursionBound` 1..=4). `reuse_set` is NOT that
 * record: the reuse block describes reusable material and its refs must name
 * the document's own Scenes and entities (expression.rs `Reuse::validate`).
 *
 * This module is pure and self-contained (no imports) so the same logic is
 * type-checked by the journeys build and exercised by the cradle tests. The
 * app performs every effect (the library read, the native edit, the toast). */

export const NESTED_DEPTH_MIN=1;
export const NESTED_DEPTH_MAX=4;
export const NESTED_DEFAULT_DEPTH=1;
/** Kernel members bound per document (expression.rs DOCUMENT_MEMBERS) and Scenes per Expression (composition_budget). */
export const NESTED_MEMBER_LIMIT=2048;
export const NESTED_SCENE_LIMIT=64;
/** Documents one evaluation reads from the Library before it reports unread. */
export const NESTED_GRAPH_LIMIT=16;
/** Renderer window one Scene page is held to: the bridge's PAGE_ENTITY_LIMIT and the engine's formation/pin budgets. */
export interface NestedWindow {formations:number;pins:number;entities:number}
export const NESTED_WINDOW:NestedWindow={formations:64,pins:64,entities:32};

export interface NestedSubject {expression_ref:string;revision:number|string;title?:string}
export interface NestedReading {ref:string;revision:string;availability:'available'}
/** The kernel `SceneBody` for carrier `expression_ref`, field for field. */
export interface NestedBody {
 carrier:'expression_ref';subject_ref:string;native_owner:'oi';
 reading:NestedReading;provenance:NestedReading[];actions:[];
 presentation:'inline';capability:{state:'renderable'};span:null;
 recursion:{host_expression_ref:string;max_depth:number};
}
/** What the bridge reports for a Scene whose body is a nested occurrence. */
export interface NestedBinding {subject_ref:string;max_depth:number;state:'ready'|'refused'|'unread';depth?:number;members?:number;reason?:string}

/** A kernel document as far as nesting needs it. */
export interface NestedDocumentLike {
 expression_ref:string;
 scenes?:{scene_ref?:string;entity_refs?:unknown[];body?:{carrier?:unknown;subject_ref?:unknown}|null}[];
 entities?:Record<string,unknown>;
}
export type NestedGraph=Map<string,NestedDocumentLike>;

const EXPRESSION_REF=/^expression:\S+$/;

/** Refusal by name for a placement, or null when the placement is admitted. */
export function nestedRefusal(host:string,subject:NestedSubject,maxDepth:number):string|null{
 if(typeof subject?.expression_ref!=='string'||!EXPRESSION_REF.test(subject.expression_ref))
  return `"${String(subject?.expression_ref)}" is not a saved Expression ref; only saved Expressions can be placed in a Scene.`;
 if(subject.expression_ref===host)return 'An Expression cannot be placed inside its own Scene.';
 if(!Number.isInteger(maxDepth)||maxDepth<NESTED_DEPTH_MIN||maxDepth>NESTED_DEPTH_MAX)
  return `Nesting depth must be ${NESTED_DEPTH_MIN} to ${NESTED_DEPTH_MAX}; the kernel admits no other depth.`;
 const revision=String(subject.revision??'').trim();
 if(!revision)return `"${subject.expression_ref}" has no revision to reference; save it before placing it.`;
 return null;
}

/** The kernel body for one placement. Throws the refusal by name. */
export function nestedBodyFor(host:string,subject:NestedSubject,maxDepth:number=NESTED_DEFAULT_DEPTH):NestedBody{
 const refusal=nestedRefusal(host,subject,maxDepth);
 if(refusal)throw new Error(refusal);
 const reading:NestedReading={ref:subject.expression_ref,revision:String(subject.revision),availability:'available'};
 return {carrier:'expression_ref',subject_ref:subject.expression_ref,native_owner:'oi',reading,provenance:[reading],actions:[],
  presentation:'inline',capability:{state:'renderable'},span:null,recursion:{host_expression_ref:host,max_depth:maxDepth}};
}

export type NestedSceneSet={change:'scene_body_set';scene_ref:string;body:NestedBody};
export type NestedSceneClear={change:'scene_body_clear';scene_ref:string};

/** Place: the one kernel edit that creates the occurrence. */
export function placeNestedChange(sceneRef:string,body:NestedBody):NestedSceneSet{
 return {change:'scene_body_set',scene_ref:sceneRef,body};
}
/** Resize: the same occurrence (same subject, same reading) with a new admitted
 * depth. Takes the body as the kernel returned it, so a native body resizes as is. */
export function resizeNestedChange<B extends {subject_ref:string;recursion:{host_expression_ref:string;max_depth:number}|null}>(sceneRef:string,current:B,maxDepth:number):{change:'scene_body_set';scene_ref:string;body:B}{
 if(!Number.isInteger(maxDepth)||maxDepth<NESTED_DEPTH_MIN||maxDepth>NESTED_DEPTH_MAX)
  throw new Error(`Nesting depth must be ${NESTED_DEPTH_MIN} to ${NESTED_DEPTH_MAX}; the kernel admits no other depth.`);
 if(!current.recursion)throw new Error('This Scene holds no nested expression to resize.');
 return {change:'scene_body_set',scene_ref:sceneRef,body:{...current,recursion:{...current.recursion,max_depth:maxDepth}}};
}
/** Remove: clears the Scene body that carried the occurrence. */
export function removeNestedChange(sceneRef:string):NestedSceneClear{
 return {change:'scene_body_clear',scene_ref:sceneRef};
}
/** The depth a resize affordance steps to: 1 → 2 → 3 → 4 → 1. */
export function nextNestedDepth(current:number):number{
 return current>=NESTED_DEPTH_MAX||!Number.isInteger(current)||current<NESTED_DEPTH_MIN?NESTED_DEPTH_MIN:current+1;
}

/** Whether a Scene body (raw or typed) is a nested occurrence. */
export function isNestedBody(body:unknown):body is NestedBody{
 return !!body&&typeof body==='object'&&(body as {carrier?:unknown}).carrier==='expression_ref';
}

/** Evaluate an occurrence against its nested graph, within the admitted depth
 * and the kernel's member and Scene budgets. Refuses by name; never drops a
 * level silently. `unread` means a document in the chain is not in `graph`. */
export function nestedEvaluation(host:string,body:{subject_ref:string;recursion:{host_expression_ref:string;max_depth:number}|null|undefined},graph:NestedGraph):NestedBinding{
 const bound=body.recursion;
 const base={subject_ref:body.subject_ref,max_depth:bound?.max_depth??0};
 if(!bound)return {...base,state:'refused',reason:'The occurrence carries no nesting bound.'};
 if(bound.host_expression_ref!==host)return {...base,state:'refused',reason:'The nesting bound names another host Expression.'};
 if(!Number.isInteger(bound.max_depth)||bound.max_depth<NESTED_DEPTH_MIN||bound.max_depth>NESTED_DEPTH_MAX)
  return {...base,state:'refused',reason:`Nesting depth must be ${NESTED_DEPTH_MIN} to ${NESTED_DEPTH_MAX}.`};
 let deepest=0,members=0;
 const walk=(ref:string,path:string[],level:number):NestedBinding|null=>{
  if(ref===host)return {...base,state:'refused',reason:'The occurrence would contain its own host Expression.'};
  if(path.includes(ref))return {...base,state:'refused',reason:`The occurrence nests itself through ${ref}.`};
  if(level>bound.max_depth)return {...base,state:'refused',reason:`The occurrence nests ${level} levels deep; this placement admits ${bound.max_depth}.`};
  const doc=graph.get(ref);
  if(!doc)return {...base,state:'unread',reason:`Nested expression ${ref} is not read yet.`};
  const scenes=Array.isArray(doc.scenes)?doc.scenes:[];
  const count=doc.entities&&typeof doc.entities==='object'?Object.keys(doc.entities).length:0;
  if(scenes.length>NESTED_SCENE_LIMIT)return {...base,state:'refused',reason:`${ref} holds ${scenes.length} Scenes; the budget is ${NESTED_SCENE_LIMIT}.`};
  members+=count;
  if(members>NESTED_MEMBER_LIMIT)return {...base,state:'refused',reason:`The nested Expressions hold ${members} members; the budget is ${NESTED_MEMBER_LIMIT}.`};
  deepest=Math.max(deepest,level);
  for(const scene of scenes){
   const inner=scene?.body;
   if(!inner||inner.carrier!=='expression_ref'||typeof inner.subject_ref!=='string')continue;
   const refused=walk(inner.subject_ref,[...path,ref],level+1);
   if(refused)return refused;
  }
  return null;
 };
 const refused=walk(body.subject_ref,[host],1);
 if(refused)return refused;
 if(!graph.has(body.subject_ref))return {...base,state:'unread',reason:`Nested expression ${body.subject_ref} is not read yet.`};
 return {...base,state:'ready',depth:deepest,members};
}

/** The renderer-window verdict for an occurrence on one Scene page: the
 * occurrence occupies one member slot of the page it sits on. */
export function nestedWindowVerdict(loadedEntities:number,window:NestedWindow=NESTED_WINDOW):string|null{
 if(loadedEntities+1>window.entities)
  return `The Scene page already loads ${loadedEntities} of ${window.entities} members; an occurrence needs one more slot. Move a member to another page first.`;
 return null;
}

// ——— presentation (no I/O; the app mounts these) ———

function esc(value:string):string{
 return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string,string>)[c]);
}

/** The Scene strip class that gives a nested occurrence its sheen. */
export function nestedSceneClass(body:unknown):string{return isNestedBody(body)?' scene-nested':'';}

/** Scene-strip controls for the current Scene's occurrence, or the place affordance alone. */
export function nestedControlsHTML(body:unknown,binding?:NestedBinding|null):string{
 const place='<button class="scene-image scene-add scene-place" data-action="place-expression" aria-label="Place a saved expression in this scene" title="Place expression…"><span class="scene-place-mark" aria-hidden="true">+</span><small>Place</small></button>';
 if(!isNestedBody(body))return place;
 const title=esc(body.subject_ref);
 const depth=body.recursion.max_depth;
 // Only a refusal is shown. An unread verdict is the live state of the page
 // (the Library graph is read at placement) and is not a fault to display.
 const state=binding?.state==='refused'?`<p class="nested-refusal" role="status">${esc(binding.reason??'Refused.')}</p>`:'';
 return `${place}<div class="nested-controls" role="group" aria-label="Nested expression occurrence"><span class="nested-chip"><span class="nested-mark" aria-hidden="true"></span>Nested · ${title}</span><button data-action="resize-nested" aria-label="Change nesting depth, currently ${depth}">Depth ${depth}</button><button data-action="remove-nested" aria-label="Remove nested occurrence">Remove</button>${state}</div>`;
}

export interface PickerEntry {expression_ref:string;title:string;revision:number}

/** Choose a saved Expression from the Library's read. Opens a native dialog;
 * resolves through `onPick` only with an entry the Library listed. */
export function openNestedPicker(entries:readonly PickerEntry[],onPick:(entry:PickerEntry)=>void):void{
 if(typeof document==='undefined')throw new Error('The expression picker needs the Expressions window.');
 document.querySelector('dialog.nested-picker')?.remove();
 const dialog=document.createElement('dialog');
 dialog.className='nested-picker';
 dialog.setAttribute('aria-label','Place expression');
 const rows=entries.length
  ?entries.map((entry,i)=>`<button type="button" data-index="${i}" class="nested-pick"><span class="nested-pick-title">${esc(entry.title||entry.expression_ref)}</span><small>${esc(entry.expression_ref)} · r${entry.revision}</small></button>`).join('')
  :'<p class="nested-note">The Library holds no other saved expression to place. Save one first.</p>';
 dialog.innerHTML=`<form method="dialog" class="nested-picker-form"><h2>Place expression</h2><p class="nested-note">The occurrence plays inside this Scene's timing and keeps its own expression ref.</p><div class="nested-pick-list">${rows}</div><div class="nested-picker-actions"><button type="submit" value="cancel">Cancel</button></div></form>`;
 dialog.addEventListener('click',event=>{
  const target=(event.target as HTMLElement).closest<HTMLButtonElement>('button.nested-pick');
  if(!target)return;
  const entry=entries[Number(target.dataset.index)];
  dialog.close();dialog.remove();
  if(entry)onPick(entry);
 });
 dialog.addEventListener('close',()=>dialog.remove());
 document.body.appendChild(dialog);
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
}
