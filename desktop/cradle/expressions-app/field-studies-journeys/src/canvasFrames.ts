/** lane-1 A9 — frame headings on the Research Canvas. A frame's title is the
 * owner's own written text, drawn quietly at the frame's top edge. It is the
 * only default-free text a frame adds to the stage: a frame with no title draws
 * nothing. The frame's `label` stays the name the Studio lists; it never reaches
 * the stage, because the composer did not write it. Pure record rules and
 * screen geometry; the instrument draws the headings. */

/** The title bound, in UTF-16 units (the record's own measure, as the kernel counts it). */
export const FRAME_TITLE_MAX=160;
/** The height, in screen pixels, of the strip an untitled frame offers for in-place titling. */
export const FRAME_TITLE_HIT_HEIGHT=14;

export interface FrameBox {x:number;y:number;width:number;height:number}
export interface FrameViewport {x:number;y:number;zoom:number}
export interface FrameHeading {id:string;title:string;z:number;left:number;top:number;width:number;hit:boolean}

/** The stored form of an owner's title: trimmed, capped at the bound, and null when nothing is left (the record then drops the key). */
export function frameTitleRecord(input:string):string|null{
 const trimmed=input.trim();
 if(!trimmed)return null;
 let out='';
 for(const character of trimmed){if(out.length+character.length>FRAME_TITLE_MAX)break;out+=character;}
 return out;
}

/** The title a frame shows: the stored title, trimmed; an absent or blank title shows nothing. */
export function frameTitleOf(title:unknown):string{
 return typeof title==='string'?title.trim():'';
}

/** Where each frame's heading sits on the stage, in screen pixels. A heading
 * is anchored to the top-left of its members' bounds (the frame's top edge).
 * A titled frame carries its caption; an untitled frame carries only the hit
 * strip that lets the owner title it in place. A frame with no member on the
 * stage has no heading. Headings come back back-to-front by frame order. */
export function frameHeadings(
 frames:Readonly<Record<string,{title?:unknown;memberRefs:readonly string[];z:number}>>,
 boxOf:(ref:string)=>FrameBox|undefined,
 viewport:FrameViewport,
):FrameHeading[]{
 const headings:FrameHeading[]=[];
 for(const [id,frame] of Object.entries(frames)){
  const boxes=frame.memberRefs.map(ref=>boxOf(ref)).filter((box):box is FrameBox=>!!box);
  if(!boxes.length)continue;
  const left=Math.min(...boxes.map(box=>box.x)),top=Math.min(...boxes.map(box=>box.y));
  const right=Math.max(...boxes.map(box=>box.x+box.width));
  const title=frameTitleOf(frame.title);
  headings.push({
   id,
   title,
   z:frame.z,
   left:left*viewport.zoom+viewport.x,
   top:top*viewport.zoom+viewport.y,
   width:(right-left)*viewport.zoom,
   hit:!title,
  });
 }
 return headings.sort((a,b)=>a.z-b.z);
}
