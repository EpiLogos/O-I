import type {Change,ReadingRef} from "./types";

export interface PedagogicalEntity {id:string;title:string;glyph?:string;subject:{ref:string;owner:string;role:"being"|"thing";sources:ReadingRef[]};x:number;y:number}
export interface PedagogicalScene {id:string;title:string;entities:PedagogicalEntity[]}
export interface PedagogicalSequence {summary:string;scenes:PedagogicalScene[];method_refs:ReadingRef[];evidence_refs:ReadingRef[]}

/** Compile an Epii/M4.5 lesson into ordinary Expression changes. Scenes,
 * source-bearing objects, movement and optional glyph/text all remain visible
 * application state; method/evidence refs remain proposal disclosure. */
export function pedagogyChanges(expressionRef:string,sequence:PedagogicalSequence,initialSceneRef=`${expressionRef}:scene:main`):Change[] {
  if(!sequence.summary.trim()||sequence.scenes.length===0||sequence.method_refs.length===0||sequence.evidence_refs.length===0)throw new Error("Pedagogy requires scenes, a method and evidence");
  const changes:Change[]=[];
  const entities=new Map<string,PedagogicalEntity>();
  for(const [sceneIndex,scene] of sequence.scenes.entries()){
    const sceneRef=`${expressionRef}:scene:${scene.id}`;
    const actualSceneRef=sceneIndex===0?initialSceneRef:sceneRef;
    if(sceneIndex>0)changes.push({change:"scene_create",scene_ref:sceneRef,title:scene.title});
    const sceneEntities:string[]=[];
    for(const entity of scene.entities){
      if(entity.subject.sources.length===0)throw new Error(`Pedagogical entity ${entity.id} has no source`);
      const entityRef=`${expressionRef}:entity:${entity.id}`;
      sceneEntities.push(entityRef);
      const prior=entities.get(entity.id);
      if(!prior){
        entities.set(entity.id,entity);
        changes.push({change:"entity_add",scene_ref:actualSceneRef,entity_ref:entityRef,title:entity.title});
        changes.push({change:"subject_bind",entity_ref:entityRef,binding:{subject_ref:entity.subject.ref,native_owner:entity.subject.owner,presentation_role:entity.subject.role,sources:entity.subject.sources,readings:[],actions:[]}});
        changes.push({change:"parameter_set",entity_ref:entityRef,parameter:"glyph",value:entity.glyph??entity.title});
        changes.push({change:"parameter_set",entity_ref:entityRef,parameter:"x",value:entity.x},{change:"parameter_set",entity_ref:entityRef,parameter:"y",value:entity.y});
      }else if(prior.subject.ref!==entity.subject.ref||prior.subject.owner!==entity.subject.owner||prior.subject.role!==entity.subject.role){
        throw new Error(`Pedagogical entity ${entity.id} changed native identity between scenes`);
      }
    }
    if(sceneIndex>0)changes.push({change:"scene_compose",scene_ref:sceneRef,entity_refs:sceneEntities});
  }
  // Movement is explicit engine-owned automation over one stable, source-
  // bearing entity. It uses the accepted Expressions engine clock.
  for(const id of entities.keys()){
    const positions=sequence.scenes.flatMap(scene=>scene.entities.filter(entity=>entity.id===id).map(entity=>entity.x));
    const min=Math.min(...positions),max=Math.max(...positions);
    if(min!==max)changes.push({change:"parameter_automate",entity_ref:`${expressionRef}:entity:${id}`,parameter:"x",automation:{min,max,rate_hz:0.12,waveform:"sine"}});
  }
  return changes;
}
