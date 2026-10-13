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

/** D2: the basis a saved view was composed against — the subject (the canvas's native expression ref) and the Scene binding it was saved from (its scene_ref). Carried, never copied from the reading. */
export interface ViewBasis {subject_ref:string;binding_ref:string}

/** The clause naming departed members, without the sentence around it. */
function departedClause(departed:readonly string[],labelOf:(ref:string)=>string|undefined):string {
 const names=departed.map(ref=>labelOf(ref)?.trim()||'a removed card');
 const listed=names.length>3?`${names.slice(0,3).join(', ')} and ${names.length-3} more`:names.join(', ');
 return `${departed.length===1?'a member has':`${departed.length} members have`} left the Scene: ${listed}`;
}

/** The one status-line sentence an applied view leaves behind when members
 * have departed, or null when nothing departed (the notice is then absent).
 * `labelOf` names a departed member by the title it last carried in this
 * session; a member never seen in this session is named as a removed card. */
export function departedNotice(name:string,departed:readonly string[],labelOf:(ref:string)=>string|undefined):string|null {
 if(!departed.length)return null;
 return `View "${name}" applied. Since saving, ${departedClause(departed,labelOf)}.`;
}

/** D2 — the one status sentence an applied view leaves behind, naming the
 * basis difference when the view was saved against another subject than the
 * Scene now reads, and the departed members in the same sentence. A view
 * without a basis, or a Scene whose subject is unknown (null or absent),
 * makes no basis claim: the result is then exactly `departedNotice`. */
export function viewNotice(name:string,view:{basis?:ViewBasis},departed:readonly string[],labelOf:(ref:string)=>string|undefined,currentBasis:ViewBasis|null|undefined):string|null {
 const saved=view.basis,current=currentBasis;
 if(!saved||!current||saved.subject_ref===current.subject_ref)return departedNotice(name,departed,labelOf);
 const basis=`View "${name}" was saved against ${saved.subject_ref}; this Scene reads ${current.subject_ref}`;
 return departed.length?`${basis}, and since saving ${departedClause(departed,labelOf)}.`:`${basis}.`;
}
