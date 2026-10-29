/** The Library as its own page (owner direction 2026-09-25): the ONE
 * Library gallery — the same libraryHTML, the same static composition
 * covers, the same kernel-held and native Library reads — served as a
 * light entry (`library.html`) the cradle opens in an ordinary canvas tab
 * WITHOUT booting the field engine. Composition physics stays in the
 * instrument (index.html); nothing here imports it.
 *
 * What this page does with each Library action:
 *   - browse/search/sections/horizons — local, exactly the app's grammar;
 *   - open, start-from and branch — handed to the host (workspace-mode
 *     host request): the instrument owns opening compositions, and it
 *     reads the SAME saved library from its own storage origin. An
 *     adopted local entry names its kernel ref on the open request (the
 *     instrument opens the kernel copy first, as the in-app Library does);
 *     the browser-draft action names the entry id;
 *   - origin notes — each saved card states its origin with the in-app
 *     wording (libraryCards.ts), read from readLibraryWithOrigins;
 *   - remove-saved — local (store.removeFromLibrary, the same store);
 *   - the native owner's kept drafts, every Expression's (O-I #763) —
 *     Restore as copy is local (a Library copy, the kept draft stays);
 *     Remove is the owner's remove, sent only after its confirmation;
 *   - close — a host request, so the cradle closes the tab.
 * Appearance rides the existing `oi-shell-cutout` host message; until it
 * lands, the OS preference leads. */

import {compositionCover,featuredExpressions,startingPoints,libraryHTML,collectionBinsOf,parseCollectionFilter,ownerKeptRemovalText,ownerKeptRemovedText,type CollectionBins,type CollectionFilter,type OwnerQuarantineSection} from './expressions.js';
import {readLibraryWithOrigins,libraryOpenPlan,removeFromLibrary} from './store.js';
import {decorateLibraryCard,libraryCardStanding,LIBRARY_CARD_DRAFT_ACTION} from './libraryCards.js';
import {nativeExpressionRequest,installKernelExpressions,kernelExpressionsAvailable} from './kernelExpressions.js';
import {installNativeLibraryInteractions} from './libraryScopes.js';
// T-REVIEW-6: the quarantine section reads and restores through the same recovery owner as the instrument.
import {quarantineView,restoreQuarantinedDraft,listKeptDrafts,restoreOwnerKeptDraft,removeOwnerKeptDraft} from './recovery.js';
import {keptDraftSections} from './draftStorage.js';
import {hostedScope} from './nativeRecovery.js';
import {esc} from './icons.js';

type StartingPoint = ReturnType<typeof startingPoints>[number];
type QuarantineState={rows:{id:string;key:string;name:string;reason:string;when:string;raw:string}[];unreadable:string[];message?:string};
let quarantine:QuarantineState={rows:[],unreadable:[]};
/** E26: the kernel's collections read as bins, read-only on this page (assignment belongs to the instrument). */
// undefined = not yet read (nothing stated); null = the read failed or was malformed (stated on the page).
let bins:CollectionBins|null|undefined=undefined;
/** E26: the bin choice on this page; a view state only, the data is re-read on every boot. */
let collectionFilter:CollectionFilter={kind:'all'};
function refreshBins(attempt=0):void{
  // The index is asked through the channel the host announces in answer to this page's hello; until the announce arrives it waits, as the
  // kernel-held and native sections do (libraryScopes.ts), rather than failing once at boot (O-I #763).
  if(!kernelExpressionsAvailable()&&attempt<4){setTimeout(()=>refreshBins(attempt+1),600);return;}
  void nativeExpressionRequest({operation:'index'}).then(index=>{bins=collectionBinsOf(index);renderLibrary();}).catch(()=>{bins=null;renderLibrary();});
}
/** The exact stored text of a quarantined draft, offered as a file. */
function downloadVerbatim(text:string,name:string):void{
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
/** Reads the quarantined drafts; a message names the last restore's outcome. */
function refreshQuarantine(message?:string):void{
  void quarantineView().then(view=>{quarantine={rows:view.rows,unreadable:view.unreadable,message};renderLibrary();}).catch(()=>undefined);
}

/** O-I #763: the native owner's kept drafts, every Expression's (recovery.ts listKeptDrafts). The DLW opens the Library on this page, never
 * the instrument's own Library (the frame stands on the shell's devices, where its Library… hands the summon to the shell), so this is where
 * a draft the owner kept is restored as a Library copy or removed. Read when the page opens and again after each Restore or Remove, and
 * only in a host, whose channel reaches the owner: the page opened alone has none. */
let kept:OwnerQuarantineSection[]=[];
function refreshKept(message?:{ref:string;text:string}):void{
 if(window.parent===window)return;
 void (async()=>{
  const before=kept;
  try{
   const listing=await listKeptDrafts(hostedScope());
   // Each Expression is titled as the works list names it; without that list, by its newest kept draft's own name.
   let titles=new Map<string,string>();
   if(listing.length)try{
    const works=await nativeExpressionRequest({operation:'list'}) as {expressions?:{expression_ref?:unknown;title?:unknown}[]}|null;
    titles=new Map((works?.expressions??[]).flatMap(work=>typeof work.expression_ref==='string'&&typeof work.title==='string'?[[work.expression_ref,work.title] as [string,string]]:[]));
   }catch{/* titled by the kept drafts */}
   kept=keptDraftSections(listing,titles,message);
   // The answer to a Remove that left an Expression no kept draft stays in that Expression's section, which now lists none.
   const gone=message&&!kept.some(section=>section.expressionRef===message.ref)?before.find(section=>section.expressionRef===message.ref):undefined;
   if(gone&&message)kept=[...kept,{expressionRef:message.ref,heading:gone.heading,rows:[],message:message.text}];
  }catch(cause){kept=[{rows:[],heading:'Kept drafts',error:`The native owner could not list the kept drafts. ${cause instanceof Error?cause.message:String(cause)}`}];}
  renderLibrary();
 })();
}
/** A removal is asked once, in the instrument's own wording (ownerKeptRemovalText): Remove sends it; Cancel or Escape sends nothing. */
function confirmed(title:string,body:string):Promise<boolean>{
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');
  dialog.className='modal';dialog.setAttribute('aria-label',title);
  dialog.innerHTML=`<p class="eyebrow">A DELIBERATE CHANGE</p><h2>${esc(title)}</h2><p class="intro">${esc(body)}</p><div class="confirm-row"><button type="button" class="secondary" data-choice="cancel">Cancel</button><button type="button" class="primary" data-choice="confirm">Remove</button></div>`;
  dialog.addEventListener('click',event=>{const button=(event.target as Element).closest<HTMLButtonElement>('button[data-choice]');if(button)dialog.close(button.dataset.choice);});
  dialog.addEventListener('close',()=>{const yes=dialog.returnValue==='confirm';dialog.remove();resolve(yes);});
  document.body.append(dialog);dialog.showModal();
 });
}

