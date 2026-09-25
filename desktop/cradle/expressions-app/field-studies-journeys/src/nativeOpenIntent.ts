/** Transient navigation intent only. Failed opens require explicit retry;
 * no owner write or uncertain operation is replayed automatically. */
interface Intent {reference:string;current:()=>boolean;attempted:boolean;resolve:(opened:boolean)=>void}
export class NativeOpenIntent {
 private pending?:Intent;
 private draining=false;
 constructor(private readonly ports:{idle:()=>Promise<void>;open:(reference:string,current:()=>boolean)=>Promise<boolean>;changed:()=>void}){}
 get reference():string|undefined {
  return this.pending?.current()?this.pending.reference:undefined;
 }
 submit(reference:string,current:()=>boolean):Promise<boolean>{
  this.cancel();
  const result=new Promise<boolean>(resolve=>{this.pending={reference,current,attempted:false,resolve};});
  this.ports.changed();this.resume();return result;
 }
 retry():Promise<boolean>{
  const intent=this.pending;
  if(!intent||!intent.current()){this.cancel();return Promise.resolve(false);}
  return this.submit(intent.reference,intent.current);
 }
 cancel():void{const previous=this.pending;this.pending=undefined;previous?.resolve(false);}
 private resume():void{if(!this.draining)void this.drain();}
 private async drain():Promise<void>{
  this.draining=true;
  try{
   while(this.pending&&!this.pending.attempted){
    const intent=this.pending;
    await this.ports.idle();
    if(this.pending!==intent)continue;
    if(!intent.current()){this.cancel();this.ports.changed();continue;}
    intent.attempted=true;
    const current=()=>this.pending===intent&&intent.current();
    let opened=false;
    try{opened=await this.ports.open(intent.reference,current);}catch{/* The owning UI reports the actual failure. Keep its reference for explicit retry. */}
    if(this.pending===intent&&(opened||!intent.current()))this.pending=undefined;
    intent.resolve(opened);this.ports.changed();
   }
  }finally{this.draining=false;}
 }
}
