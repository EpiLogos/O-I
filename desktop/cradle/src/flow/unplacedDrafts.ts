/** Existing device-draft record, shared with the explicit legacy recovery path. */
export const DRAFT_KEY=(id:string)=>`oi-cradle.unplaced-draft.v1:${id}`;
export interface UnplacedDraft {text:string;at?:number;unverified_recovery?:boolean}
export function readUnplacedDraft(id:string):UnplacedDraft|null{
 try{const value:unknown=JSON.parse(localStorage.getItem(DRAFT_KEY(id))??"null");return value&&typeof value==="object"&&typeof (value as UnplacedDraft).text==="string"?value as UnplacedDraft:null;}catch{return null;}
}
export function retainUnplacedDraft(id:string,text:string,unverifiedRecovery=false):void{
 const record:UnplacedDraft={text,at:Date.now(),...(unverifiedRecovery?{unverified_recovery:true}:{})};
 localStorage.setItem(DRAFT_KEY(id),JSON.stringify(record));
 const acknowledged=readUnplacedDraft(id);
 if(!acknowledged||acknowledged.text!==text||!!acknowledged.unverified_recovery!==unverifiedRecovery)throw Error("This device did not acknowledge the recovered draft; the original backup is unchanged.");
}
