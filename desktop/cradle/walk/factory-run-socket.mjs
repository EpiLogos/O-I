// Bounded client for the EXISTING desktop Expression socket. It never starts
// a server, removes a socket, invokes an Action, or writes native owner state.
import net from 'node:net';
import {lstat} from 'node:fs/promises';
export async function existingExpressionSocket(socketPath,request,{timeoutMs=10000,limit=1024*1024}={}) {
  const stat=await lstat(socketPath);
  if(!stat.isSocket())throw new Error('The selected path is not a Unix socket');
  if((stat.mode&0o077)!==0)throw new Error('The native socket is accessible to other users');
  if(typeof process.getuid==='function'&&stat.uid!==process.getuid())throw new Error('The socket is not owned by the current local user');
  const wire=Buffer.from(JSON.stringify(request)+'\n');if(wire.length>limit)throw new Error('Request exceeds the native socket budget');
  return new Promise((resolve,reject)=>{
    const client=net.createConnection(socketPath);const chunks=[];let size=0;let settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;client.destroy();error?reject(error):resolve(value);};
    client.setTimeout(timeoutMs,()=>finish(new Error('Native socket timed out; no request was replayed')));
    client.on('error',error=>finish(error));client.on('connect',()=>client.write(wire));
    client.on('data',chunk=>{
      size+=chunk.length;if(size>limit)return finish(new Error('Native reply exceeds the bounded packet size'));
      chunks.push(chunk);const bytes=Buffer.concat(chunks);const end=bytes.indexOf(10);if(end<0)return;
      try{finish(null,JSON.parse(bytes.subarray(0,end).toString('utf8')));}catch(error){finish(error);}
    });
    client.on('end',()=>{if(!settled)finish(new Error('Native socket closed without a complete response'));});
  });
}
