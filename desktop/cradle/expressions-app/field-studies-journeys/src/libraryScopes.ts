/** Library horizons — the two navigation horizons of the O:I Expressions
 * Library (owner direction 2026-09-19): MY WORLD / PERSONAL, the current
 * project/world and the collections this instrument already keeps, and
 * O:I WEB / SHARED, the continuous local/shared field whose native
 * contracts are SharedField / Projection / WikiSpace and whose discovery
 * operation is Explore. This module augments the ONE Library interaction
 * — same page, same typography, same card grammar — never a second
 * Library and never a generic project dashboard.
 *
 * Honesty law: every scope renders what is actually reachable. Personal
 * material is the app's own live model. Kernel-held expressions are read
 * through the kernelExpressions host channel when the host has announced
 * it (feature-detected; never assumed, never copied into browser
 * storage). Projected worlds have no shared provider reachable from this
 * application on this cut, and the shared horizon says exactly that
 * instead of inventing results. Search resolves native subjects only —
 * kernel rows carry their real expression refs through the Library's
 * existing search grammar; no copied database exists or is searched. */

import {esc} from './icons.js';
import {kernelExpressionsAvailable,listKernelExpressions,KernelExpressionListing} from './kernelExpressions.js';

export type {KernelExpressionListing} from './kernelExpressions.js';

function withTimeout<T>(p:Promise<T>,ms:number):Promise<T> {
  return new Promise<T>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('kernel expressions read timed out')),ms);
    p.then(value=>{clearTimeout(timer);resolve(value);},cause=>{clearTimeout(timer);reject(cause);});
  });
}

export type LibraryHorizon='world'|'web';
/** The horizons ride the Library's own section state ('collection' /
 * 'collection:web'), so switching them reuses the existing library-section
 * action and its re-render path — no new event surface. */
export function horizonOf(section:string):LibraryHorizon {return section==='collection:web'?'web':'world';}
export const isWebHorizon=(section:string):boolean=>horizonOf(section)==='web';

const horizonTab=(active:boolean,sectionValue:string,name:string,sub:string)=>
  `<button class="oi-lib-horizon${active?' active':''}" data-action="library-section" data-section="${sectionValue}" aria-current="${active?'page':'false'}"><span class="oi-lib-horizon-name">${esc(name)}</span><span class="oi-lib-horizon-sub">${esc(sub)}</span></button>`;

/** The two immediately legible horizons, at the top of the Library body. */
export function libraryHorizonsHTML(section:string):string {
  const web=isWebHorizon(section);
  return `<nav class="oi-lib-horizons" aria-label="Library horizons">${horizonTab(!web,'collection','MY WORLD','/ Personal · this project & your collections')}${horizonTab(web,'collection:web','O:I WEB','/ Shared · the continuous field')}</nav>`;
}

/** The named honest state of the shared horizon on this cut. */
export const PROJECTED_WORLDS_UNAVAILABLE='Projected worlds are not reachable from this application yet — the SharedField provider is the native owner.';

/** Kernel-held expressions: a live read of what the native kernel holds,
 * in the Library's own section grammar. The list fills asynchronously —
 * scheduleKernelFill writes into the live section once the channel
 * answers. */
export function libraryKernelSectionHTML():string {
  scheduleKernelFill();
  return `<section class="library-section" data-scope="kernel-held"><header><h2>Kernel-held expressions</h2><span>Held by the native kernel · read live, never copied</span></header><div class="oi-lib-kernel-list" data-kernel-list data-kernel-state="pending"><p class="oi-lib-note">Reading the kernel…</p></div></section>`;
}

type KernelFill={state:'absent'|'error'|'empty'|'rows';rows:KernelExpressionListing[]};
type KernelState=KernelFill['state'];

function kernelListHTML(fill:KernelFill):string {
  const {state,rows}=fill;
  if(state==='absent')return `<p class="oi-lib-note">The kernel host channel has not been announced by this host yet. Kernel-held expressions stay where they are held; this list reads them live once the host opens the channel.<small>kernelExpressions channel · not announced</small></p>`;
  if(state==='error')return `<p class="oi-lib-note">The kernel could not be read just now. Nothing was invented to fill its place; try again.</p>`;
  if(!rows.length)return `<p class="oi-lib-note">The kernel holds no expressions yet.</p>`;
  return rows.map(r=>{
    const initial=(r.title||r.expression_ref).trim().charAt(0).toUpperCase()||'·';
    const touched=r.last_touched_unix?new Date(r.last_touched_unix*1000).toLocaleDateString():undefined;
    const meta=[`rev ${r.revision}`,r.dirty?'unsaved edits':undefined,touched?`touched ${touched}`:undefined].filter(Boolean).join(' · ');
    return `<div class="oi-lib-kernel-row" data-starting-card data-search="${esc((r.title+' '+r.expression_ref).toLowerCase())}"><span class="oi-lib-kernel-mark" aria-hidden="true">${esc(initial)}</span><span class="oi-lib-kernel-main"><strong>${esc(r.title)}</strong><span class="oi-lib-kernel-ref">${esc(r.expression_ref)}</span></span><span class="oi-lib-kernel-meta">${esc(meta)}</span></div>`;
  }).join('');
}

