import {constellation} from './layout';
import type {GraphReading} from './graph';
self.onmessage=(event:MessageEvent<{generation:number;reading:GraphReading}>)=>{
  const {generation,reading}=event.data;
  try{self.postMessage({generation,points:constellation(reading,0,0)});}
  catch(error){self.postMessage({generation,error:String(error)});}
};
