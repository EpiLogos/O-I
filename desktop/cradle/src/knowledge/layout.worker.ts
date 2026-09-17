import {constellation} from './layout';
import type {GraphReading} from './graph';
self.onmessage=(event:MessageEvent<GraphReading>)=>{try{self.postMessage({points:constellation(event.data,0,0)});}catch(error){self.postMessage({error:String(error)});}};
