/** lane-3 E17: the one place that schedules draft backups.
 *
 * A change calls request(). The first unflushed change arms one timer and later
 * changes ride it, so a backup never waits longer than DRAFT_DEBOUNCE_MS after the
 * first unflushed edit (the coalescing window the target set keeps at 350 ms).
 * Context switches (scene, rail, studio close) and quit call flushNow(), which
 * writes immediately. Nothing flushes while a gesture or composite is open: the
 * request re-arms and the backup waits for the gesture to finish. */
export const DRAFT_DEBOUNCE_MS=350;
export type DraftFlushReason='edit'|'scene'|'rail'|'studio'|'hidden'|'quit';
export interface DraftTimers{set(run:()=>void,ms:number):unknown;clear(handle:unknown):void}
export interface DraftScheduleOptions{
 debounceMs?:number;
 /** Performs one backup. Called synchronously so its first step reads the document as it stands. */
 flush:(reason:DraftFlushReason)=>Promise<unknown>|unknown;
 /** True while a pointer gesture, composite or other transaction is open. */
 gestureOpen?:()=>boolean;
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
 private readonly timers:DraftTimers;
 constructor(options:DraftScheduleOptions){
  this.debounceMs=options.debounceMs??DRAFT_DEBOUNCE_MS;
  this.flushFn=options.flush;this.gestureOpen=options.gestureOpen??(()=>false);this.timers=options.timers??browserTimers;
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
  * backup is deferred, never forced. */
 flushNow(reason:DraftFlushReason):Promise<void>{
  this.clearTimer();
  if(this.gestureOpen()){this.dirty=true;this.arm(this.debounceMs);return this.inFlight??Promise.resolve();}
  if(this.inFlight){this.redo=this.redo||this.dirty;return this.inFlight;}
  if(!this.dirty&&reason!=='quit')return Promise.resolve();
  return this.run(reason);
 }
 /** Forget the pending backup, for a document that is being removed on purpose. */
 cancel():void{this.clearTimer();this.dirty=false;this.redo=false;}
 private arm(ms:number):void{this.timer=this.timers.set(()=>{this.timer=undefined;this.fire();},ms);}
 private clearTimer():void{if(this.timer!==undefined){this.timers.clear(this.timer);this.timer=undefined;}}
 private fire():void{
  if(this.gestureOpen()){this.arm(this.debounceMs);return;}
  if(this.inFlight){this.redo=true;return;}
  if(this.dirty)void this.run('edit');
 }
 private run(reason:DraftFlushReason):Promise<void>{
  this.dirty=false;
  let started:Promise<unknown>;
  try{started=Promise.resolve(this.flushFn(reason));}catch(error){started=Promise.reject(error);}
  // A failed backup is not retried on a loop: the edits stay pending and the next change or context switch tries again.
  const flight:Promise<void>=started.then(()=>undefined,()=>undefined).then(()=>{
   if(this.inFlight===flight)this.inFlight=null;
   if(this.redo){this.redo=false;if(this.timer===undefined)this.arm(this.debounceMs);}
  });
  this.inFlight=flight;
  return flight;
 }
}
/** Status-line voice for the save state. Times are local hh:mm. */
export type DraftOutcome='backed-up'|'waiting'|'refused'|'unavailable';
export function clockText(at:Date):string{return `${String(at.getHours()).padStart(2,'0')}:${String(at.getMinutes()).padStart(2,'0')}`;}
export function draftStatusLine(outcome:DraftOutcome,at:Date,scope:'browser'|'native'):string{
 if(outcome==='waiting')return 'Newer edits are waiting for backup';
 if(outcome==='refused')return scope==='native'?'Working copy not backed up':'Not saved · export a file';
 if(outcome==='unavailable')return 'Not saved · export a file';
 const place=scope==='native'?'Working copy backed up on this device':'Draft backed up in this browser';
 return `${place} · ${clockText(at)}`;
}
