/** Curated, offline-safe typefaces. Every entry is a system-font stack that resolves on the
 *  authoring device first and degrades gracefully elsewhere; nothing is downloaded or bundled. */
export interface FontOption {id:string;label:string;stack:string;note?:string}
/** Select value that means "show the free-text custom stack editor" — never written to settings. */
export const CUSTOM_SENTINEL='__custom__';
export const FONT_OPTIONS:FontOption[]=[
 {id:'system-sans',label:'System Sans',stack:'system-ui, -apple-system, sans-serif',note:'the device’s native face'},
 {id:'neue-grotesk',label:'Neue Grotesk',stack:'"Helvetica Neue", Helvetica, Arial, sans-serif',note:'neutral Swiss workhorse'},
 {id:'humanist',label:'Humanist',stack:'"Avenir Next", Avenir, "Segoe UI", sans-serif',note:'warm, open counters'},
 {id:'geometric',label:'Geometric',stack:'Futura, "Century Gothic", "URW Gothic", sans-serif',note:'circles on a grid'},
 {id:'classic-serif',label:'Classic Serif',stack:'Georgia, "Times New Roman", serif',note:'screen-legible book face'},
 {id:'didone',label:'Didone',stack:'Didot, "Bodoni 72", "Bodoni MT", serif',note:'high-contrast display serif'},
 {id:'editorial-serif',label:'Editorial Serif',stack:'Palatino, "Palatino Linotype", "Book Antiqua", serif',note:'renaissance book hand'},
 {id:'slab',label:'Slab',stack:'Rockwell, "Roboto Slab", serif',note:'bracketed poster strength'},
 {id:'modern-mono',label:'Modern Mono',stack:'ui-monospace, "SF Mono", Menlo, Consolas, monospace',note:'fixed-pitch, terminal-true'},
 {id:'typewriter',label:'Typewriter',stack:'"Courier New", Courier, monospace',note:'struck ribbon on paper'},
 {id:'display-heavy',label:'Display Heavy',stack:'Impact, "Arial Black", sans-serif',note:'loud headline weight'},
 {id:'rounded',label:'Rounded',stack:'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Hiragino Maru Gothic ProN", sans-serif',note:'soft-spoken markers'}
];
const SYSTEM_OPTION=FONT_OPTIONS[0];
/** The engine's own long cross-platform fallback (src/engine/GlyphSampler.ts FALLBACK_FONT_STACK);
 *  documents carrying it resolve to System Sans rather than a false "custom". */
export const ENGINE_FALLBACK_STACK='system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif';
/** Maps a stored stack to its chooser selection: the matching curated id, System Sans for the
 *  engine fallback (and empty values), else the custom sentinel with the value passed through. */
export function resolveFontOption(value:string|undefined):{optionId:string;stack:string}{
 const trimmed=typeof value==='string'?value.trim():'';
 if(!trimmed||trimmed===ENGINE_FALLBACK_STACK)return {optionId:SYSTEM_OPTION.id,stack:SYSTEM_OPTION.stack};
 const curated=FONT_OPTIONS.find(o=>o.stack===trimmed);
 if(curated)return {optionId:curated.id,stack:trimmed};
 return {optionId:CUSTOM_SENTINEL,stack:typeof value==='string'?value:SYSTEM_OPTION.stack};
}
