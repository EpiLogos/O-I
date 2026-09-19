/**
 * Streaming text for the chat transcript.
 *
 * The owner's transcript arrives in polled pages, so an in-flight assistant
 * turn grows in steps. `useStreamedText` reveals each step at a reading pace
 * on the animation frame — the text on screen is always a prefix of what the
 * owner has actually recorded, never a guess ahead of it — and drops to the
 * full text the moment the turn is no longer live.
 */
import {useEffect,useRef,useState} from "react";

export function useStreamedText(text:string, live:boolean):string {
  const [shown,setShown]=useState(live?"":text);
  const frame=useRef<number>();
  const target=useRef(text);target.current=text;
  useEffect(()=>{
    cancelAnimationFrame(frame.current??0);
    if(!live){setShown(text);return;}
    if(matchMedia("(prefers-reduced-motion: reduce)").matches){setShown(text);return;}
    const step=()=>{
      setShown(current=>{
        const goal=target.current;
        if(!goal.startsWith(current))return goal;
        if(current.length>=goal.length)return current;
        const remaining=goal.length-current.length;
        const pace=Math.max(2,Math.ceil(remaining/14));
        return goal.slice(0,current.length+pace);
      });
      frame.current=requestAnimationFrame(step);
    };
    frame.current=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(frame.current??0);
  },[text,live]);
  return live?shown:text;
}

/** A small, honest rendering of the provider's text: fenced code blocks,
 * paragraphs, bullet lists, inline code, bold and emphasis. Nothing else is
 * interpreted; unknown markup stays as the characters the provider wrote. */
export type Piece=
  |{kind:"code";lang?:string;text:string}
  |{kind:"list";items:Inline[][]}
  |{kind:"paragraph";inline:Inline[]};
export type Inline={kind:"text"|"code"|"strong"|"em";text:string};

export function parsePieces(text:string):Piece[] {
  const pieces:Piece[]=[];
  const fence=/```([\w-]*)\n([\s\S]*?)(?:```|$)/g;
  let last=0;let match:RegExpExecArray|null;
  const prose=(chunk:string)=>{
    for(const block of chunk.split(/\n{2,}/)){
      const lines=block.split("\n").filter(line=>line.trim().length);
      if(!lines.length)continue;
      if(lines.every(line=>/^\s*[-*•]\s+/.test(line)))pieces.push({kind:"list",items:lines.map(line=>parseInline(line.replace(/^\s*[-*•]\s+/,"")))});
      else pieces.push({kind:"paragraph",inline:parseInline(lines.join("\n"))});
    }
  };
  while((match=fence.exec(text))){
    prose(text.slice(last,match.index));
    pieces.push({kind:"code",lang:match[1]||undefined,text:match[2].replace(/\n$/,"")});
    last=match.index+match[0].length;
  }
  prose(text.slice(last));
  return pieces;
}

export function parseInline(text:string):Inline[] {
  const out:Inline[]=[];
  const pattern=/(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)/g;
  let last=0;let match:RegExpExecArray|null;
  while((match=pattern.exec(text))){
    if(match.index>last)out.push({kind:"text",text:text.slice(last,match.index)});
    const token=match[0];
    if(match[1])out.push({kind:"code",text:token.slice(1,-1)});
    else if(match[2])out.push({kind:"strong",text:token.slice(2,-2)});
    else out.push({kind:"em",text:token.slice(1,-1)});
    last=match.index+token.length;
  }
  if(last<text.length)out.push({kind:"text",text:text.slice(last)});
  return out;
}
