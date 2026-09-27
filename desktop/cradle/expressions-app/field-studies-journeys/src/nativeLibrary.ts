/** Native Library model + render helpers — the app-side half of the
 * "library-read" host request (kernelExpressions.ts::readLibraryEntries).
 * Pure, DOM-free functions live here so they are directly unit-testable
 * (tests/native-library.test.mjs); the HTML they produce is spliced into
 * the ONE Library page by libraryScopes.ts, never a second Library.
 *
 * Wayfinder authority: techne-expression-mode.md §7 (reuse the real
 * Library, restore the navigator), §8 (columnar account: Project / Web /
 * Expression, source/location, single-line scene strip with bounded +N),
 * §23-24 (Central-rooted Project → Web/Expression → Scene, personal vs
 * shared scope, private payload excluded), §32 (single-line scene rows,
 * bounded +N, no uncontrolled wrap/overflow).
 *
 * GAP (own the gaps): neither collectionsProvider.ts nor
 * nativeExpressionsProvider.ts (desktop/cradle/src/library) discloses a
 * per-Expression scene list on this cut — `scenes` on an entry is therefore
 * routinely absent. sceneStripHTML renders that absence honestly rather
 * than inventing scene rows; see the session Return for the exact owner
 * this belongs to. */
import {esc,icon} from './icons.js';

export interface NativeLibrarySceneRef {scene_ref:string;title:string}
export interface NativeLibraryEntry {
  ref:string;title:string;owner:string;scope:'local'|'shared';
  revision?:string;project?:string;expressionRef?:string;
  scenes?:NativeLibrarySceneRef[];collections?:string[];
  collectionMemberships?:{title:string;group:string;manifest_path:string}[];
  /** Named explicitly rather than inferred from scope alone — a personal
   * collection entry a provider tags "local" is not automatically eligible
   * for the shared horizon (Wayfinder §24: excluded server/owner-side). */
  private?:boolean;
}

/** Native identity is the entry's own ref — a collection member's resolved
 * source ref, or an Expression's expression_ref — never its display title.
 * Two entries with the same title are not the same native subject and must
 * not collapse into one row. */
export function dedupeLibraryEntries(entries:NativeLibraryEntry[]):NativeLibraryEntry[] {
  const seen=new Map<string,NativeLibraryEntry>();
  for(const entry of entries)if(!seen.has(entry.ref))seen.set(entry.ref,entry);
  return [...seen.values()];
}

/** The privacy boundary at the shared horizon (Wayfinder §24): only entries
 * a provider itself disclosed as reachable there pass through. `private`
 * always excludes, regardless of scope tag — defence in depth against a
 * provider that mistags. */
export function eligibleForScope(entries:NativeLibraryEntry[],scope:'local'|'shared'):NativeLibraryEntry[] {
  if(scope!=='shared')return entries.filter(e=>!e.private);
  return entries.filter(e=>!e.private&&(e.scope==='shared'||e.scope==='local'));
}

export function groupByProject(entries:NativeLibraryEntry[]):{project:string;entries:NativeLibraryEntry[]}[] {
  const groups=new Map<string,NativeLibraryEntry[]>();
  for(const entry of entries){const key=entry.project||'Central';if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(entry);}
  return [...groups.entries()].map(([project,entries])=>({project,entries}));
}

/** Catalogue (columnar, project-grouped) and gallery (flat, searchable) are
 * two presentations of the SAME deduped collection (Wayfinder §8: "Both
 * presentations use the same subjects and editions"), never two separately
 * fetched lists. */
export function catalogueAndGallery(entries:NativeLibraryEntry[]):{catalogue:NativeLibraryEntry[];gallery:NativeLibraryEntry[]} {
  const deduped=dedupeLibraryEntries(entries);
  return {catalogue:deduped,gallery:[...deduped].sort((a,b)=>a.title.localeCompare(b.title))};
}

export interface SceneStripLayout {visible:NativeLibrarySceneRef[];hiddenCount:number}
/** Single line, bounded reveal (§8/§32): derive the visible chip count from
 * a width budget rather than letting the strip wrap or overflow the row.
 * The estimate is deliberately conservative (character-count based); a
 * caller measuring real layout can override the constants. */
export function sceneStripLayout(scenes:NativeLibrarySceneRef[],widthBudgetPx:number,opts:{avgCharPx?:number;chipPaddingPx?:number;plusChipPx?:number}={}):SceneStripLayout {
  const avgCharPx=opts.avgCharPx??6.4,chipPaddingPx=opts.chipPaddingPx??26,plusChipPx=opts.plusChipPx??40;
  if(!scenes.length)return{visible:[],hiddenCount:0};
  let used=0;const visible:NativeLibrarySceneRef[]=[];
  for(let i=0;i<scenes.length;i++){
    const chipWidth=Math.max(1,scenes[i].title.length)*avgCharPx+chipPaddingPx;
    const remaining=scenes.length-i-1;
    const reserve=remaining>0?plusChipPx:0;
    if(visible.length>0&&used+chipWidth+reserve>widthBudgetPx)break;
    used+=chipWidth;visible.push(scenes[i]);
  }
  return{visible,hiddenCount:scenes.length-visible.length};
}

