declare module "@epilogos/oi-design-system/expression" {
 export type FormName="idle"|"waiting"|"listening"|"searching"|"presence"|"arrival"|"fire"|"water"|"air"|"earth";
 export interface ExpressionOptions {rect:DOMRect|(()=>DOMRect|null);from?:DOMRect;dir?:number[];lean?:number;hold?:boolean;delay?:number;then?:ExpressionOptions&{name:string}}
 export interface ExpressionOverlay {canvas:HTMLCanvasElement;express:(name:string,options:ExpressionOptions)=>number|null;update:(handle:number|null,options:Partial<ExpressionOptions>&{name?:FormName})=>boolean;release:(handle:number|null)=>void;dispose:()=>void;pause:(value?:boolean)=>void;refresh:()=>void;inspect:()=>Record<string,unknown>}
 export function createExpressionOverlay(host:HTMLElement):ExpressionOverlay;
 export function gestureFor(intent:string):string|null;
}
