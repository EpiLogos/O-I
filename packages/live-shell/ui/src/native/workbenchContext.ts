import type {LayoutState,SurfaceBinding} from '../../../../../desktop/cradle/src/surface/types';
import {preparedContextScopeKey,type NativePreparedContextScope} from './preparedContextBinding';

/** Resolve the conversation from its retained binding. A hosted binding cannot
 * fall through to local Central when its World provenance is missing. */
export function workbenchContextScope(layout:LayoutState,workspaceId:string,accessEpoch:number,project?:string,sourceWorldRef?:string):NativePreparedContextScope {
  const accompanying=layout.accompanying;
  const bindings=accompanying?Object.values(layout.surfaces).filter(binding=>binding.kind==='encounter'&&binding.ref===accompanying.ref&&binding.project===accompanying.project&&binding.encounter?.space===accompanying.space):[];
  const world=(binding:SurfaceBinding)=>(binding.view as (NonNullable<SurfaceBinding['view']>&{sourceWorldRef?:string})|undefined)?.sourceWorldRef;
  const worlds=new Set(bindings.map(world));
  if(worlds.size>1||sourceWorldRef!==undefined&&worlds.size>0&&!worlds.has(sourceWorldRef))throw Error('The retained conversation has conflicting native World provenance.');
  const resolved=bindings.length?worlds.values().next().value:sourceWorldRef;
  if(accompanying&&!bindings.length)throw Error('The accompanying conversation has no retained native owner binding. Reopen its conversation before inspecting context.');
  if(bindings.some(binding=>binding.hosted)&&!resolved)throw Error('The hosted conversation has no disclosed native World address.');
  const scope:NativePreparedContextScope={workspaceId,accessEpoch,project:accompanying?.project??project??'',sourceWorldRef:resolved,...(accompanying?{accompanying}: {})};
  preparedContextScopeKey(scope);
  return scope;
}
