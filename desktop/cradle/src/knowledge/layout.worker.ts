import {ForceWorld} from './layout';
import type {GraphReading} from './graph';
import type {Point} from './layout';

type LayoutRequest={kind:'layout';generation:number;reading:GraphReading}|{kind:'drag';ref:string;x:number;y:number}|{kind:'release';ref?:string}|{kind:'sleep'}|{kind:'wake'};
type LayoutReply={kind:'points';generation:number;points:Point[]}|{kind:'error';generation:number;error:string};

let world:ForceWorld|undefined,generation=0,retained=new Map<string,Point>();
const post=(reply:LayoutReply)=>{(self as unknown as Worker).postMessage(reply);};

self.onmessage=(event:MessageEvent<LayoutRequest>)=>{
  const message=event.data;
  if(message.kind==='layout') {
    generation=message.generation;
    try {
      // Carry the current arrangement into the next world before replacing it.
      if(world)retained=world.retain();
      world?.stop();
      world=new ForceWorld(message.reading,retained);
      world.onTick(points=>post({kind:'points',generation,points}));
    } catch(error){world=undefined;post({kind:'error',generation,error:String(error)});}
  } else if(message.kind==='drag')world?.drag(message.ref,message.x,message.y);
  else if(message.kind==='release')world?.release(message.ref??'');
  // A hidden or settled graph does no work: the tick timer is cancelled and
  // only an unsettled world resumes when the view returns.
  else if(message.kind==='sleep')world?.stop();
  else if(message.kind==='wake')world?.wake();
};
