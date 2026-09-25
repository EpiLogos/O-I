import {retainUnplacedDraft} from "../flow/unplacedDrafts";
/** One-time, explicit migration of an old browser copy into an unverified
 * detached draft. Never refreshes this cache or turns it into a native reading.
 * The caller must first obtain current native migration_allowed:true. */
const LEGACY_READING_KEY=(ref:string)=>`oi-cradle.file-last-reading.v1:${ref}`;
export function hasLegacyDeviceCopy(ref:string):boolean{
 try{return localStorage.getItem(LEGACY_READING_KEY(ref))!==null;}catch{return false;}
}
export function recoverLegacyDeviceCopy(ref:string,migrationAllowed:boolean):string{
 if(!migrationAllowed)throw Error("The current owner does not permit recovery of this source.");
 const raw=localStorage.getItem(LEGACY_READING_KEY(ref));
 if(!raw)throw Error("No previous device copy remains.");
 const value:unknown=JSON.parse(raw);
 if(!value||typeof value!=="object"||typeof (value as {content?:unknown}).content!=="string")throw Error("The previous device copy is unreadable; its backup has been preserved.");
 const text=(value as {content:string}).content;
 if(new TextEncoder().encode(text).length>8*1024*1024)throw Error("The previous copy exceeds the 8 MiB recovery bound; its backup has been preserved.");
 const id=`device-recovery:${crypto.randomUUID()}`;
 retainUnplacedDraft(id,text,true);
 // Acknowledgement above precedes removal, so a failed draft write never
 // loses the original. No source ref/location/revision follows the text.
 localStorage.removeItem(LEGACY_READING_KEY(ref));
 return id;
}
