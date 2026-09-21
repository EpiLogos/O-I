import type {GraphNode,GraphReading} from './graph';
/** One visible subject per exact ref. Keep every owner disclosure, but prefer
 * the addressed native reading over an earlier summary row. Do not blend
 * attributes from distinct owner/revision readings into invented provenance. */
export function subjects(reading:GraphReading|undefined) {
  const rows=new Map<string,GraphNode[]>();
  for(const node of reading?.nodes??[]){const disclosures=rows.get(node.ref)??[];disclosures.push(node);rows.set(node.ref,disclosures);}
  const detail=(node:GraphNode)=>Number(Boolean(node.address))*4+Number(Boolean(node.aliases?.length))+Number(Boolean(node.tags?.length));
  return [...rows.values()].map(disclosures=>({node:disclosures.reduce((chosen,node)=>detail(node)>detail(chosen)?node:chosen),disclosures}));
}
export function neighbourhood(reading:GraphReading|undefined,ref?:string) {
  const refs=new Set<string>();if(!ref)return refs;refs.add(ref);
  for(const edge of reading?.edges??[])if(edge.from_ref===ref||edge.to_ref===ref){refs.add(edge.from_ref);refs.add(edge.to_ref);}
  return refs;
}
export function releaseGraph(id:string) {
  const key=`oi-cradle.knowledge-travel.v1:${id}`;
  const travel=JSON.parse(localStorage.getItem(key)??'null');
  if(travel?.visits?.[travel.index]){travel.visits[travel.index]={...travel.visits[travel.index],selected:undefined,camera:travel.visits[travel.index].overviewCamera??travel.visits[travel.index].camera,overviewCamera:undefined};localStorage.setItem(key,JSON.stringify(travel));}
  window.dispatchEvent(new CustomEvent('oi:graph-release',{detail:id}));
}
