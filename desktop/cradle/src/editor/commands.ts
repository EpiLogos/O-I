/** One command vocabulary for toolbar, context menu and keyboard.
 * File type is a capability hint, never write authority. */
export type EditorLanguage = "auto" | "text" | "markdown" | "javascript" | "typescript" | "tsx" | "html" | "css" | "json" | "python" | "xml";
export const EDITOR_LANGUAGES: readonly EditorLanguage[] = ["auto","text","markdown","javascript","typescript","tsx","html","css","json","python","xml"];
export type EditCommand = "bold" | "italic" | "strike" | "code" | "link" | "image" | "table" | "fence" | "quote" | "bullet" | "numbered" | "task" | "heading1" | "heading2" | "heading3" | "rule";
export interface TextEdit {from:number;to:number;insert:string;anchor:number;head:number}

/** Source-only, range-bounded Markdown edits. Nothing parses/serialises the
 * rest of the document, including frontmatter and unsupported extensions. */
export function markdownEdit(doc:string,from:number,to:number,command:EditCommand):TextEdit {
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<from||to>doc.length)throw new RangeError("Invalid selection");
 const chosen=doc.slice(from,to);
 const wrap=(left:string,right=left,placeholder="text"):TextEdit=>{
  // Toggle only exact delimiters. Do not eat adjacent unrelated punctuation.
  if(chosen.startsWith(left)&&chosen.endsWith(right)&&chosen.length>=left.length+right.length){const insert=chosen.slice(left.length,chosen.length-right.length);return {from,to,insert,anchor:from,head:from+insert.length};}
  if(from>=left.length&&doc.slice(from-left.length,from)===left&&doc.slice(to,to+right.length)===right)return {from:from-left.length,to:to+right.length,insert:chosen,anchor:from-left.length,head:from-left.length+chosen.length};
  const content=chosen||placeholder;return {from,to,insert:left+content+right,anchor:from+left.length,head:from+left.length+content.length};
 };
 switch(command){
  case "bold":return wrap("**");case "italic":return wrap("_");case "strike":return wrap("~~");
  case "code":{const fences=chosen.match(/`+/g)??[];const fence="`".repeat(Math.max(0,...fences.map(s=>s.length))+1);return wrap(fence+(chosen.startsWith('`')?' ':''),(chosen.endsWith('`')?' ':'')+fence,"code");}
  case "link":return wrap("[","](https://)","link text");
  case "image":return wrap("![","](image.png)","description");
  case "table":return {from,to,insert:"| Heading | Heading |\n| --- | --- |\n| "+(chosen||"Cell")+" | Cell |\n",anchor:from+2,head:from+9};
  case "fence":{const fence="`".repeat(Math.max(2,...(chosen.match(/`+/g)??[]).map(s=>s.length))+1);return wrap(fence+"\n","\n"+fence,"code");}
  case "rule":return {from,to,insert:"\n---\n",anchor:from+5,head:from+5};
 }
 const start=from===0?0:doc.lastIndexOf("\n",from-1)+1;
 // A selection ending at the next line's column zero excludes that line.
 const last=to>from&&doc[to-1]==="\n"?to-1:to;
 const next=doc.indexOf("\n",last);const end=next<0?doc.length:next;
 const lines=doc.slice(start,end).split("\n");
 const prefix=(i:number)=>command==="quote"?"> ":command==="bullet"?"- ":command==="numbered"?`${i+1}. `:command==="task"?"- [ ] ":"#".repeat(Number(command.slice(-1)))+" ";
 const marker=command==="quote"?/^> /:command==="bullet"?/^[-*+] /:command==="numbered"?/^\d+\. /:command==="task"?/^[-*+] \[[ xX]\] /:/^#{1,6} /;
 const all=lines.every((line,i)=>command.startsWith("heading")?line.startsWith(prefix(i)):marker.test(line));
 const insert=lines.map((line,i)=>all?line.replace(marker,""):prefix(i)+(command.startsWith("heading")?line.replace(marker,""):line)).join("\n");
 return {from:start,to:end,insert,anchor:start,head:start+insert.length};
}
export function languageFor(name:string,mime?:string|null,override:EditorLanguage="auto"):EditorLanguage {
 if(override!=="auto")return override;
 const kind=mime?.split(";")[0].trim().toLowerCase();
 if(kind==="text/markdown")return "markdown";if(kind==="text/html")return "html";if(kind==="application/json")return "json";
 const ext=name.split(".").pop()?.toLowerCase();
 return ({md:"markdown",markdown:"markdown",js:"javascript",jsx:"javascript",ts:"typescript",tsx:"tsx",html:"html",htm:"html",css:"css",json:"json",py:"python",xml:"xml",svg:"xml"} as Record<string,EditorLanguage>)[ext??""]??"text";
}
