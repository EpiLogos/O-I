/** The existing permission-bounded Expression socket wire protocol: one JSON
 * request and response, newline delimited, at most the kernel's 1 MiB limit.
 * The running native owner validates the request and owns every effect. */
import {createConnection} from 'node:net';
const maxBytes=1024*1024;
export function nativeExpressionRequest(socket,request){
  const bytes=Buffer.from(JSON.stringify(request)+'\n');
  if(bytes.length>maxBytes)throw Error('Native Expression request exceeds its transport limit');
  return new Promise((resolve,reject)=>{
    const connection=createConnection(socket);let chunks=[],length=0,settled=false;
    const unavailable=()=>Error('Native Expression response unavailable; acceptance must be inspected before repeating an effect');
    const deadline=setTimeout(()=>finish(unavailable()),15000);
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(deadline);connection.destroy();chunks=[];error?reject(error):resolve(value);};
    connection.setTimeout(15000,()=>finish(unavailable()));
    connection.once('connect',()=>connection.end(bytes));
    connection.on('data',chunk=>{
      chunks.push(chunk);length+=chunk.length;
      if(length>maxBytes)return finish(Error('Native Expression response exceeds its transport limit'));
      if(chunk.includes(10)){
        try{finish(null,JSON.parse(Buffer.concat(chunks).toString('utf8').trim()));}
        catch(error){finish(error);}
      }
    });
    connection.once('error',error=>finish(error));
    connection.once('end',()=>finish(Error('Native Expression response ended without a complete receipt')));
  });
}
