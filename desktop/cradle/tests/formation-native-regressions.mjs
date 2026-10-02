/** Exercise the actual built native instrument and its real particle runtime. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {spawn} from 'node:child_process';
const root=resolve(fileURLToPath(new URL('../expressions-app/',import.meta.url)));
const server=createServer(async(request,response)=>{
  try {
    const path=resolve(root,'.'+decodeURIComponent(new URL(request.url,'http://localhost').pathname));
    if(!path.startsWith(root+sep)){response.writeHead(403).end();return;}
    response.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.html')?'text/html':'application/octet-stream');
    response.setHeader('X-Content-Type-Options','nosniff');
    response.end(await readFile(path));
  } catch {response.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try {
  const url=`http://127.0.0.1:${server.address().port}/field-studies-journeys/field-studies.html`;
  for(const [name,file] of [['compiler-retention','../../../scripts/vendor-expressions-engine.test.mjs'],['emitted-formation','emitted-formation-modules.test.mjs'],['formation-authoring','formation-authoring-native.mjs'],['candidate-cache','candidate-cache-native.mjs']]) {
    await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[fileURLToPath(new URL(file,import.meta.url))],{
        stdio:'inherit',env:{...process.env,OI_TEST_URL:url,OI_TEST_ARTIFACTS:`tests/artifacts/${name}-native`},
      });
      child.once('error',reject);
      child.once('exit',(code,signal)=>code===0?resolve():reject(Error(`${name} native regression failed: ${signal??code}`)));
    });
  }
} finally {await new Promise(resolve=>server.close(resolve));}
