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
 *     reads the SAME saved library from its own storage origin;
 *   - remove-saved — local (store.removeFromLibrary, the same store);
 *   - close — a host request, so the cradle closes the tab.
 * Appearance rides the existing `oi-shell-cutout` host message; until it
 * lands, the OS preference leads. */

import {compositionCover,featuredExpressions,startingPoints,libraryHTML,collectionBinsOf,type CollectionBins} from './expressions.js';
import {readLibraryDetailed,removeFromLibrary} from './store.js';
import {nativeExpressionRequest} from './kernelExpressions.js';
import {installNativeLibraryInteractions} from './libraryScopes.js';
// T-REVIEW-6: the quarantine section reads and restores through the same recovery owner as the instrument.
import {quarantineView,restoreQuarantinedDraft} from './recovery.js';

type StartingPoint = ReturnType<typeof startingPoints>[number];
type QuarantineState={rows:{id:string;key:string;name:string;reason:string;when:string;raw:string}[];unreadable:string[];message?:string};
let quarantine:QuarantineState={rows:[],unreadable:[]};
/** E26: the kernel's collections read as bins, read-only on this page (assignment belongs to the instrument). */
let bins:CollectionBins|null=null;
function refreshBins():void{
  void nativeExpressionRequest({operation:'index'}).then(index=>{bins=collectionBinsOf(index);renderLibrary();}).catch(()=>{bins=null;});
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

const page=():HTMLElement=>document.getElementById('library-page')!;
const hostRequest=(payload:{request:string;mode?:string})=>{
  if(window.parent===window)return;
  try{window.parent.postMessage({v:1,kind:'host-request',...payload},'*');}catch{/* nothing sent rather than a wrong-channel throw */}
};

function hasLegacyLibrary():boolean{try{return !!localStorage.getItem('typographic_pointcloud_saved_states');}catch{return false;}}

let section:'collection'|'about'|string='collection';
let coverObserverLive:IntersectionObserver|null=null;
const covers=new Map<string,string>();

function renderLibrary():void{
  coverObserverLive?.disconnect();
  const library=readLibraryDetailed();
  const scroll=page().scrollTop;
  const saved=library.journeys;
  const featured=featuredExpressions().filter(j=>!saved.some(s=>s.id===j.id));
  const starters:StartingPoint[]=startingPoints();
  const documents=new Map([...featured,...saved,...starters.map(p=>p.expression)].map(j=>[j.id,j]));
  const paint=(image:HTMLImageElement)=>{const j=documents.get(image.dataset.previewId!);if(j){image.src=compositionCover(j.scenes[0]);image.removeAttribute('data-preview-id');}};
  page().innerHTML=libraryHTML({saved,featured,starters,section,standalone:true,
    errors:library.blocked?['Browser storage is unavailable here. Export an expression from the instrument to keep a portable copy.']:library.errors,
    legacy:hasLegacyLibrary(),quarantine,bins,cover:j=>covers.get(j.id)});
  page().scrollTop=scroll;
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
    // Opening, starting-from and branching land in the instrument: the host
    // brings the Expressions mode forward and its Library holds the same
    // entries (this page's store and the instrument's are one storage
    // origin). The branch/edit itself stays an instrument act.
    case 'load-saved':
    case 'fork-saved':
    case 'start-mode':
    case 'open-featured':hostRequest({request:'workspace-mode',mode:'expressions'});break;
    case 'delete-saved':{const id=el.dataset.id!;removeFromLibrary(id);covers.delete(id);renderLibrary();break;}
    case 'export-quarantine':{const row=quarantine.rows.find(r=>r.id===el.dataset.id);if(row)downloadVerbatim(row.raw,row.name.replace(/[^A-Za-z0-9._-]+/g,'-').slice(0,80)+'.quarantined.json');break;}
    case 'restore-quarantine':{const id=el.dataset.id!;void restoreQuarantinedDraft(id).then(copy=>refreshQuarantine(`Restored as a Library copy: ${copy.name}`)).catch(cause=>refreshQuarantine(cause instanceof Error?cause.message:String(cause)));break;}
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
refreshBins();
// The host's ready watch reads the same oi-app-state announcement the
// instrument makes — one boot handshake grammar.
try{window.parent.postMessage({v:1,kind:'oi-app-state',state:{libraryOpen:true}},'*');}catch{}