const page=():HTMLElement=>document.getElementById('library-page')!;
const hostRequest=(payload:{request:string;mode?:string;ref?:string;id?:string})=>{
  if(window.parent===window)return;
  try{window.parent.postMessage({v:1,kind:'host-request',...payload},'*');}catch{/* nothing sent rather than a wrong-channel throw */}
};

function hasLegacyLibrary():boolean{try{return !!localStorage.getItem('typographic_pointcloud_saved_states');}catch{return false;}}

let section:'collection'|'about'|string='collection';
let coverObserverLive:IntersectionObserver|null=null;
const covers=new Map<string,string>();

function renderLibrary():void{
  coverObserverLive?.disconnect();
  const {read:library,origins}=readLibraryWithOrigins();
  const scroll=page().scrollTop;
  const saved=library.journeys;
  const featured=featuredExpressions().filter(j=>!saved.some(s=>s.id===j.id));
  const starters:StartingPoint[]=startingPoints();
  const documents=new Map([...featured,...saved,...starters.map(p=>p.expression)].map(j=>[j.id,j]));
  const paint=(image:HTMLImageElement)=>{const j=documents.get(image.dataset.previewId!);if(j){image.src=compositionCover(j.scenes[0]);image.removeAttribute('data-preview-id');}};
  page().innerHTML=libraryHTML({saved,featured,starters,section,standalone:true,
    errors:library.blocked?['Browser storage is unavailable here. Export an expression from the instrument to keep a portable copy.']:library.errors,
    legacy:hasLegacyLibrary(),quarantine,ownerQuarantine:kept,bins,collectionFilter,cover:j=>covers.get(j.id)});
  page().scrollTop=scroll;
  // T22: each saved card names its origin, with the same note and actions the in-app Library shows (one wording, libraryCards.ts).
  page().querySelectorAll<HTMLButtonElement>('button[data-action="load-saved"][data-id]').forEach(button=>{
    const id=button.dataset.id!;
    decorateLibraryCard(button,id,libraryCardStanding(origins.get(id)));
  });
  const images=page().querySelectorAll<HTMLImageElement>('img[data-preview-id]');
  if(typeof IntersectionObserver==='undefined')images.forEach(paint);
  else{coverObserverLive=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){paint(entry.target as HTMLImageElement);coverObserverLive?.unobserve(entry.target);}},{root:page(),rootMargin:'160px'});images.forEach(image=>coverObserverLive!.observe(image));}
}

/** Theme awareness: the host names the shell's appearance on every
 * oi-shell-cutout message; the OS preference leads until it arrives. The
 * same body.night class the instrument uses flips the Library's palette
 * (workspace.css carries the night values). */
