/** lane-3 E17: the one place that schedules draft backups.
 *
 * A change calls request(). The first unflushed change arms one timer and later
 * changes ride it, so a backup never waits longer than DRAFT_DEBOUNCE_MS after the
 * first unflushed edit (the coalescing window the target set keeps at 350 ms).
 * Context switches (scene, rail, studio close) and quit call flushNow(), which
 * writes immediately. Nothing flushes while a gesture or composite is open: the
 * request re-arms and the backup waits for the gesture to finish.
 *
 * T-REVIEW-6: a held draft (a boot recovery choice is open) is never written; a
 * backup that does not land keeps its edits pending for the next context switch;
 * an edit made during a backup is written by a quit that arrives during it. */
export const DRAFT_DEBOUNCE_MS=350;
export type DraftFlushReason='edit'|'scene'|'rail'|'studio'|'hidden'|'quit';
export interface DraftTimers{set(run:()=>void,ms:number):unknown;clear(handle:unknown):void}
export interface DraftScheduleOptions{
 debounceMs?:number;
 /** Performs one backup. Called synchronously so its first step reads the document as it stands.
  * Resolves false (or rejects) when the backup did not hold; the edits then stay pending. */
 flush:(reason:DraftFlushReason)=>Promise<unknown>|unknown;
 /** True while a pointer gesture, composite or other transaction is open. */
 gestureOpen?:()=>boolean;
 /** True while a boot recovery choice holds the draft: nothing is written and edits wait. */
 held?:()=>boolean;
 timers?:DraftTimers;
}
const browserTimers:DraftTimers={set:(run,ms)=>window.setTimeout(run,ms),clear:handle=>window.clearTimeout(handle as number)};
export class DraftSchedule{
 readonly debounceMs:number;
 private timer:unknown=undefined;
 private dirty=false;
 private redo=false;
 private inFlight:Promise<void>|null=null;
 private readonly flushFn:DraftScheduleOptions['flush'];
 private readonly gestureOpen:() => boolean;
 private readonly held:() => boolean;
 private readonly timers:DraftTimers;
 constructor(options:DraftScheduleOptions){
  this.debounceMs=options.debounceMs??DRAFT_DEBOUNCE_MS;
  this.flushFn=options.flush;this.gestureOpen=options.gestureOpen??(()=>false);this.held=options.held??(()=>false);this.timers=options.timers??browserTimers;
 }
 /** Unflushed edits plus a backup still in flight. Zero means the draft is current. */
 pending():number{return (this.dirty?1:0)+(this.inFlight?1:0);}
 /** A document change. Coalesces onto the armed timer; never resets it. */
 request():void{
  this.dirty=true;
  if(this.inFlight)this.redo=true;
  if(this.timer===undefined)this.arm(this.debounceMs);
 }
 /** Immediate backup. Quit always writes (it also settles the session mark);
  * the other reasons write only when an edit is waiting. Inside a gesture the
  * backup is deferred, never forced. Under a hold nothing is written. */
 flushNow(reason:DraftFlushReason):Promise<void>{
  this.clearTimer();
  if(this.held())return this.inFlight??Promise.resolve();
  if(this.gestureOpen()){this.dirty=true;this.arm(this.debounceMs);return this.inFlight??Promise.resolve();}
  if(this.inFlight){
   if(!this.dirty)return this.inFlight;
   // Edits made during the flight are written once it lands, by this call, not left to a timer that an unload cuts off.
   const drain=():Promise<void>=>this.inFlight?this.inFlight.then(drain):(this.dirty?this.run(reason):Promise.resolve());
   return this.inFlight.then(drain);
  }
  if(!this.dirty&&reason!=='quit')return Promise.resolve();
  return this.run(reason);
 }
 /** Forget the pending backup, for a document that is being removed on purpose. */
 cancel():void{this.clearTimer();this.dirty=false;this.redo=false;}
 private arm(ms:number):void{this.timer=this.timers.set(()=>{this.timer=undefined;this.fire();},ms);}
 private clearTimer():void{if(this.timer!==undefined){this.timers.clear(this.timer);this.timer=undefined;}}
 private fire():void{
  if(this.held())return;
  if(this.gestureOpen()){this.arm(this.debounceMs);return;}
  if(this.inFlight){this.redo=true;return;}
  if(this.dirty)void this.run('edit');
 }
 private run(reason:DraftFlushReason):Promise<void>{
  this.dirty=false;
  let started:Promise<unknown>;
  try{started=Promise.resolve(this.flushFn(reason));}catch(error){started=Promise.reject(error);}
  // A backup that did not hold (a rejection, or a flush that reports false) keeps its edits pending.
  // Nothing retries on a loop: the next change or context switch tries again.
  const flight:Promise<void>=started.then(result=>{if(result===false)this.dirty=true;},()=>{this.dirty=true;}).then(()=>{
   if(this.inFlight===flight)this.inFlight=null;
   if(this.redo){this.redo=false;if(this.timer===undefined)this.arm(this.debounceMs);}
  });
  this.inFlight=flight;
  return flight;
 }
}
/** Status-line voice for the save state. Times are local hh:mm. */
/** 'library-copy': the draft record did not land, and only the browser Library copy did. It must not read as a draft backup. */
export type DraftOutcome='backed-up'|'waiting'|'refused'|'unavailable'|'library-copy';
export function clockText(at:Date):string{return `${String(at.getHours()).padStart(2,'0')}:${String(at.getMinutes()).padStart(2,'0')}`;}
export function draftStatusLine(outcome:DraftOutcome,at:Date,scope:'browser'|'native'):string{
 if(outcome==='waiting')return 'Newer edits are waiting for backup';
 if(outcome==='refused')return scope==='native'?'Working copy not backed up':'Not saved · export a file';
 if(outcome==='unavailable')return 'Not saved · export a file';
 if(outcome==='library-copy')return 'Draft not recorded; a Library copy was saved';
 const place=scope==='native'?'Working copy backed up on this device':'Draft backed up in this browser';
 return `${place} · ${clockText(at)}`;
}
