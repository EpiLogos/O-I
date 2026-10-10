import type {AutomationLane} from '../../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
export type ModulationNumber='rate'|'phase'|'min'|'max'|'duration'|'delay';
export type ModulationInputs=Partial<Record<ModulationNumber,string>>;
/** Text input remains text until a deliberate native commit. Incomplete
 * decimals never turn into zero or overwrite an effective owner reading. */
export function modulationInputPatch(draft:Partial<AutomationLane>,inputs:ModulationInputs):Partial<AutomationLane>{
 const patch={...draft};
 for(const [key,text]of Object.entries(inputs)){
  if(!['rate','phase','min','max','duration','delay'].includes(key)||typeof text!=='string'||!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(text.trim())||!Number.isFinite(Number(text)))throw Error(`Enter a finite ${key} value; the input is retained.`);
  Object.assign(patch,{[key]:Number(text)});
 }
 return patch;
}
