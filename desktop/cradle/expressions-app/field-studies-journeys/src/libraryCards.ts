/** T22 · the Library card note, one wording for the in-app Library (app.ts) and the standalone Library page (library.ts).
 *
 * A saved card names where its document came from: a kernel copy by its ref, an adopted local draft by the kernel document it was saved
 * into, or browser work the kernel has not recorded. The wording and the classes live here once; both pages import them. */
import {shortenRef} from './deepLinks.js';
import type {LibraryOrigin} from './libraryStore.js';

/** What a saved card states about its origin. `kernelRef` is set for a kernel copy; `adopted` for a local draft that its first kernel save adopted. */
export interface LibraryCardStanding{kernelRef?:string;adopted?:{ref:string;title:string}}

/** The standing a card reads. The entry's own origin decides it; `boundOrigin` is the origin of the open document when the page holds it
 * (the in-app Library's current document), and a kernel-bound open document names its kernel copy even when the entry is a local draft. */
export function libraryCardStanding(origin:LibraryOrigin|undefined,boundOrigin?:LibraryOrigin):LibraryCardStanding{
 const kernelRef=origin?.kind==='kernel-ref'?origin.ref:boundOrigin?.kind==='kernel-ref'?boundOrigin.ref:undefined;
 const adopted=origin?.kind==='local-draft'&&origin.adopted_into?{ref:origin.adopted_into,title:origin.adopted_title??''}:undefined;
 return {kernelRef,adopted};
}

/** The note a card carries. Wording is the in-app wording, unchanged. */
export function libraryCardNoteText(standing:LibraryCardStanding):string{
 return standing.kernelRef?`Kernel copy · ${shortenRef(standing.kernelRef)}`
  :standing.adopted?`Saved to the kernel as “${standing.adopted.title||shortenRef(standing.adopted.ref)}”`
  :'Draft in this browser';
}

/** The Library entry that holds the browser copy of a kernel ref, or undefined when none does: an adopted local draft first (its own
 * work), then a kernel-ref copy of the same document. This is the copy an in-app open falls back to when the kernel refuses the ref. */
export function localCopyIdFor(ref:string,origins:ReadonlyMap<string,LibraryOrigin>):string|undefined{
 let copy:string|undefined;
 for(const [id,origin] of origins){
  if(origin.kind==='local-draft'&&origin.adopted_into===ref)return id;
  if(copy===undefined&&origin.kind==='kernel-ref'&&origin.ref===ref)copy=id;
 }
 return copy;
}

/** The data-action of the "Open browser draft" action an adopted card offers beside its kernel copy. Both pages handle this action. */
/** What a refused kernel open says. With a browser copy to open, it says so; with none, it says the current document stays open. The copy
 * is named only when one is actually opened. */
export function kernelCopyRefusalMessage(hasCopy:boolean):string{
 return `The kernel copy of this Expression could not be opened. ${hasCopy?'The browser copy opens instead.':'The current document stays open.'}`;
}
export const LIBRARY_CARD_DRAFT_ACTION='open-local-draft';
export const LIBRARY_CARD_DRAFT_TEXT='Open browser draft';

/** Appends a card's note to its open button and, for an adopted local draft, the "Open browser draft" action beside the card. */
export function decorateLibraryCard(open:HTMLElement,id:string,standing:LibraryCardStanding):void{
 const note=document.createElement('span');note.className='oi-lib-note';
 note.textContent=libraryCardNoteText(standing);
 open.append(note);
 if(standing.adopted){
  // The browser draft stays openable beneath the kernel copy the card opens first.
  const draft=document.createElement('button');draft.type='button';draft.className='oi-lib-note';draft.dataset.action=LIBRARY_CARD_DRAFT_ACTION;draft.dataset.id=id;draft.textContent=LIBRARY_CARD_DRAFT_TEXT;
  open.closest('article')?.append(draft);
 }
}
