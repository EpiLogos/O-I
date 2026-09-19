/** Native catalog actions. Pure document edits; no second simulator or clock. */
import {COLOR_PALETTES,BACKGROUND_THEMES,isLightHex} from '../../src/engine/colorPalettes';
import {CHAIN_PRESETS,GLYPH_CATEGORIES} from '../../src/engine/glyphLibrary';
import {CANONICAL_CHAKRAS} from '../../src/engine/chakraSystem';
import {WORLD_SCALE} from './nativeParameters';
import {Scene,Entity,uid} from './model';
import {nativeBinding,bindValue,baseValue} from './nativeParameters';
export {COLOR_PALETTES,BACKGROUND_THEMES,CHAIN_PRESETS,GLYPH_CATEGORIES};
function nativeNumber(s:Scene,path:string,value:number|undefined){if(value===undefined)return;const b=nativeBinding('native_'+path.replaceAll('.','__'));if(!b)throw new Error('Missing canonical native control '+path);bindValue(s,b.bind,value/b.factor);}
export function applyPalette(s:Scene,id:string){
 const p=COLOR_PALETTES.find(p=>p.id===id);if(!p)throw new Error('Unknown native palette');
 s.engine.colorEnabled=true;s.engine.paletteId=p.id;s.engine.paletteSource='legacy';
 s.field.palette=[p.primary,p.accent,p.secondary];s.engine.colorMode=p.recommendedMode;
 nativeNumber(s,'color.angle',p.recommendedAngle);nativeNumber(s,'color.cycleSpeed',p.recommendedSpeed);
 nativeNumber(s,'color.waveFrequency',p.recommendedFrequency);nativeNumber(s,'color.turbulenceModulation',p.recommendedTurbulence);
}
export function applyBackground(s:Scene,id:string){
 const p=BACKGROUND_THEMES.find(p=>p.id===id);if(!p)throw new Error('Unknown native background');
 s.field.background=p.color;s.engine.inkMode=isLightHex(p.color)?'blackOnWhite':'whiteOnBlack';
}
export function invertPalette(s:Scene){const p=s.field.palette;[p[0],p[p.length-1]]=[p[p.length-1],p[0]];}
export function applyChain(e:Entity,id:string){
 if(e.locked)throw new Error('Unlock this formation before changing its sequence.');
 const p=CHAIN_PRESETS.find(p=>p.id===id);if(!p)throw new Error('Unknown native sequence preset');
 const hold=p.recommendedHold??e.sequence.hold??3,transition=p.recommendedTransition??e.sequence.transition??1;
 e.sequence={...e.sequence,enabled:true,clock:'seconds',order:'loop',hold,transition,easing:p.recommendedEasing??e.sequence.easing,
  steps:p.chain.map(text=>({id:uid('step'),shape:'text',text,hold,transition,position:null}))};
}
export function applyGlyph(e:Entity,stepIndex:number|null,char:string){
 if(e.locked)throw new Error('Unlock this formation before changing its shape.');
 const target=stepIndex===null?e:e.sequence.steps[stepIndex];if(!target)throw new Error('No selected sequence step');
 target.shape='text';target.text=char;
 if(stepIndex===null&&e.sequence.steps.length===1){e.sequence.steps[0].shape='text';e.sequence.steps[0].text=char;}
}
/** Numeric fallback is explicitly the legacy glide only while no explicit sweep timing exists. */
export function sweepUsesLegacy(s:Scene){return !!s.native?.projection&&s.native.config.cymatics?.sweep?.glideS===undefined&&
 baseValue(s,'native_cymatics__sweep__glideS')===((s.native.projection.cymatics?.sweep?.glideS)??8);}

/** The native single-entity rising sequence, distinct from a seven-entity focus composition. */
export function applyKundaliniSequence(e:Entity){
 if(e.locked)throw new Error('Unlock this formation before changing its sequence.');
 e.sequence={...e.sequence,enabled:true,clock:'seconds',order:'loop',steps:[...CANONICAL_CHAKRAS].reverse().map(c=>({id:uid('step'),shape:'text',text:c.seedSyllable,hold:e.sequence.hold??3,transition:e.sequence.transition??1,position:{x:c.x/WORLD_SCALE,y:-c.y/WORLD_SCALE,z:0}}))};
}

export {NATIVE_LAYOUTS} from '../../src/engine/layouts';