const SCENE_STRIP_BUDGET_PX=340;

/** The scene strip: single line, `+N` bounded reveal, full labels
 * discoverable via `title=`. The reveal is a real keyboard-reachable
 * <button> (aria-expanded), never a hover-only affordance. */
function sceneStripHTML(entryRef:string,scenes?:NativeLibrarySceneRef[]):string {
  if(!scenes||!scenes.length)return `<span class="oi-lib-scene-note">Scenes not yet disclosed by this native reading</span>`;
  const layout=sceneStripLayout(scenes,SCENE_STRIP_BUDGET_PX);
  const hidden=scenes.slice(layout.visible.length);
  const chip=(s:NativeLibrarySceneRef)=>`<span class="oi-lib-scene-chip" title="${esc(s.title)}">${esc(s.title)}</span>`;
  const visibleHTML=layout.visible.map(chip).join('');
  const moreHTML=layout.hiddenCount>0
    ?`<button type="button" class="oi-lib-scene-more" data-scene-reveal="${esc(entryRef)}" aria-expanded="false" aria-label="Show ${layout.hiddenCount} more scenes">+${layout.hiddenCount}</button>`
    :'';
  const overflowHTML=hidden.length
    ?`<span class="oi-lib-scene-overflow" hidden data-scene-overflow="${esc(entryRef)}">${hidden.map(chip).join('')}</span>`
    :'';
  return `<span class="oi-lib-scene-strip" data-scene-strip>${visibleHTML}${moreHTML}${overflowHTML}</span>`;
}

function entryRowHTML(entry:NativeLibraryEntry):string {
  const location=entry.expressionRef??entry.ref;
  const search=[entry.title,entry.project,location,...(entry.collections??[])].filter(Boolean).join(' ').toLowerCase();
  return `<div class="oi-lib-native-row" data-starting-card data-search="${esc(search)}">
    <div class="oi-lib-native-main"><strong>${esc(entry.title)}</strong><span class="oi-lib-native-path">${esc(location)}</span>${entry.collections?.length?`<span class="oi-lib-native-collections">${esc(entry.collections.join(', '))}</span>`:''}</div>
    ${sceneStripHTML(entry.ref,entry.scenes)}
    <button type="button" class="icon-button" data-native-open="${esc(entry.ref)}" aria-label="Open ${esc(entry.title)}" title="Open ${esc(entry.title)}">${icon('arrowRight')}</button>
  </div>`;
}

/** The Central group: `Project / Web / Expression   source/location` header
 * row (§8) over its entries' columnar rows. The same rows carry
 * `data-starting-card`/`data-search`, so the Library's existing search bar
 * (reapplyLibrarySearch in libraryScopes.ts) reads and filters them exactly
 * like every other section — one search over one collection, not a second
 * gallery index. */
function projectGroupHTML(group:{project:string;entries:NativeLibraryEntry[]}):string {
  return `<div class="oi-lib-native-group"><h3>${esc(group.project)}</h3><div class="oi-lib-native-rows">${group.entries.map(entryRowHTML).join('')}</div></div>`;
}

export type NativeLibraryState =
  |{state:'absent'}
  |{state:'error';reason:string}
  |{state:'empty'}
  |{state:'ready';entries:NativeLibraryEntry[]};

/** The Central section body: Project → (bound overview Expression /
 * collection member) → Scene strip → native collections, grouped and
 * deduped from the SAME entries the search bar already filters. */
export function nativeLibrarySectionBodyHTML(state:NativeLibraryState):string {
  if(state.state==='absent')return `<p class="oi-lib-note">The kernel host channel has not been announced by this host yet. Central's native Library reads live once the host opens the channel.<small>library-read channel · not announced</small></p>`;
  if(state.state==='error')return `<p class="oi-lib-note">Central could not be read just now. Nothing was invented to fill its place; try again.<small>${esc(state.reason)}</small></p>`;
  if(state.state==='empty')return `<p class="oi-lib-note">No native Projects, Expressions or collections are reachable from this instance yet.</p>`;
  const eligible=eligibleForScope(state.entries,'local');
  const {catalogue}=catalogueAndGallery(eligible);
  if(!catalogue.length)return `<p class="oi-lib-note">No native Projects, Expressions or collections are reachable from this instance yet.</p>`;
  return groupByProject(catalogue).map(projectGroupHTML).join('');
}

export function nativeLibrarySectionHTML(state:NativeLibraryState):string {
  return `<section class="library-section" data-scope="central-native"><header><h2>Central</h2><span>Projects, Expressions and Scenes · read live, never copied</span></header><div class="oi-lib-native-list" data-native-list data-native-state="${state.state}">${nativeLibrarySectionBodyHTML(state)}</div></section>`;
}
