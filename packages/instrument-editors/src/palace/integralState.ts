import type {TechneReading} from '../../../../desktop/cradle/src/techne/contract';
import {deriveComposition,palaceBasis,placeAt,type PalaceComposition} from '../../../../desktop/cradle/src/techne/m0m5/palace/palace-state';
import type {PalaceRegionKey} from '../../../../desktop/cradle/src/techne/m0m5/palace/regions';
/** Restore geometry onto the CURRENT disclosed entries. A saved composition
 * cannot introduce a native ref, replace a reading or confer authority. */
export function restoreIntegralComposition(reading:TechneReading,value:unknown):PalaceComposition{
 let result=deriveComposition(reading);
 if(value===undefined)return result;
 if(!value||typeof value!=='object'||(value as PalaceComposition).basis!==palaceBasis(reading))throw Error('The retained integral arrangement belongs to another source reading.');
 const retained=value as PalaceComposition;
 for(const region of result.regions){
  const refs=new Set(region.entries.map(entry=>entry.ref));const placements=retained.placements?.[region.key];
  if(!Array.isArray(placements)||placements.some(item=>!item||!refs.has(item.ref)||![item.locus?.room?.column,item.locus?.room?.row,item.locus?.locus].every(Number.isInteger)||item.locus.room.column<0||item.locus.room.column>2||item.locus.room.row<0||item.locus.room.row>1||item.locus.locus<0||item.locus.locus>3))throw Error('The retained integral positions do not match the disclosed native material.');
  // The native expression-region projection can disclose one Expression at
  // multiple Scenes, while its entry shape retains only expression_ref.
  // Preserve that exact source multiplicity and ordered geometry on recovery;
  // never invent a replacement ref or silently choose one of those Scenes.
  const count=(rows:readonly {ref:string}[],ref:string)=>rows.filter(row=>row.ref===ref).length;
  for(const ref of refs)if(count(placements,ref)>count(region.entries,ref))throw Error('The retained integral positions exceed their native source multiplicity.');
  if(region.entries.some(entry=>count(region.entries,entry.ref)>1)){
   if(placements.length!==region.entries.length||region.entries.some(entry=>count(placements,entry.ref)!==count(region.entries,entry.ref)))throw Error('An ambiguous source region requires its complete disclosed position set.');
   result={...result,placements:{...result.placements,[region.key]:structuredClone(placements)}};
  }else for(const placement of placements)result=placeAt(result,region.key,placement.ref,placement.locus);
 }
 const keys=new Set(result.regions.map(region=>region.key));
 if(retained.bookmarks!==undefined&&(!Array.isArray(retained.bookmarks)||retained.bookmarks.length>256))throw Error('Invalid integral bookmarks.');
 result.bookmarks=(retained.bookmarks??[]).filter(bookmark=>{
  if(!bookmark||!keys.has(bookmark.region)||!result.regions.find(region=>region.key===bookmark.region)?.entries.some(entry=>entry.ref===bookmark.ref))return false;
  const locus=bookmark.locus;
  if(!locus||![locus.room?.column,locus.room?.row,locus.locus].every(Number.isInteger)||locus.room.column<0||locus.room.column>2||locus.room.row<0||locus.room.row>1||locus.locus<0||locus.locus>3)throw Error('Invalid retained bookmark position.');
  if(result.regions.find(region=>region.key===bookmark.region)!.entries.filter(entry=>entry.ref===bookmark.ref).length>1&&!(result.placements[bookmark.region]??[]).some(position=>position.ref===bookmark.ref&&JSON.stringify(position.locus)===JSON.stringify(locus)))throw Error('The retained bookmark no longer names its disclosed position.');
  return true;
 });
 if(new Set(result.bookmarks.map(mark=>mark.ref)).size!==result.bookmarks.length)throw Error('Duplicate retained native bookmarks.');
 return {...result,bound:retained.bound===true};
}
export function integralMove(composition:PalaceComposition,region:PalaceRegionKey,ref:string,slot:number){
 if(!Number.isInteger(slot)||slot<0||slot>=24)throw Error('Choose one of the region’s disclosed 24 loci.');
 if(composition.regions.find(value=>value.key===region)?.entries.filter(entry=>entry.ref===ref).length!==1)throw Error('This native region does not distinguish the source occurrences. Open its exact Scene in Journey before arranging it.');
 return placeAt(composition,region,ref,{room:{column:Math.floor(slot/4)%3,row:Math.floor(slot/12)},locus:slot%4});
}
