/** Bounded, disposable view observations; never a source or instruction store. */
interface Held {node?:Element;text:string;validate?:()=>Promise<boolean>;mark?:(enabled:boolean)=>void}
const held=new Map<string,Held>();
const documentId=typeof crypto!=="undefined"?crypto.randomUUID():"unmounted";
export function componentText(node:Element){return (node.getAttribute('aria-label')||node.textContent||node.getAttribute('alt')||node.tagName.toLowerCase()).trim();}
function retain(key:string,value:Held){held.set(key,value);if(held.size>64){const first=held.keys().next().value!;held.get(first)?.mark?.(false);held.delete(first);}}
export function observeComponent(node:Element,bindingId:string){
 const key=crypto.randomUUID(),text=componentText(node),box=node.getBoundingClientRect();
 let overlay:HTMLDivElement|undefined;
 const position=()=>{if(!overlay)return;if(!node.isConnected){overlay.remove();overlay=undefined;window.removeEventListener("scroll",position,true);window.removeEventListener("resize",position);return;}const bounds=node.getBoundingClientRect();Object.assign(overlay.style,{left:`${bounds.x}px`,top:`${bounds.y}px`,width:`${bounds.width}px`,height:`${bounds.height}px`});};
 retain(key,{node,text,mark:enabled=>{
  if(enabled&&!overlay){overlay=document.createElement('div');overlay.dataset.contextDecoration='';overlay.setAttribute('aria-hidden','true');overlay.style.cssText='position:fixed;pointer-events:none;z-index:990;border:1px solid color-mix(in srgb,currentColor 30%,transparent);box-sizing:border-box';document.body.append(overlay);window.addEventListener('scroll',position,true);window.addEventListener('resize',position);position();}
  else if(!enabled){overlay?.remove();overlay=undefined;window.removeEventListener('scroll',position,true);window.removeEventListener('resize',position);}
 }});
 const path:string[]=[];let cursor:Element|null=node;
 while(cursor&&path.length<6){const tag=cursor.tagName.toLowerCase();const siblings=cursor.parentElement?[...cursor.parentElement.children].filter(child=>child.tagName===cursor!.tagName):[];path.unshift(`${tag}${siblings.length>1?`:nth-of-type(${siblings.indexOf(cursor)+1})`:''}`);if(cursor.closest('.surface-body')===cursor)break;cursor=cursor.parentElement;}
 return {bindingId,kind:'element',text,observationKey:key,documentId,selector:path.join(' > '),nodeRef:node.getAttribute('data-source-ref')??node.getAttribute('data-node-ref')??undefined,role:node.getAttribute('role')??node.tagName.toLowerCase(),bounds:{x:box.x,y:box.y,width:box.width,height:box.height}};
}
export function registerPageObservation(text:string,validate:()=>Promise<boolean>,mark?:(enabled:boolean)=>void){const key=crypto.randomUUID();retain(key,{text,validate,mark});return key;}
export async function observationIsCurrent(key:string){const reading=held.get(key);if(reading?.validate)return reading.validate();return !!reading?.node?.isConnected&&componentText(reading.node)===reading.text;}
export function markObservations(keys:readonly string[]){for(const [key,value] of held)value.mark?.(keys.includes(key));}
