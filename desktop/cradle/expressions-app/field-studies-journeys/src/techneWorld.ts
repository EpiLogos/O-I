/** The current World's real Wiki registers, opened in the existing engine. */
import {techneWorldRequest} from './kernelExpressions.js';
export function installTechneWorld(open:(ref:string)=>Promise<unknown>){
 const toolbar=document.createElement('div');toolbar.id='techne-world';toolbar.hidden=true;
 const select=document.createElement('select');select.setAttribute('aria-label','Wiki register');
 const status=document.createElement('span');status.setAttribute('role','status');
 toolbar.append(select,status);document.body.append(toolbar);
 let busy=false,epoch=0;
 const refresh=async()=>{
  const generation=++epoch;
  try{
   const value=await techneWorldRequest({operation:'list'}) as {registers?:{key:string;title:string}[];selected?:string};
   if(generation!==epoch)return;
   if(!Array.isArray(value.registers))throw new Error('The World did not disclose its Wiki registers.');
   select.replaceChildren(...value.registers.map(row=>{const option=document.createElement('option');option.value=row.key;option.textContent=row.title;return option;}));
   if(value.selected)select.value=value.selected;
  }catch(error){if(generation===epoch)status.textContent=error instanceof Error?error.message:String(error);}
 };
 select.addEventListener('change',()=>{if(busy)return;busy=true;select.disabled=true;status.textContent='Opening…';void(async()=>{
  try{const value=await techneWorldRequest({operation:'open',register:select.value}) as {expression_ref?:string};if(!value.expression_ref)throw new Error('The owner returned no Expression.');if(await open(value.expression_ref)===false)throw new Error('The current draft was retained. Resolve the native opening error before switching.');status.textContent='';}
  catch(error){status.textContent=error instanceof Error?error.message:String(error);}
  finally{busy=false;select.disabled=false;}
 })();});
 return {show(){toolbar.hidden=false;if(!busy)void refresh();},hide(){toolbar.hidden=true;},destroy(){++epoch;toolbar.remove();}};
}
