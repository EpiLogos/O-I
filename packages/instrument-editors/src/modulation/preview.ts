import {clone,type Scene,type AutomationLane} from '../../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import {toNativeConfig} from '../../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeBridge';
import {createAutomationRuntime,evaluateLane} from '../../../../desktop/cradle/expressions-app/src/engine/automation';
/** Isolated authored-source preview through the SAME config translator and
 * evaluator as the actual engine. It does not create a native processing
 * clock. Stochastic preview seed is the evaluator's own deterministic seed. */
export function modulationPreview(scene:Scene,laneId:string,patch:Partial<AutomationLane>={},count=161){
 if(!Number.isInteger(count)||count<2||count>2048)throw Error('Invalid preview sample budget');
 const source=clone(scene),lane=source.automation.find(lane=>lane.id===laneId);
 if(!lane)throw Error('The native modulation source is absent.');
 if(lane.syncWith)throw Error('Preview the native group leader, not a following target.');
 Object.assign(lane,patch);
 const config=toNativeConfig(source),native=config.automations?.find(row=>row.id===(lane.nativeId??lane.id));
 if(!native)throw Error('This source has no admitted native automation target.');
 if(lane.wave==='morph')return {samples:[],horizon:0,native,reason:'Morph follows the actual field phase; use native telemetry.'};
 const horizon=native.type==='lfo'?2/Math.max(.001,native.rateHz??.25):(native.delayS??0)+2*Math.max(.001,native.durationS??2);
 const runtime=createAutomationRuntime();const preview={...native,enabled:true};
 const lo=native.type==='lfo'?native.min??0:native.from??0,hi=native.type==='lfo'?native.max??1:native.to??1;
 const samples=Array.from({length:count},(_,index)=>{const time=index/(count-1)*horizon;const result=evaluateLane(preview,time,runtime);return {time,value:result?.value??lo,normalized:hi===lo?.5:((result?.value??lo)-lo)/(hi-lo)};});
 return {samples,horizon,native,reason:undefined};
}
