declare module "@epilogos/oi-design-system/expression" {
 export type FormName="idle"|"waiting"|"listening"|"searching"|"presence"|"arrival"|"fire"|"water"|"air"|"earth";
 export interface ExpressionOptions {rect:DOMRect|(()=>DOMRect|null);from?:DOMRect;dir?:number[];lean?:number;hold?:boolean;delay?:number;then?:ExpressionOptions&{name:string}}
 export const formNames: readonly FormName[];
 export const gestureDisposition: Readonly<Record<string,string|null>>;
 export function gestureFor(intent:string):string|null;
}
