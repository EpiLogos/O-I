/** Preserve the exact failed presentation before any fresh arrangement can write. */
const POINTER="oi-cradle.recovery.latest";
const PREFIX="oi-cradle.recovery.";
/** Retention bound (workspace continuity WF1, row C19): recovery records are
 * quarantined originals, not an unbounded log — the newest five are kept and
 * older keys are pruned when a new record lands. The pointer is not a record. */
const RETAIN=5;
export interface RecoveryNamespace { pointer: string; prefix: string }
const DEFAULT_NAMESPACE: RecoveryNamespace = {pointer: POINTER, prefix: PREFIX};
export interface PresentationRecovery {key:string;sourceKey:string;raw:string;reason:string;savedAt:string;/** Monotonic write order: ISO timestamps collide within one millisecond, so "newest five" is decided by this, never by the clock. Absent on records an older build wrote — they sort as the oldest, which they are. */seq?:number}
const parseRecord=(raw:string|null):PresentationRecovery|undefined=>{
 try{const r=JSON.parse(raw??"null");return r&&typeof r.key==="string"&&typeof r.sourceKey==="string"&&typeof r.raw==="string"&&typeof r.reason==="string"&&typeof r.savedAt==="string"&&(r.seq===undefined||typeof r.seq==="number")?r:undefined;}catch{return undefined;}
};
/** Every retained recovery record, newest first. Unreadable entries under
 * the recovery prefix are not listed — and are swept by the same bound
 * (they cannot be inspected, so they cannot be the good copy either). */
export function listRecovery(namespace: RecoveryNamespace = DEFAULT_NAMESPACE):PresentationRecovery[]{
 const keys:string[]=[];
 for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(namespace.prefix)&&k!==namespace.pointer)keys.push(k);}
 return keys.map(k=>parseRecord(localStorage.getItem(k))).filter((r):r is PresentationRecovery=>!!r).sort((a,b)=>(b.seq??0)-(a.seq??0)||b.savedAt.localeCompare(a.savedAt));
}
/** Keep the newest records up to the bound; sweep the rest of the prefix. */
function prune(keep:PresentationRecovery[], namespace: RecoveryNamespace):void{
 const keepKeys=new Set(keep.map(r=>r.key));
 const keys:string[]=[];
 for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(namespace.prefix)&&k!==namespace.pointer&&!keepKeys.has(k))keys.push(k);}
 for(const k of keys)localStorage.removeItem(k);
}
export function preservePresentation(sourceKey:string,reason:string, namespace: RecoveryNamespace = DEFAULT_NAMESPACE):PresentationRecovery{
 const raw=localStorage.getItem(sourceKey)??"";
 const previous=latestRecovery(namespace);
 if(previous?.sourceKey===sourceKey&&previous.raw===raw)return previous;
 const seq=(listRecovery(namespace)[0]?.seq??0)+1;
 const record:PresentationRecovery={key:`${namespace.prefix}${crypto.randomUUID()}`,sourceKey,raw,reason,savedAt:new Date().toISOString(),seq};
 localStorage.setItem(record.key,JSON.stringify(record));
 localStorage.setItem(namespace.pointer,record.key);
 // The record just written is the newest by its own savedAt, so the bound
 // can never prune the pointer's target.
 prune(listRecovery(namespace).slice(0,RETAIN),namespace);
 return record;
}
export function latestRecovery(namespace: RecoveryNamespace = DEFAULT_NAMESPACE):PresentationRecovery|undefined {
 try {const key=localStorage.getItem(namespace.pointer);return key&&key.startsWith(namespace.prefix)?parseRecord(localStorage.getItem(key)):undefined;}catch{return undefined;}
}
