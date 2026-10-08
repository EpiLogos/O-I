/** Pure builders for the Colour Field's discrete palette and paper actions. Each mirrors one app handler
 * (app.ts:538-542 and nativeFeatures.ts:17-21) and returns the change set for ONE apply.
 * No React, no I/O, no ambient randomness: the click handler injects the random source. */
import {BACKGROUND_THEMES,COLOR_PALETTES,hexToRgb,isLightHex} from '../../../../../desktop/cradle/expressions-app/src/engine/colorPalettes'
import type {NativeDeviceChange} from '../../../../expressions-boundary/src/editor'

export type PaperInk='blackOnWhite'|'whiteOnBlack'
/** Palette stop bounds the host admits (validateNativeColourChange: 2–8 six-digit colours). */
export const PALETTE_STOPS={min:2,max:8} as const
/** Glow written by "Harmonize paper to palette" (app.ts:538). */
export const HARMONIZED_GLOW=.65
/** Ink the harmonized paper needs (app.ts:538). */
export const HARMONIZED_INK:PaperInk='whiteOnBlack'
/** The two papers "Invert paper" flips between (app.ts:539). */
export const INVERTED_PAPERS={dark:'#09090b',light:'#fafaf9'} as const

export function inkLabel(ink:PaperInk|undefined):string {
 return ink==='blackOnWhite'?'Black on white':ink==='whiteOnBlack'?'White on black':'unset'
}

/** app.ts:541 invertPalette (nativeFeatures.ts:21): swaps the first and last stops only. Two stops reverse; longer lists keep their middle order. */
export function invertPaletteStops(stops:readonly string[]):string[] {
 if(stops.length<PALETTE_STOPS.min)throw Error('Keep 2–8 palette stops before inverting them.')
 const next=[...stops];[next[0],next[next.length-1]]=[next[next.length-1],next[0]]
 return next
}

/** One stop removed by its position. The list never drops below the two-stop minimum. */
export function removePaletteStop(stops:readonly string[],index:number):string[] {
 if(stops.length<=PALETTE_STOPS.min)throw Error('A palette keeps at least 2 stops.')
 if(!Number.isInteger(index)||index<0||index>=stops.length)throw Error('Choose an existing palette stop.')
 return stops.filter((_,i)=>i!==index)
}

/** app.ts:542: a uniform pick over the native catalogue, applied as its preset. The rng is injected; only the click handler supplies the source. */
export function randomPaletteId(rng:()=>number,catalogue:readonly {id:string}[]=COLOR_PALETTES):string {
 const r=rng()
 if(!Number.isFinite(r)||r<0||r>=1||catalogue.length===0)throw Error('The random source must return a number in [0, 1).')
 return catalogue[Math.floor(r*catalogue.length)].id
}
export function randomPaletteChange(rng:()=>number):NativeDeviceChange {
 return {kind:'colour-preset',palette_id:randomPaletteId(rng)}
}

/** app.ts:538: the paper from the first stop's channels at 7%, 7% and 12%, with floors of 3, 3 and 8. */
export function harmonizedPaper(firstStop:string):string {
 const [r,g,b]=hexToRgb(firstStop)
 return '#'+[Math.max(3,Math.floor(r*.07)),Math.max(3,Math.floor(g*.07)),Math.max(8,Math.floor(b*.12))].map(n=>n.toString(16).padStart(2,'0')).join('')
}
/** The native rows of "Harmonize paper to palette" (app.ts:538), one apply: the paper, its ambient-glow mode, the glow and the ink it needs. */
export function harmonizePaperChanges(firstStop:string,glowTarget:string):NativeDeviceChange[] {
 return [
  {kind:'colour-background',value:harmonizedPaper(firstStop)},
  {kind:'panel-setting',key:'backgroundMode',value:'ambientGlow'},
  {kind:'parameter',target:glowTarget,value:HARMONIZED_GLOW},
  {kind:'ink-mode',value:HARMONIZED_INK},
 ]
}

/** app.ts:539: the paper flips between the two fixed papers by the current background's luminance; the ink follows the new paper. */
export function invertedPaper(background:string):{background:string;ink:PaperInk} {
 const next=isLightHex(background)?INVERTED_PAPERS.dark:INVERTED_PAPERS.light
 return {background:next,ink:isLightHex(next)?'blackOnWhite':'whiteOnBlack'}
}

/** nativeFeatures.ts:17 applyBackground: each theme's paper and the ink its luminance selects (nativeFeatures.ts:19). */
export function paperPresets(catalogue=BACKGROUND_THEMES):{id:string;name:string;background:string;ink:PaperInk}[] {
 return catalogue.map(p=>({id:p.id,name:p.name,background:p.color,ink:isLightHex(p.color)?'blackOnWhite':'whiteOnBlack'}))
}
export function paperPreset(id:string):{id:string;name:string;background:string;ink:PaperInk} {
 const preset=paperPresets().find(row=>row.id===id)
 if(!preset)throw Error('Unknown native background')
 return preset
}

/** The rows of "Invert paper" (app.ts:539): the paper and the ink it needs, in one apply. The ink row is an admitted ink-mode change. */
export function invertPaperChanges(background:string):NativeDeviceChange[] {
 const next=invertedPaper(background)
 return [{kind:'colour-background',value:next.background},{kind:'ink-mode',value:next.ink}]
}
/** The rows of a native paper preset (nativeFeatures.ts:17 applyBackground): its paper and the ink its luminance selects, in one apply. */
export function paperPresetChanges(id:string):NativeDeviceChange[] {
 const preset=paperPreset(id)
 return [{kind:'colour-background',value:preset.background},{kind:'ink-mode',value:preset.ink}]
}