function applyAppearance(appearance:string){document.body.classList.toggle('night',appearance==='dark');}
window.addEventListener('message',ev=>{
  if(ev.source!==window.parent)return;
  const d=ev.data as {type?:string;appearance?:unknown}|null;
  if(d&&d.type==='oi-shell-cutout'&&(d.appearance==='dark'||d.appearance==='light'))applyAppearance(d.appearance);
});
try{applyAppearance(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}catch{}

// The kernel host channel the host relays (LibraryHost.tsx relayKernelChannel), armed before the page reads anything through it: the kept
// drafts, the kernel-held and native sections and the collections (O-I #763; app.ts arms it at its own boot).
installKernelExpressions();
installNativeLibraryInteractions();
(window as unknown as {__FIELD_STUDIES__:unknown}).__FIELD_STUDIES__={
  /** The standalone page cannot open a composition into a field it does
   * not host: opening hands to the instrument through the host. */
  openNative:()=>hostRequest({request:'workspace-mode',mode:'expressions'}),
};

document.addEventListener('click',event=>{
  const el=(event.target as HTMLElement|null)?.closest<HTMLElement>('[data-action]');
  if(!el)return;
  switch(el.dataset.action){
    case 'close-library':hostRequest({request:'close-library'});break;
    case 'library-section':section=el.dataset.section as typeof section;renderLibrary();page().scrollTop=0;break;
    case 'collection-filter':collectionFilter=parseCollectionFilter(el.dataset.filter??'');renderLibrary();break;
    // Opening, starting-from and branching land in the instrument: the host
    // brings the Expressions mode forward and its Library holds the same
    // entries (this page's store and the instrument's are one storage
    // origin). The branch/edit itself stays an instrument act.
    // T22: an adopted local entry opens its kernel copy first, as the in-app Library's open does; the kernel ref travels on the same
    // workspace-mode request. This page cannot reach the kernel itself: the host relays the ref to the instrument's follow path.
    case 'load-saved':{
      const id=el.dataset.id!;
      const plan=libraryOpenPlan(readLibraryWithOrigins().origins.get(id),true);
      hostRequest(plan.kind==='kernel-first'?{request:'workspace-mode',mode:'expressions',ref:plan.ref,id}:{request:'workspace-mode',mode:'expressions'});
      break;}
    case LIBRARY_CARD_DRAFT_ACTION:hostRequest({request:'workspace-mode',mode:'expressions',id:el.dataset.id});break;
    case 'fork-saved':
    case 'start-mode':
    case 'open-featured':hostRequest({request:'workspace-mode',mode:'expressions'});break;
    case 'delete-saved':{const id=el.dataset.id!;removeFromLibrary(id);covers.delete(id);renderLibrary();break;}
    case 'export-quarantine':{const row=quarantine.rows.find(r=>r.id===el.dataset.id);if(row)downloadVerbatim(row.raw,row.name.replace(/[^A-Za-z0-9._-]+/g,'-').slice(0,80)+'.quarantined.json');break;}
    case 'restore-quarantine':{const id=el.dataset.id!;void restoreQuarantinedDraft(id).then(copy=>refreshQuarantine(`Restored as a Library copy: ${copy.name}`)).catch(cause=>refreshQuarantine(cause instanceof Error?cause.message:String(cause)));break;}
    // O-I #763 (E19): an owner's kept draft becomes a Library copy, as in the instrument's Library; the kept draft stays where it is.
    case 'restore-owner-kept':{const id=el.dataset.id,ref=el.dataset.ref;if(id&&ref)void restoreOwnerKeptDraft(ref,hostedScope(),id).then(copy=>refreshKept({ref,text:`Restored as a Library copy: ${copy.name}`})).catch(cause=>refreshKept({ref,text:cause instanceof Error?cause.message:String(cause)}));break;}
    // Removing one is an explicit, confirmed request: nothing else here calls the owner's remove.
    case 'remove-owner-kept':{const id=el.dataset.id,ref=el.dataset.ref,row=kept.find(section=>section.expressionRef===ref)?.rows.find(r=>r.id===id);
     if(id&&ref&&row)void confirmed('Remove this kept draft?',ownerKeptRemovalText(row)).then(yes=>yes?removeOwnerKeptDraft(ref,hostedScope(),id).then(remaining=>refreshKept({ref,text:ownerKeptRemovedText(remaining)})):undefined)
      .catch(cause=>refreshKept({ref,text:cause instanceof Error?cause.message:String(cause)}));
     break;}
  }
});
document.addEventListener('input',event=>{
  const input=event.target as HTMLInputElement|null;
  if(input?.id!=='library-search')return;
  const query=input.value.trim().toLowerCase();
  let count=0;
  document.querySelectorAll<HTMLElement>('#library-page [data-starting-card]').forEach(item=>{item.hidden=!item.dataset.search?.includes(query);if(!item.hidden)count++;});
  const empty=document.getElementById('library-empty');
  if(empty)empty.hidden=count>0;
});

renderLibrary();
refreshQuarantine();
refreshKept();
refreshBins();
// The host's ready watch reads the same oi-app-state announcement the
// instrument makes — one boot handshake grammar.
try{window.parent.postMessage({v:1,kind:'oi-app-state',state:{libraryOpen:true}},'*');}catch{}
