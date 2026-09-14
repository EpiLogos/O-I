/** Preserve the exact failed presentation before any fresh arrangement can write. */
const POINTER="oi-cradle.recovery.latest";
export interface PresentationRecovery {key:string;sourceKey:string;raw:string;reason:string;savedAt:string}
export function preservePresentation(sourceKey:string,reason:string):PresentationRecovery {
 const raw=localStorage.getItem(sourceKey)??"";
 const previous=latestRecovery();
 if(previous?.sourceKey===sourceKey&&previous.raw===raw)return previous;
 const record:PresentationRecovery={key:`oi-cradle.recovery.${crypto.randomUUID()}`,sourceKey,raw,reason,savedAt:new Date().toISOString()};
 localStorage.setItem(record.key,JSON.stringify(record));
 localStorage.setItem(POINTER,record.key);
 return record;
}
export function latestRecovery():PresentationRecovery|undefined {
 try {const key=localStorage.getItem(POINTER);return key?JSON.parse(localStorage.getItem(key)??"null")??undefined:undefined;}catch{return undefined;}
}
