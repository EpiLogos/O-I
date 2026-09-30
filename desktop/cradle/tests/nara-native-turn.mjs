/** Observe an actual native turn and retain its terminal reading. This helper
 * supplies no message, answer or terminal event to the owner. */
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
export async function waitForNativeTurn(native, project, agent_session, after, output, label, timeout=Number(process.env.NATIVE_TURN_TIMEOUT_MS??180000)) {
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){
  const reading=await native({op:'encounter',project,request:{action:'view',agent_session}});
  const terminal=reading.blocks.find(block=>block.id>after&&['completed','error','cancelled'].includes(block.kind));
  if(terminal){
   await writeFile(path.join(output,`${label}-terminal.json`),JSON.stringify(reading,null,2)+'\n');
   if(terminal.kind!=='completed')throw Error(`Native turn failed: ${terminal.text}`);
   return reading;
  }
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 const reading=await native({op:'encounter',project,request:{action:'view',agent_session}});
 await writeFile(path.join(output,`${label}-timeout.json`),JSON.stringify(reading,null,2)+'\n');
 throw Error('Actual native turn did not complete within the bounded verification window');
}
