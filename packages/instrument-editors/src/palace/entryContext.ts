import type {TechneReading,TechneExpressionBinding} from '../../../../desktop/cradle/src/techne/contract';
import {addBookmark,removeBookmark,type PalaceComposition} from '../../../../desktop/cradle/src/techne/m0m5/palace/palace-state';
import type {PalaceRegionEntry,PalaceRegionKey} from '../../../../desktop/cradle/src/techne/m0m5/palace/regions';
/** Restore the omitted Scene context from the SAME authoritative reading.
 * Ordinal is view identity within that exact basis, never a native ref. */
export function integralEntryContext(reading:TechneReading,region:PalaceRegionKey,ref:string,occurrence=0):{expressionBinding?:TechneExpressionBinding}{
 if(!Number.isInteger(occurrence)||occurrence<0)throw Error('Invalid integral source occurrence.');
 const matches=(reading.expressions??[]).filter(binding=>region==='expression'?binding.expression_ref===ref:region==='journey'?binding.scene_ref===ref:false);
 const binding=matches[occurrence];
 if((region==='expression'||region==='journey')&&!binding)throw Error('The exact native Expression/Scene occurrence is no longer disclosed.');
 return binding?{expressionBinding:binding}:{};
}
export function integralEntryAt(composition:PalaceComposition,region:PalaceRegionKey,placement:{ref:string;locus:unknown}):{entry:PalaceRegionEntry;occurrence:number}{
 const positions=composition.placements[region]??[],index=positions.indexOf(placement as typeof positions[number]);if(index<0)throw Error('The integral position is no longer in this reading.');
 const occurrence=positions.slice(0,index).filter(item=>item.ref===placement.ref).length;
 const entry=composition.regions.find(value=>value.key===region)?.entries.filter(entry=>entry.ref===placement.ref)[occurrence];if(!entry)throw Error('The integral source occurrence is no longer disclosed.');return {entry,occurrence};
}

/** A bookmark uses the native ref and the selected occurrence's actual locus.
 * The locus disambiguates view identity; it never replaces a native Scene ref. */
export function integralBookmarkPosition(composition:PalaceComposition,mark:PalaceComposition['bookmarks'][number]){
 const candidates=(composition.placements[mark.region]??[]).filter(position=>position.ref===mark.ref);
 const exact=candidates.find(position=>JSON.stringify(position.locus)===JSON.stringify(mark.locus));
 const placement=exact??(candidates.length===1?candidates[0]:undefined);
 if(!placement)throw Error('The bookmark no longer identifies one disclosed source occurrence.');
 return {placement,...integralEntryAt(composition,mark.region,placement)};
}
export function integralBookmark(composition:PalaceComposition,region:PalaceRegionKey,placement:NonNullable<PalaceComposition['placements'][PalaceRegionKey]>[number]):PalaceComposition{
 integralEntryAt(composition,region,placement);
 const exact=composition.bookmarks.some(mark=>mark.ref===placement.ref&&mark.region===region&&JSON.stringify(mark.locus)===JSON.stringify(placement.locus));
 if(exact)return removeBookmark(composition,placement.ref);
 const adopted=addBookmark(composition,region,placement.ref);
 return {...adopted,bookmarks:adopted.bookmarks.map(mark=>mark.ref===placement.ref?{region,ref:placement.ref,locus:structuredClone(placement.locus)}:mark)};
}
