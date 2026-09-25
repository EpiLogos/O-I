import type {NativeModelOption,NativeModelState} from "../../encounter/nativeModel";

/** Refuse transport locators and resource-kind labels as display names. */
export function modelDisplayName(name?:string|null):string|undefined {
 const value=name?.trim();
 if(!value||/^(?:harness|model|unknown)$/i.test(value)||/^(?:model|harness|agent-session|provider)[/:]/i.test(value)||/\S+:\/\//.test(value))return undefined;
 return value;
}

export function modelChoices(options:NativeModelOption[]):NativeModelOption[] {
 const seen=new Set<string>();
 return options.filter(option=>{if(seen.has(option.modelId))return false;seen.add(option.modelId);return true;})
  .map(option=>({...option,name:modelDisplayName(option.name)??"Model name unavailable"}));
}

export function modelSelectionReason(model:NativeModelState,disabled=false):string|undefined {
 if(model.reading?.model_controls?.model_selection!==true)return model.reading?.model_controls?.reason??model.error??"This harness does not advertise model selection.";
 if(disabled)return "The model can change when this turn or update finishes.";
 if(model.phase!=="ready")return model.error??"Read the current connection before changing its model.";
 if(model.reading.pinned_model_id)return "The session policy fixes the model. Change that policy through its owner.";
 return undefined;
}
