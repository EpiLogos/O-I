/** lane-1 A2 — the sticky, shape and text vocabulary of the Research Canvas.
 * Pure kinds, palette keys, defaults and closed-vocabulary helpers. Material
 * holds KEYS only: a palette key is never a colour, and the canvas maps a key
 * to a CSS token at render time (`var(--canvas-object-<key>)`). These objects
 * are occurrences like any other card: movable, alignable, frameable and
 * deletable through the existing commit path. */

export const CANVAS_OBJECT_KINDS=['sticky','shape','text'] as const;
export type CanvasObjectKind=(typeof CANVAS_OBJECT_KINDS)[number];
export const SHAPE_GEOMETRIES=['rectangle','ellipse','diamond'] as const;
export type ShapeGeometry=(typeof SHAPE_GEOMETRIES)[number];
/** A small fixed palette of quiet token colours — never Miro/tldraw primaries. */
export const PALETTE_KEYS=['amber','sage','sky','rose','stone'] as const;
export type PaletteKey=(typeof PALETTE_KEYS)[number];
/** A shape is stroke-only unless the composer picks one palette fill. */
export const SHAPE_FILLS=['none',...PALETTE_KEYS] as const;
export type ShapeFill=(typeof SHAPE_FILLS)[number];
export const STICKY_DEFAULT_PALETTE:PaletteKey='amber';
/** The one picker's choices, in the order the picker shows them. */
export const CANVAS_TOOL_CHOICES=['sticky','rectangle','ellipse','diamond','text'] as const;
export type CanvasToolChoice=(typeof CANVAS_TOOL_CHOICES)[number];
/** Where each choice lands in the material record, with its default label and display size (canvas units). */
export const CANVAS_TOOL_SPEC:Record<CanvasToolChoice,{kind:CanvasObjectKind;geometry?:ShapeGeometry;label:string;size:{width:number;height:number}}>={
 sticky:{kind:'sticky',label:'Sticky',size:{width:220,height:180}},
 rectangle:{kind:'shape',geometry:'rectangle',label:'Rectangle',size:{width:240,height:160}},
 ellipse:{kind:'shape',geometry:'ellipse',label:'Ellipse',size:{width:240,height:160}},
 diamond:{kind:'shape',geometry:'diamond',label:'Diamond',size:{width:200,height:160}},
 text:{kind:'text',label:'Text',size:{width:220,height:48}},
};
export const PALETTE_LABEL:Record<PaletteKey,string>={amber:'Amber',sage:'Sage',sky:'Sky',rose:'Rose',stone:'Stone'};
/** 24×24 stroke glyphs in the icons.ts grammar (drawn here, not pasted from a kit). */
export const CANVAS_TOOL_GLYPHS:Record<CanvasToolChoice,string>={
 sticky:'M4 4h16v11l-5 5H4Z M15 20v-5h5',
 rectangle:'M4 6h16v12H4Z',
 ellipse:'M3 12a9 6.5 0 1 0 18 0a9 6.5 0 1 0-18 0Z',
 diamond:'M12 3l9 9-9 9-9-9Z',
 text:'M5 6h14M12 6v13M9 19h6',
};

export function isCanvasObjectKind(value:unknown):value is CanvasObjectKind{return (CANVAS_OBJECT_KINDS as readonly unknown[]).includes(value);}
export function isPaletteKey(value:unknown):value is PaletteKey{return (PALETTE_KEYS as readonly unknown[]).includes(value);}
export function isShapeGeometry(value:unknown):value is ShapeGeometry{return (SHAPE_GEOMETRIES as readonly unknown[]).includes(value);}
export function isShapeFill(value:unknown):value is ShapeFill{return (SHAPE_FILLS as readonly unknown[]).includes(value);}

/** The material fields a canvas object card may carry (a plain reading; validation lives in researchMaterial). */
export interface CanvasObjectCard {type?:string;shape?:unknown;palette?:unknown;fill?:unknown;caption?:unknown}

/** The rendered node type of a canvas-object card; undefined for every other card. */
export function canvasObjectNodeType(card:CanvasObjectCard|undefined):ShapeGeometry|'sticky'|'text'|undefined{
 if(!card)return undefined;
 if(card.type==='sticky')return 'sticky';
 if(card.type==='text')return 'text';
 if(card.type==='shape'&&isShapeGeometry(card.shape))return card.shape;
 return undefined;
}
/** The CSS token a palette key renders with. */
export const paletteToken=(key:PaletteKey):string=>`var(--canvas-object-${key})`;
/** The background token of a canvas-object card; undefined means no fill. */
export function canvasObjectFill(card:CanvasObjectCard):string|undefined{
 if(card.type==='sticky')return paletteToken(isPaletteKey(card.palette)?card.palette:STICKY_DEFAULT_PALETTE);
 if(card.type==='shape'&&isPaletteKey(card.fill))return paletteToken(card.fill);
 return undefined;
}
/** Re-types the rendered nodes of canvas-object cards; every other node passes through unchanged. */
export function canvasObjectNodes<T extends {id:string;type?:string;bgColour?:unknown}>(nodes:readonly T[],cardOf:(id:string)=>CanvasObjectCard|undefined):T[]{
 return nodes.map(node=>{
  const card=cardOf(node.id),type=canvasObjectNodeType(card);
  if(!card||!type)return node;
  // The label is the card's caption (presentation); an unlabelled object shows no text on the stage.
  const label=typeof card.caption==='string'?card.caption:'';
  return {...node,type,title:label,bgColour:canvasObjectFill(card)} as unknown as T;
 });
}
