import type {Tool} from './model.js';
export type RailItem=Tool|'objects';
/** Cursor selection and the visible local panel are independent axes of UI state. */
export function railPressed(key:string,cursor:'interact'|'select',panel:string,pin:boolean){return key==='interact'||key==='select'?key===cursor:key==='pin'?pin:key===panel;}
