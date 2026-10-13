/** B4 — honest drift on saved views. Ported from the dead model's
 * `viewDrift` (desktop/cradle/src/techne/m0m5/canvas/view.ts:142-149): what a
 * saved view names that the current reading no longer places is reported,
 * never invented and never dropped silently. Pure: no DOM, no store.
 *
 * The saved view keeps every ref it held (its tombstones live in the
 * material record's `selectedRefs`), so the departed members are derivable
 * here by comparison with the Scene's present members. */

/** What a named view no longer finds among the Scene's present members. */
export interface NamedViewDrift {
 /** Refs the view holds that the Scene no longer places, in saved order, once each. */
 departed:string[];
}

/** Compares a saved view's member refs with the refs the Scene still places. */
export function viewDrift(view:{selectedRefs:readonly string[]},presentRefs:ReadonlySet<string>):NamedViewDrift {
 const departed=[...new Set(view.selectedRefs)].filter(ref=>!presentRefs.has(ref));
 return {departed};
}

/** The one status-line sentence an applied view leaves behind when members
 * have departed, or null when nothing departed (the notice is then absent).
 * `labelOf` names a departed member by the title it last carried in this
 * session; a member never seen in this session is named as a removed card. */
export function departedNotice(name:string,departed:readonly string[],labelOf:(ref:string)=>string|undefined):string|null {
 if(!departed.length)return null;
 const names=departed.map(ref=>labelOf(ref)?.trim()||'a removed card');
 const listed=names.length>3?`${names.slice(0,3).join(', ')} and ${names.length-3} more`:names.join(', ');
 return `View "${name}" applied. Since saving, ${departed.length===1?'a member has':`${departed.length} members have`} left the Scene: ${listed}.`;
}
