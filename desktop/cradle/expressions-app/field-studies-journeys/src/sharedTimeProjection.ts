/** Presentation reads over the host-acknowledged axis. Unknown or unresolved
 * dates remain visible; only explicitly out-of-scope facts are narrowed. */
import type {TimelineRepository} from '@research-canvas/domain';
import type {TimelineDataSource} from '../../vendor/research-canvas/packages/canvas/src/timeline/TimelineLens';
import type {TechneReading} from '../../../src/techne/contract';
import type {TechneTimeAxis,TimeAxisScope} from '../../../src/techne/m0m5/timeline/timeAxis';

export function sharedTemporalNodeScopes(reading:TechneReading,axis:TechneTimeAxis):ReadonlyMap<string,TimeAxisScope> {
 if(axis.subject_ref!==reading.subject.subject_ref||axis.reading_ref!==reading.reading_ref
  ||axis.snapshot_revision!==(reading.snapshot?.revision??null)
  ||axis.events.length!==(reading.temporal?.length??0))throw Error('This time axis belongs to another native reading');
 return new Map((reading.temporal??[]).map((facet,index)=>[
  // Exact existing Research Canvas anchor correspondence (techneBundle.ts).
  // A generated presentation ID never becomes a native selection ref.
  facet.facet_ref??`${reading.subject.subject_ref}@techne:temporal:${facet.kind}:${index}`,
  axis.events[index].scope,
 ]));
}

export function sharedTimelinePresentation(base:TimelineDataSource,repository:TimelineRepository,reading:TechneReading,axis:TechneTimeAxis|null) {
 if(!axis)return {dataSource:base,repository};
 const scopes=sharedTemporalNodeScopes(reading,axis);
 const visible=(ref:string)=>scopes.get(ref)?.state!=='out-of-scope';
 const dataSource:TimelineDataSource={...base,async loadTimelineView(range,filters){
  const view=await base.loadTimelineView(range,filters);
  const nodes=view.nodes.filter(row=>visible(row.node.graphNodeId));
  const present=new Set(nodes.map(row=>row.node.graphNodeId));
  return {...view,nodes,relationships:view.relationships.filter(row=>present.has(row.sourceGraphNodeId)&&present.has(row.targetGraphNodeId))};
 }};
 const narrowedRepository:TimelineRepository={...repository,async getTimelineWalk(scope,range){
  const walk=await repository.getTimelineWalk(scope,range);
  return {...walk,earthboundNodes:walk.earthboundNodes.filter(node=>visible(node.graphNodeId))};
 }};
 return {dataSource,repository:narrowedRepository};
}
