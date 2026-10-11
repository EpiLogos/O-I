import {discoverRegions,planRegions,regionSceneRef,type PalaceChange,type PalaceDocumentSnapshot,type PalaceRegionSpec} from '../../../../desktop/cradle/src/techne/m0m5/palace/composition';
/** Source planner adoption with the two missing native operations repaired
 * locally: explicit body clearing and removal by the disclosed Scene ref. */
export type PalaceEditorChange=PalaceChange|{change:'scene_body_clear';scene_ref:string};
type NativeBody=NonNullable<PalaceDocumentSnapshot['scenes'][number]['body']>&{reading?:{ref?:string;revision?:string}};
/** The source discoverer intentionally projects only containment. Retain the
 * owner's disclosed reading revision alongside that same native member. */
export function discoverPalaceRegions(snapshot:PalaceDocumentSnapshot):PalaceRegionSpec[]{
 return discoverRegions(snapshot).map(region=>{const body=snapshot.scenes.find(scene=>scene.scene_ref===region.scene_ref)?.body as NativeBody|undefined;return region.member&&body?.reading?.ref===region.member.expression_ref&&body.reading.revision?{...region,member:{...region.member,revision:body.reading.revision}}:region;});
}
export function planPalaceEdits(snapshot:PalaceDocumentSnapshot,regions:readonly PalaceRegionSpec[],removedSceneRefs:readonly string[]=[]):PalaceEditorChange[]|null {
 const admitted=new Set(discoverRegions(snapshot).map(region=>region.scene_ref));
 const removed=new Set(removedSceneRefs);
 if(removed.size!==removedSceneRefs.length||removedSceneRefs.some(ref=>!admitted.has(ref)))throw Error('A removed room must name one exact disclosed native Scene.');
 if(regions.some(region=>region.scene_ref&&removed.has(region.scene_ref)))throw Error("A retained room cannot also be removed. Restore its exact Scene before saving.");
 const kept=regions;
 const sceneRefs=kept.map(region=>region.scene_ref??regionSceneRef(snapshot.expression_ref,region.name));
 if(new Set(kept.map(region=>region.name)).size!==kept.length||new Set(sceneRefs).size!==sceneRefs.length)throw Error('Rooms require unique names and native Scene identities.');
 for(let index=0;index<kept.length;index++){
  const ref=sceneRefs[index],exists=snapshot.scenes.some(scene=>scene.scene_ref===ref);
  if(exists&&!admitted.has(ref))throw Error('A room edit cannot address an unrelated native Scene.');
  if(!exists&&ref!==regionSceneRef(snapshot.expression_ref,kept[index].name))throw Error('A new room requires its exact native region Scene identity.');
 }
 for(const region of kept){if(!region.member)continue;const body=snapshot.scenes.find(scene=>scene.scene_ref===region.scene_ref)?.body as NativeBody|undefined;const unchanged=body?.carrier==='expression_ref'&&body.subject_ref===region.member.expression_ref;if(!region.member.revision&&!unchanged)throw Error('A constituent requires its disclosed source revision.');}
 // Ask the adopted planner to update an existing body when its source reading
 // revision changes, which its narrow containment comparison cannot express.
 const revisionBasis={...snapshot,scenes:snapshot.scenes.map(scene=>{const wanted=kept.find(region=>region.scene_ref===scene.scene_ref)?.member;const body=scene.body as NativeBody|undefined;return wanted?.revision&&body?.subject_ref===wanted.expression_ref&&body.reading?.revision!==wanted.revision?{...scene,body:null}:scene;})};
 const planned=(planRegions(revisionBasis,kept)??[]).filter(change=>{
  if(change.change==='scene_reorder')return false;
  if(change.change==='scene_trigger_attach'){
   const scene=snapshot.scenes.find(scene=>scene.scene_ref===change.scene_ref);
   // Renaming a room does not rename or duplicate its existing native portal.
   if(scene?.triggers?.some(trigger=>trigger.trigger_ref.startsWith(snapshot.expression_ref+':trigger:region-')&&trigger.trigger_ref.endsWith('-portal')&&trigger.target?.kind==='portal'&&trigger.target.subject_ref===change.trigger.target.subject_ref))return false;
  }
  return true;
 });
 const changes:PalaceEditorChange[]=removedSceneRefs.map(scene_ref=>({change:'scene_remove',scene_ref}));
 changes.push(...planned);
 for(const region of kept){
  if(region.member||!region.scene_ref)continue;
  const existing=snapshot.scenes.find(scene=>scene.scene_ref===region.scene_ref);
  if(existing?.body?.carrier!=='expression_ref')continue;
  changes.push({change:'scene_body_clear',scene_ref:region.scene_ref});
  // Only portals in this instrument's own generated namespace and pointing
  // to the detached body are retired; unrelated native triggers stay intact.
  for(const trigger of existing.triggers??[])if(trigger.trigger_ref.startsWith(snapshot.expression_ref+':trigger:region-')&&trigger.trigger_ref.endsWith('-portal')&&trigger.target?.kind==='portal'&&trigger.target.subject_ref===existing.body.subject_ref)changes.push({change:'scene_trigger_detach',trigger_ref:trigger.trigger_ref});
 }
 const nativePlanned=planRegions(snapshot,kept)??[];
 const reorder=nativePlanned.find(change=>change.change==='scene_reorder');
 if(reorder?.change==='scene_reorder')changes.push({...reorder,scene_refs:reorder.scene_refs.filter(ref=>!removed.has(ref))});
 return changes.length?changes:null;
}
export function restorePalaceDraft(value:Record<string,unknown>,expressionRef:string){
 if(value.basis===undefined)return undefined;
 const basis=value.basis as PalaceDocumentSnapshot&{title:string};
 if(!basis||basis.expression_ref!==expressionRef||!Number.isSafeInteger(basis.revision)||basis.revision<0||!Array.isArray(basis.scenes)||!Array.isArray(value.regions)||!Array.isArray(value.removed))throw Error('The retained Palace draft has another or malformed native basis.');
 const regions=value.regions as PalaceRegionSpec[];const removed=value.removed as string[];
 if(regions.length>256||regions.some(region=>!region||typeof region.name!=='string'||!region.name.trim()||region.name.length>80||region.scene_ref!==null&&typeof region.scene_ref!=='string'||region.member!==null&&(!region.member||typeof region.member.expression_ref!=='string'||typeof region.member.title!=='string')))throw Error('The retained Palace rooms are malformed.');
 return {basis,regions,removed,dirty:Boolean(planPalaceEdits(basis,regions,removed))};
}
