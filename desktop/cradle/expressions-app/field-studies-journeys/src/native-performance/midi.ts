import type {NativePerformanceClient} from './client.js';

interface MidiMessage {data:Uint8Array|null}
interface MidiInput {id:string;name:string|null;state:string;onmidimessage:((event:MidiMessage)=>void)|null}
interface MidiAccess {inputs:Map<string,MidiInput>;onstatechange:(()=>void)|null}
export interface MidiInputReading {id:string;name:string;connected:boolean}

/** MIDI supplies authored mechanical input only. Note number selects a cell
 * from the current NATIVE catalog relative to an explicit centre note; its
 * frequency, source degree, phase, touch and sample are native decisions.
 * The browser MIDI timestamp is never forwarded as native audio time. */
export class NativeMidiInput {
 private access:MidiAccess|null=null;private input:MidiInput|null=null;private dead=false;
 private centre=60;private held=new Map<string,string[]>();
 constructor(private client:NativePerformanceClient,private changed:()=>void,private report:(error:unknown)=>void){}
 get available(){return typeof (navigator as unknown as {requestMIDIAccess?:unknown}).requestMIDIAccess==='function';}
 get inputs():MidiInputReading[]{return this.access?[...this.access.inputs.values()].map(input=>({id:input.id,name:input.name??input.id,connected:input.state==='connected'})):[];}
 get selected(){return this.input?.id??'';}
 get centreNote(){return this.centre;}
 async request(){
  if(this.dead||!this.available)throw Error('MIDI input is unavailable in this application host.');
  const browser=navigator as unknown as {requestMIDIAccess(options:{sysex:false}):Promise<MidiAccess>};
  const access=await browser.requestMIDIAccess({sysex:false});
  if(this.dead)return;
  this.access=access;access.onstatechange=()=>{if(this.input?.state!=='connected')this.detach('MIDI input disconnected');this.changed();};this.changed();
 }
 setCentre(note:number){if(!Number.isInteger(note)||note<0||note>127)throw Error('Choose a MIDI centre note in 0–127.');this.detach('MIDI address mapping changed');this.centre=note;this.changed();}
 select(id:string){
  this.detach('MIDI input changed');if(!id){this.changed();return;}
  const input=this.access?.inputs.get(id);if(!input||input.state!=='connected')throw Error('Select a currently connected MIDI input.');
  this.input=input;input.onmidimessage=this.message;this.changed();
 }
 private detach(reason:string){
  if(this.input)this.input.onmidimessage=null;this.input=null;
  if(this.held.size){this.held.clear();void this.client.panic(reason).catch(this.report);}
 }
 private message=(event:MidiMessage)=>{
  if(this.dead||!this.input||!event.data||event.data.length<2)return;
  const [status,note,value=0]=event.data,kind=status&0xf0,channel=status&0x0f,key=`${channel}:${note}`;
  if(kind===0x90&&value>0){
   try{
    const reading=this.client.state.reading;if(!reading)throw Error('The current native musical catalog is unavailable.');
    const base=Math.min(...reading.keys.map(cell=>cell.register_octave)),register=base+Math.floor(note/12)-Math.floor(this.centre/12);
    const pitch=(note-this.centre%12+12)%12;
    const cell=reading.keys.find(cell=>cell.row<2&&cell.pitch_class===pitch&&cell.register_octave===register&&cell.available);
    if(!cell)throw Error('This MIDI note has no available address in the current native source and prepared register range.');
    const press=this.client.press(cell.row,cell.column,value/127),tokens=this.held.get(key)??[];tokens.push(press.input_ref);this.held.set(key,tokens);
    void press.acknowledged.catch(this.report);
   }catch(error){this.report(error);}
  }else if(kind===0x80||kind===0x90&&value===0){
   const tokens=this.held.get(key),token=tokens?.shift();if(tokens&&!tokens.length)this.held.delete(key);if(token)void this.client.release(token).catch(this.report);
  }else if(kind===0xa0){for(const token of this.held.get(key)??[])void this.client.pressure(token,value/127).catch(this.report);
  }else if(kind===0xd0){for(const [address,tokens] of this.held)if(address.startsWith(`${channel}:`))for(const token of tokens)void this.client.pressure(token,note/127).catch(this.report);
  }else if(kind===0xb0&&note===64){void this.client.sustain(value>=64).catch(this.report);
  }else if(kind===0xb0&&(note===120||note===123)){this.held.clear();void this.client.panic('MIDI all notes off').catch(this.report);}
 };
 /** Focus loss releases the actual independent MIDI touches too. */
 panic(){this.held.clear();}
 dispose(){if(this.dead)return;this.dead=true;this.detach('MIDI input closed');if(this.access)this.access.onstatechange=null;this.access=null;}
}
