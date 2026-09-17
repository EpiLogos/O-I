import type {ExpressionDocument, SceneBody, SceneTrigger} from "./types";

/**
 * ES1A scene-body disclosure: what the stage may honestly present for a
 * scene's primary body. The engine composition is the only carrier with an
 * admitted live renderer today; every other carrier discloses its placement
 * and the real native open Actions instead of implying a renderer exists.
 * Portal trigger runtime (open/close/re-dock) is owned by the ES4 lane and is
 * disclosed as unsupported-until-connected here, never simulated.
 */
export interface SceneBodyDisclosure {
  scene_ref:string;
  carrier:string;
  presentation:string;
  /** True only when an admitted live renderer exists for this carrier. */
  renderable:boolean;
  capability:string;
  reason:string|null;
  /** The real native open Actions disclosed on the placed subject. */
  native_actions:{action_ref:string;target_ref:string;authority_requirement:string}[];
  triggers:{trigger_ref:string;occasion:string;target:SceneTrigger["target"]}[];
}

export function sceneBodyDisclosures(document:ExpressionDocument):SceneBodyDisclosure[] {
  return document.scenes.filter(scene=>scene.body).map(scene=>{
    const body=scene.body as SceneBody;
    return {
      scene_ref:scene.scene_ref,
      carrier:body.carrier,
      presentation:body.presentation,
      renderable:body.carrier==="engine_composition"&&body.capability.state==="renderable",
      capability:body.capability.state,
      reason:body.capability.state==="renderable"?null:body.capability.reason,
      native_actions:body.actions.map(a=>({action_ref:a.action_ref,target_ref:a.target_ref,authority_requirement:a.authority_requirement})),
      triggers:scene.triggers?.map(t=>({trigger_ref:t.trigger_ref,occasion:t.occasion,target:t.target}))??[],
    };
  });
}

/** A scene presents live only through its engine composition or entities;
 * carrier bodies without an admitted renderer are disclosed, never faked. */
export function sceneHasLiveRenderer(scene:{body?:SceneBody|null}):boolean {
  return !scene.body||(scene.body.carrier==="engine_composition"&&scene.body.capability.state==="renderable");
}
