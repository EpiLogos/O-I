/** Explicit user-picked UI observations; never executable page instructions. */
const held=new Map<string,{node?:Element;text:string;validate?:()=>Promise<boolean>}>();
export function componentText(node:Element){return (node.getAttribute('aria-label')||node.textContent||node.getAttribute('alt')||node.tagName.toLowerCase()).trim().slice(0,12000);}
export function observeComponent(node:Element,bindingId:string){
 const key=crypto.randomUUID(),text=componentText(node),box=node.getBoundingClientRect();
 held.set(key,{node,text});if(held.size>32)held.delete(held.keys().next().value!);
 const path:string[]=[];let cursor:Element|null=node;
 while(cursor&&path.length<6){const tag=cursor.tagName.toLowerCase();const siblings=cursor.parentElement?[...cursor.parentElement.children].filter(child=>child.tagName===cursor!.tagName):[];path.unshift(`${tag}${siblings.length>1?`:nth-of-type(${siblings.indexOf(cursor)+1})`:''}`);if(cursor.closest('.surface-body')===cursor)break;cursor=cursor.parentElement;}
 return {bindingId,kind:'element',text,observationKey:key,selector:path.join(' > '),role:node.getAttribute('role')??node.tagName.toLowerCase(),bounds:{x:box.x,y:box.y,width:box.width,height:box.height}};
}
export function registerPageObservation(text:string,validate:()=>Promise<boolean>){const key=crypto.randomUUID();held.set(key,{text,validate});if(held.size>32)held.delete(held.keys().next().value!);return key;}
export async function observationIsCurrent(key:string){const reading=held.get(key);if(reading?.validate)return reading.validate();return !!reading?.node?.isConnected&&componentText(reading.node)===reading.text;}
