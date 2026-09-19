/**
 * Context items as the context tray composes them into text.
 *
 * The tray (ContextTray.tsx) is the one attach path: a validated selection is
 * written into the conversation's AIKit-owned shared draft as
 *
 *     @context — <title> · <origin ref> · revision <rev> · …
 *     > quoted line
 *     > quoted line
 *
 * and reaches the participant only when the person sends that draft. So the
 * same block is readable in two owner records, and they mean different things:
 *
 *   - in the shared DRAFT it is SELECTED: chosen, not sent;
 *   - in a recorded user message it was SENT: the owner journaled it as part
 *     of a message this conversation actually submitted.
 *
 * Neither says what the participant's operative context holds — no owner
 * operation discloses that, and nothing here infers it.
 */
export const CONTEXT_MARK="@context — ";

export interface ContextItem {
 /** Character range of the whole block (header + quote) in the text it was read from. */
 start:number;end:number;
 /** The header line after the mark, verbatim. */
 meta:string;
 title:string;
 /** The origin the tray recorded: a source ref, a URL, a working directory or a title. */
 origin?:string;
 /** The selection-time revision, when the selection carried one. */
 revision?:string;
 workingCopy:boolean;
 quote:string;
}

/** Read every `@context` block out of a draft or a recorded message. */
export function parseContextItems(text:string|undefined):ContextItem[] {
 if(!text)return [];
 const items:ContextItem[]=[];
 const lines=text.split("\n");
 let offset=0;
 for(let index=0;index<lines.length;index++){
  const line=lines[index];
  if(!line.startsWith(CONTEXT_MARK)){offset+=line.length+1;continue;}
  const start=offset;
  const meta=line.slice(CONTEXT_MARK.length);
  let end=offset+line.length;
  const quoted:string[]=[];
  let cursor=index+1;
  while(cursor<lines.length&&lines[cursor].startsWith(">")){
   quoted.push(lines[cursor].replace(/^> ?/,""));
   end+=1+lines[cursor].length;
   cursor++;
  }
  const parts=meta.split(" · ");
  const revision=parts.map(part=>/^revision (.+)$/.exec(part)?.[1]).find(Boolean);
  items.push({start,end,meta,title:parts[0]??meta,origin:parts.length>1?parts[1]:undefined,revision,workingCopy:parts.some(part=>part.startsWith("working copy")),quote:quoted.join("\n")});
  for(let consumed=index;consumed<cursor;consumed++)offset+=lines[consumed].length+1;
  index=cursor-1;
 }
 return items;
}

/** The text without one selected block (and the blank separator the tray put
 * before it). The caller writes the result through the draft's own
 * compare-and-swap path — removing a selection is an ordinary draft edit. */
export function removeContextItem(text:string,item:ContextItem):string {
 const before=text.slice(0,item.start).replace(/\n+$/,"");
 const after=text.slice(item.end).replace(/^\n+/,"");
 return [before,after].filter(Boolean).join("\n\n");
}
