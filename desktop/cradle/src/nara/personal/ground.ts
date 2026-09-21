/** Ordinary authored source, not a second biography schema. A person may use
 * an existing file, or deliberately create a note in the actual Central user
 * ground. This module neither fills missing facts nor discloses to a model. */
import type {CentralLocation,NativeDirectory,NativeFileReading} from '../../kernel/types';
import type {FileMutation} from '../../files/client';
function escape(value:string):string{return Array.from(new TextEncoder().encode(value),byte=>((byte>=48&&byte<=57)||(byte>=65&&byte<=90)||(byte>=97&&byte<=122)||[47,45,95,46].includes(byte))?String.fromCharCode(byte):'%'+byte.toString(16).toUpperCase().padStart(2,'0')).join('');}
export function noteLocation(parent:NativeDirectory,name:string):CentralLocation{
  const p=parent.location;
  if(parent.schema!=='central.directory-reading/v1'||parent.automatic_agent_or_model_invocation!==false||p.schema!=='central.path-ref/v1'||!(p.path==='Control/user'||p.path.startsWith('Control/user/')))throw new Error('Select the actual Central user ground before creating personal writing');
  if(!name||name.length>200||name.trim()!==name||!name.endsWith('.md')||name.startsWith('.')||/[\\/\u0000-\u001f\u007f]/.test(name))throw new Error('Choose one Markdown filename, without directories or hidden path components');
  if(parent.entries.some(e=>e.name===name))throw new Error('That source already exists. Open it instead; onboarding never overwrites existing writing');
  if(p.ref!==`central:path:${escape(p.root)}:${escape(p.path)}`)throw new Error('The directory does not carry a canonical Central path address');
  return {schema:'central.path-ref/v1',root:p.root,path:p.path+'/'+name,ref:p.ref+'/'+escape(name)};
}
export interface NotePorts {write(location:CentralLocation,revision:string,content:string):Promise<FileMutation>;read(location:CentralLocation):Promise<NativeFileReading>}
export async function createHumanNote(parent:NativeDirectory,name:string,content:string,ports:NotePorts):Promise<NativeFileReading>{
  if(!content.trim()||new TextEncoder().encode(content).length>65536||content.includes('\0'))throw new Error('Write a bounded, non-empty note first');
  const location=noteLocation(parent,name);
  // Empty expected revision means exclusive create in Central, never overwrite.
  const receipt=await ports.write(location,'',content);
  if(receipt.outcome==='conflict')throw new Error('Another writer created this source; your writing is still retained here');
  if(receipt.outcome!=='created'||!receipt.revision)throw new Error('Creation is unconfirmed; inspect the exact destination before retrying');
  const returned=await ports.read(location);
  if(returned.location.ref!==location.ref||returned.revision!==receipt.revision||returned.content!==content)throw new Error('The native readback did not confirm your exact writing; the draft was not discarded');
  return returned;
}
