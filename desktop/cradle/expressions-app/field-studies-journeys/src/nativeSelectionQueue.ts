/** Serialize focus writes without discarding the human's most recent gesture.
 * Only an undispatched selection is replaced. An authorised in-flight write
 * completes on its original basis; navigation invalidates queued old work.
 * This is transient input ordering, not a document, source cache or retry loop. */
export type SelectionOutcome = 'applied'|'superseded'|'invalidated'|'failed';
interface Waiting<T> {value:T;resolve:(state:SelectionOutcome)=>void}
export class NativeSelectionQueue<T> {
 private waiting?:Waiting<T>;
 private draining=false;
 constructor(private readonly ports:{
  available:()=>boolean;
  current:(value:T)=>boolean;
  apply:(value:T)=>Promise<boolean>;
 }){}
 submit(value:T):Promise<SelectionOutcome>{
  this.waiting?.resolve('superseded');
  const result=new Promise<SelectionOutcome>(resolve=>{this.waiting={value,resolve};});
  this.resume();
  return result;
 }
 cancel():void{this.waiting?.resolve('invalidated');this.waiting=undefined;}
 resume():void{
  if(this.draining||!this.waiting||!this.ports.available())return;
  this.draining=true;
  void this.drain();
 }
 private async drain():Promise<void>{
  try{
   while(this.waiting&&this.ports.available()){
    const item=this.waiting;this.waiting=undefined;
    if(!this.ports.current(item.value)){item.resolve('invalidated');continue;}
    try{item.resolve(await this.ports.apply(item.value)?'applied':'failed');}
    catch{item.resolve('failed');}
   }
  }finally{this.draining=false;}
 }
}
