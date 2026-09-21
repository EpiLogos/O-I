import {parser,GFM} from "@lezer/markdown";
import type {SyntaxNode} from "@lezer/common";
/** GFM preview over the same parser family as CodeMirror. Raw HTML is escaped;
 * rendering never rewrites the Markdown source. Literal runs carry exact UTF-16
 * source offsets; non-contiguous formatted selection stays a page observation. */
export interface MarkdownOptions {resolveAsset:(path:string)=>string}
const markdownParser=parser.configure(GFM);
function escape(text:string){return text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
export function renderMarkdown(source:string,options:MarkdownOptions):string{
 const span=(from:number,to:number)=>to<=from?"":`<span data-source-start="${from}" data-source-end="${to}">${escape(source.slice(from,to))}</span>`;
 const children=(node:SyntaxNode)=>{const list:SyntaxNode[]=[];for(let c=node.firstChild;c;c=c.nextSibling)list.push(c);return list;};
 const raw=(node:SyntaxNode)=>source.slice(node.from,node.to);
 const url=(target:string)=>{const t=target.replace(/^<|>$/g,"").trim();if(/^(?:https?:|mailto:|#)/i.test(t))return escape(t);if(/^[a-z][a-z0-9+.-]*:/i.test(t)||t.startsWith('//')||/[\u0000-\u001f]/.test(t))return "";const result=options.resolveAsset(t);return /^(?:javascript|vbscript|data):/i.test(result.trim())?"":escape(result);};
 const inline=(node:SyntaxNode,from=node.from,to=node.to):string=>{
  let out="",cursor=from;
  for(const child of children(node)){if(child.to<=from||child.from>=to)continue;out+=span(cursor,child.from);out+=render(child);cursor=child.to;}
  return out+span(cursor,to);
 };
 const body=(node:SyntaxNode)=>children(node).map(render).join("");
 const render=(node:SyntaxNode):string=>{
  const name=node.name,cs=children(node);
  if(name==="Document")return body(node);
  if(name==="Paragraph")return `<p>${inline(node)}</p>`;
  if(/^ATXHeading[1-6]$/.test(name)){const level=name.slice(-1),mark=cs.find(c=>c.name==="HeaderMark");let start=mark?.to??node.from;while(source[start]===" ")start++;const last=cs[cs.length-1];const end=last?.name==="HeaderMark"&&last!==mark?last.from:node.to;return `<h${level}>${inline(node,start,end)}</h${level}>`;}
  if(/^SetextHeading/.test(name)){const mark=cs.find(c=>c.name==="HeaderMark");return `<h${name.slice(-1)}>${inline(node,node.from,mark?.from??node.to)}</h${name.slice(-1)}>`;}
  if(["StrongEmphasis","Emphasis","Strikethrough","InlineCode"].includes(name)){const tag=name==="StrongEmphasis"?"strong":name==="Emphasis"?"em":name==="Strikethrough"?"del":"code";const start=cs[0]?.to??node.from,end=cs[cs.length-1]?.from??node.to;return `<${tag}>${inline(node,start,end)}</${tag}>`;}
  if(name==="Link"||name==="Image"){
   const target=cs.find(c=>c.name==="URL");const closing=cs.find(c=>c.name==="LinkMark"&&raw(c)==="]");
   if(!target||!closing)return span(node.from,node.to);
   const start=cs[0]?.to??node.from;const href=url(raw(target));
   if(name==="Image")return href?`<img alt="${escape(source.slice(start,closing.from))}" src="${href}" loading="lazy" referrerpolicy="no-referrer">`:span(node.from,node.to);
   return href?`<a href="${href}" rel="noreferrer noopener">${inline(node,start,closing.from)}</a>`:inline(node,start,closing.from);
  }
  if(name==="Autolink"){const target=raw(node).replace(/^<|>$/g,"");const href=url(target);return href?`<a href="${href}" rel="noreferrer noopener">${escape(target)}</a>`:span(node.from,node.to);}
  if(name==="Blockquote")return `<blockquote>${body(node)}</blockquote>`;
  if(name==="BulletList")return `<ul>${body(node)}</ul>`;
  if(name==="OrderedList"){const start=/^\d+/.exec(raw(node))?.[0]??"1";return `<ol start="${start}">${body(node)}</ol>`;}
  if(name==="ListItem")return `<li>${body(node)}</li>`;
  if(name==="Task"){const marker=cs.find(c=>c.name==="TaskMarker");return `<p><input type="checkbox" disabled aria-label="Task status"${marker&&/x/i.test(raw(marker))?" checked":""}> ${inline(node,marker?.to??node.from)}</p>`;}
  if(name==="FencedCode"||name==="CodeBlock"){const code=cs.filter(c=>c.name==="CodeText");return `<pre><code>${code.length?span(code[0].from,code[code.length-1].to):""}</code></pre>`;}
  if(name==="Table")return `<table>${body(node)}</table>`;
  if(name==="TableHeader")return `<thead><tr>${cs.filter(c=>c.name==="TableCell").map(c=>`<th>${inline(c)}</th>`).join("")}</tr></thead>`;
  if(name==="TableRow")return `<tr>${cs.filter(c=>c.name==="TableCell").map(c=>`<td>${inline(c)}</td>`).join("")}</tr>`;
  if(name==="HorizontalRule")return "<hr>";
  if(name==="HardBreak")return "<br>";
  if(["EmphasisMark","CodeMark","QuoteMark","ListMark","HeaderMark","LinkMark","TaskMarker","TableDelimiter","CodeInfo"].includes(name))return "";
  // HTML, declarations, unknown dialect extensions remain literal text.
  return span(node.from,node.to);
 };
 return render(markdownParser.parse(source).topNode);
}