let kernelFillSeq=0;
/** Fill the kernel section once the asynchronous channel answers. Only the
 * latest fill writes (stale ones are dropped by token), only into a live
 * section, and the Library search is re-applied so late rows respect the
 * active query. Availability is checked twice — the host's channel
 * announce can land just after the section renders. Every channel call is
 * availability-gated and try-caught: an absent or refusing channel is
 * rendered as the named honest state, never as invented rows. */
function scheduleKernelFill():void {
  if(typeof document==='undefined')return;
  const seq=++kernelFillSeq;
  void (async()=>{
    let fill:KernelFill={state:'absent',rows:[]};
    try {
      let available=false;
      for(let attempt=0;attempt<2&&!available;attempt++){
        if(attempt)await new Promise(r=>setTimeout(r,1200));
        try {available=kernelExpressionsAvailable();}
        catch {available=false;}
      }
      if(available){
        try {
          const rows=await withTimeout(listKernelExpressions(),6000);
          fill=Array.isArray(rows)&&rows.length>0?{state:'rows',rows}:{state:'empty',rows:[]};
        } catch {fill={state:'error',rows:[]};}
      }
    } catch {fill={state:'absent',rows:[]};}
    if(seq!==kernelFillSeq)return;
    const host=document.querySelector<HTMLElement>('#library-page [data-kernel-list]');
    if(!host||!host.isConnected)return;
    host.innerHTML=kernelListHTML(fill);
    host.setAttribute('data-kernel-state',fill.state);
    if(fill.state==='rows')reapplyLibrarySearch();
  })();
}

function reapplyLibrarySearch():void {
  if(typeof document==='undefined')return;
  const input=document.getElementById('library-search') as HTMLInputElement|null;
  const query=input?input.value.trim().toLowerCase():'';
  if(!query)return;
  let count=0;
  document.querySelectorAll<HTMLElement>('#library-page [data-starting-card]').forEach(item=>{item.hidden=!item.dataset.search?.includes(query);if(!item.hidden)count++;});
  const empty=document.getElementById('library-empty');
  if(empty)empty.hidden=count>0;
}

/** The horizons' own styles, emitted with the Library page — the scope
 * grammar ships with its markup and touches no shared stylesheet. */
export const libraryScopesStyle=`
.oi-lib-horizons{display:flex;gap:34px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin:0 0 44px}
.oi-lib-horizon{display:flex;flex-direction:column;gap:3px;padding:15px 0 14px;text-align:left;color:var(--muted);border-bottom:1px solid transparent;margin-bottom:-1px;border-radius:0}
.oi-lib-horizon-name{font-size:11px;letter-spacing:.14em;font-weight:600}
.oi-lib-horizon-sub{font-size:8px;letter-spacing:.1em}
.oi-lib-horizon.active{color:var(--ink);border-bottom-color:var(--ink)}
.oi-lib-horizon:not(.active):hover{color:var(--accent)}
.oi-lib-note{font:italic 15px/1.75 var(--serif);color:var(--muted);max-width:560px;padding:4px 0}
.oi-lib-note small{display:block;font:9px/1.7 var(--sans);letter-spacing:.06em;color:var(--muted);opacity:.8;margin-top:7px;font-style:normal}
.oi-lib-kernel-list{border-top:1px solid var(--line)}
.oi-lib-kernel-row{display:flex;align-items:center;gap:16px;padding:13px 0;border-bottom:1px solid var(--line)}
.oi-lib-kernel-row[hidden]{display:none}
.oi-lib-kernel-mark{width:34px;height:34px;flex:none;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:50%;font:15px var(--serif);color:var(--muted)}
.oi-lib-kernel-main{flex:1;min-width:0}
.oi-lib-kernel-main strong{display:block;font:17px var(--serif);font-weight:400;letter-spacing:-.02em}
.oi-lib-kernel-ref{display:block;font-size:9px;color:var(--muted);font-variant-numeric:tabular-nums;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.oi-lib-kernel-meta{font-size:9px;color:var(--muted);flex:none}
@media (max-width:760px){.oi-lib-horizons{gap:18px}.oi-lib-horizon-sub{display:none}}`;
