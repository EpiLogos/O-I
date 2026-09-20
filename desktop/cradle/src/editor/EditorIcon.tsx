import {Glyph,type GlyphName} from "../workspace/Glyph";
/** Editing additions obey the house 24-unit, unfilled, non-scaling stroke
 * grammar. Existing glyphs are reused rather than copied into another set. */
const paths={
 undo:"M9 5L4 10l5 5M4 10h9a6 6 0 010 12",redo:"M15 5l5 5-5 5M20 10h-9a6 6 0 000 12",
 bold:"M7 4h6a4 4 0 010 8H7m0-8v16h7a4 4 0 000-8H7",italic:"M10 4h9M5 20h9M15 4L9 20",
 strike:"M5 12h14M17 6c-2-3-9-3-9 2 0 2 3 3 5 4s4 2 4 4c0 5-8 5-10 2",
 code:"M8 6l-6 6 6 6M16 6l6 6-6 6M14 3l-4 18",heading:"M5 4v16M17 4v16M5 12h12",
 quote:"M4 6h6v7H4zM10 13c0 4-3 5-5 5M14 6h6v7h-6zM20 13c0 4-3 5-5 5",
 image:"M3 4h18v16H3zM3 17l6-6 4 4 3-3 5 5M15 8h.1",table:"M3 4h18v16H3zM3 10h18M10 4v16M3 15h18",
 indent:"M11 5h10M11 12h10M11 19h10M3 8l4 4-4 4",outdent:"M11 5h10M11 12h10M11 19h10M7 8l-4 4 4 4",
 comment:"M3 4h18v13H9l-6 4zM7 8h10M7 12h7",wrap:"M3 5h18M3 11h14a4 4 0 010 8h-5M14 16l-3 3 3 3M3 17h4",
 cut:"M9 10l11 10M9 14L20 3M4 4a3 3 0 110 6 3 3 0 010-6M4 14a3 3 0 110 6 3 3 0 010-6",
 fold:"M3 4h18M3 20h18M8 8l4 4 4-4M8 16l4-4 4 4",line:"M3 5h3v14M10 5h11M10 12h11M10 19h11",
};
export type EditorIconName=keyof typeof paths|GlyphName;
export function EditorIcon({name}:{name:EditorIconName}){return name in paths?<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round"><path vectorEffect="non-scaling-stroke" d={paths[name as keyof typeof paths]}/></svg>:<Glyph name={name as GlyphName}/>;}
