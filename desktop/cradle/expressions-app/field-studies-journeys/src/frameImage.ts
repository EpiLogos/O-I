/** lane-1 B3 — frame export as image. The PNG is the canvas as the canvas
 * draws it: the rendered stage (the vendored Research Canvas's xyflow DOM) is
 * cloned, cut down to the frame's member cards and the connections between
 * them, stripped of chrome, its computed styles inlined, wrapped in an SVG
 * foreignObject and drawn at 2x. Nothing here redraws the cards.
 *
 * The pure parts (membership, chrome, viewBox maths, url classification) are
 * tested over plain models; the stage renderer is the only browser code. */
import {png} from './capture';

export interface ImageBox {x:number;y:number;width:number;height:number}
/** A connection as the canvas holds it: its native id and its two member ends. `labelled` is set when the canvas draws a label for it. */
export interface StageEdge {id:string;sourceId:string;targetId:string;labelled?:boolean}

/** The device resolution the export is drawn at: 2x the canvas units. */
export const FRAME_IMAGE_SCALE=2;
const PAPER='#ffffff';

/** The smallest box holding every member box, grown by `padding` on each side; null when there are no members. */
export function frameBounds(boxes:readonly ImageBox[],padding=0):ImageBox|null {
 if(!boxes.length)return null;
 const left=Math.min(...boxes.map(box=>box.x))-padding,top=Math.min(...boxes.map(box=>box.y))-padding;
 const right=Math.max(...boxes.map(box=>box.x+box.width))+padding,bottom=Math.max(...boxes.map(box=>box.y+box.height))+padding;
 return {x:left,y:top,width:right-left,height:bottom-top};
}

/** The PNG's pixel size: the bounds in canvas units times the scale, never less than one pixel. */
export function frameImageSize(bounds:ImageBox,scale=FRAME_IMAGE_SCALE):{width:number;height:number} {
 return {width:Math.max(1,Math.round(bounds.width*scale)),height:Math.max(1,Math.round(bounds.height*scale))};
}

/** The SVG that holds the stage: its pixel size is the output, its viewBox is the frame in canvas units. */
export function stageViewBox(bounds:ImageBox,scale=FRAME_IMAGE_SCALE):{width:number;height:number;viewBox:string} {
 const size=frameImageSize(bounds,scale);
 return {...size,viewBox:`0 0 ${bounds.width} ${bounds.height}`};
}

/** Where a card sits inside the stage, in canvas units from the frame's origin. */
export function stagePlacement(box:ImageBox,bounds:ImageBox):{left:number;top:number} {
 return {left:box.x-bounds.x,top:box.y-bounds.y};
}

/** Connections the frame draws: both ends are members. The count names those that leave the frame. */
export function frameSelection(members:ReadonlySet<string>,edges:readonly StageEdge[]):{edges:StageEdge[];leaving:number} {
 const kept=edges.filter(edge=>members.has(edge.sourceId)&&members.has(edge.targetId));
 return {edges:kept,leaving:edges.length-kept.length};
}

/** The rendered classes of the canvas's own chrome: handles, resize grips, selection outlines, toolbars, the zoom readout, guides. A card or connection never draws these. */
export const CHROME_CLASSES:readonly string[]=[
 'flow-handle','react-flow__handle','node-resize-control','node-resize-grip','react-flow__resize-control',
 'react-flow__nodesselection','react-flow__selection','react-flow__minimap','react-flow__controls','react-flow__panel',
 'react-flow__node-toolbar','react-flow__edge-toolbar','canvas-toolbar','canvas-zoom-readout','flow-edge-actions','flow-edge-action',
 'canvas-guides','canvas-guide',
];
const CHROME=new Set(CHROME_CLASSES);
export function isChromeClass(classes:readonly string[]):boolean {return classes.some(name=>CHROME.has(name));}

/** A rendered element as a plain model: its class names and its children. Chrome subtrees are removed; the count is what was removed. */
export interface TreeModel {classes:readonly string[];children:readonly TreeModel[];id?:string}
export function stripChrome(root:TreeModel):{kept:TreeModel;removed:number} {
 let removed=0;
 const walk=(node:TreeModel):TreeModel=>{
  const children:TreeModel[]=[];
  for(const child of node.children){
   if(isChromeClass(child.classes)){removed+=1;continue;}
   children.push(walk(child));
  }
  return {...node,children};
 };
 return {kept:walk(root),removed};
}

/** The stage's CSS selector for chrome, derived from the same list. */
export const CHROME_SELECTOR=CHROME_CLASSES.map(name=>`.${name}`).join(',');

/** The url() references inside a CSS value, in order. */
export function cssUrls(value:string):string[] {
 const urls:string[]=[];
 for(const match of value.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g))urls.push(match[2]);
 return urls;
}

/** The family names of a computed font-family list, unquoted. */
export function fontFamilies(value:string):string[] {
 return value.split(',').map(name=>name.trim().replace(/^['"]|['"]$/g,'')).filter(Boolean);
}

/** How a resource referenced by the stage can be copied into the image. Pure: the fetch decides the rest. */
export function resourceKind(url:string,pageOrigin:string):'inline'|'same-origin'|'cross-origin' {
 if(url.startsWith('data:'))return 'inline';
 try{const resolved=new URL(url,pageOrigin);return resolved.origin===pageOrigin?'same-origin':'cross-origin';}catch{return 'cross-origin';}
}

const SVG_NS='http://www.w3.org/2000/svg';
const XHTML_NS='http://www.w3.org/1999/xhtml';

/** What the stage renderer needs: the flow viewport, each member's box, the connections, and the frame bounds. */
export interface StageRequest {flow:HTMLElement;members:ReadonlyMap<string,ImageBox>;edges:readonly StageEdge[];bounds:ImageBox;scale?:number}
/** The PNG blob and every named refusal: a resource or part that could not be copied is listed, never dropped silently. */
export interface StageResult {blob:Blob;refused:string[]}

/** Reads a resource into a data url. A cross-origin resource that does not allow copying is refused with the browser's reason. */
async function inlineResource(url:string):Promise<string> {
 if(url.startsWith('data:'))return url;
 const response=await fetch(url,{mode:'cors',credentials:'omit'});
 if(!response.ok)throw new Error(`the server answered ${response.status}`);
 const blob=await response.blob();
 return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('the file could not be read'));reader.readAsDataURL(blob);});
}
function describe(url:string):string {return url.length>80?`${url.slice(0,77)}…`:url;}

/** Replaces every url() in `text` with its inlined copy; a refused one is named and left out of the copy. */
async function inlineUrls(text:string,refused:string[],subject:string):Promise<string> {
 const matches=[...text.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)];
 let out='',at=0;
 for(const match of matches){
  out+=text.slice(at,match.index);at=match.index!+match[0].length;
  const url=match[2];
  try{out+=`url("${await inlineResource(url)}")`;}
  catch(error){refused.push(`${subject}: ${describe(url)} cannot be copied into the image (${error instanceof Error?error.message:String(error)})`);out+='none';}
 }
 return out+text.slice(at);
}

/** Copies an element and its subtree with every computed style written inline, so the copy looks the same without the page's stylesheets. */
function cloneInlined(source:Element,families:Set<string>):Element {
 const clone=source.cloneNode(true) as Element;
 const from=[source,...Array.from(source.querySelectorAll('*'))],to=[clone,...Array.from(clone.querySelectorAll('*'))];
 for(let index=0;index<from.length;index++){
  const computed=getComputedStyle(from[index]);
  for(const family of fontFamilies(computed.fontFamily))families.add(family);
  const target=to[index] as HTMLElement | SVGElement;
  for(let property=0;property<computed.length;property++){
   const name=computed.item(property);
   target.style.setProperty(name,computed.getPropertyValue(name),computed.getPropertyPriority(name));
  }
 }
 return clone;
}

/** The @font-face rules for the families the stage uses, with their files inlined. A stylesheet the page will not let us read is named. */
async function fontFaceCss(families:Set<string>,refused:string[]):Promise<string> {
 let css='';
 for(const sheet of Array.from(document.styleSheets)){
  let rules:CSSRuleList;
  try{rules=sheet.cssRules;}
  catch{refused.push(`fonts from stylesheet ${sheet.href??'(inline)'} are not copied: the page does not allow reading it`);continue;}
  for(const rule of Array.from(rules)){
   if(!(rule instanceof CSSFontFaceRule))continue;
   const family=fontFamilies(rule.style.getPropertyValue('font-family'))[0];
   if(!family||!families.has(family))continue;
   css+=`${await inlineUrls(rule.cssText,refused,`font ${family}`)}\n`;
  }
 }
 return css;
}

/** Renders the frame's member cards and the connections between them from the live stage, as a PNG at the export scale. */
export async function renderFrameStage(request:StageRequest):Promise<StageResult> {
 const scale=request.scale??FRAME_IMAGE_SCALE,{bounds,flow}=request;
 const refused:string[]=[];
 const selection=frameSelection(new Set(request.members.keys()),request.edges);
 const liveNodes=new Map<string,Element>();
 flow.querySelectorAll('.react-flow__node').forEach(el=>{const id=el.getAttribute('data-id');if(id)liveNodes.set(id,el);});
 const liveEdges=new Map<string,Element>();
 flow.querySelectorAll('[data-testid^="edge-"]').forEach(el=>liveEdges.set(el.getAttribute('data-testid')!.slice('edge-'.length),el));
 const nodeSources:[string,Element][]=[];
 for(const id of request.members.keys()){
  const el=liveNodes.get(id);
  if(el)nodeSources.push([id,el]);else refused.push(`card ${id} is not on the stage, so it is not drawn`);
 }
 const edgeSources:[StageEdge,Element][]=[];
 for(const edge of selection.edges){
  const el=liveEdges.get(edge.id);
  if(el)edgeSources.push([edge,el]);else refused.push(`connection ${edge.id} is not on the stage, so it is not drawn`);
  if(el&&edge.labelled)refused.push(`connection ${edge.id}: its label is drawn by the canvas outside the line, so the image shows the line without its label`);
 }
 if(selection.leaving)refused.push(`${selection.leaving} connection${selection.leaving===1?'':'s'} leaving the frame ${selection.leaving===1?'is':'are'} not drawn`);
 const markerSource=flow.querySelector('.react-flow__edges defs');
 const families=new Set<string>();
 // The selected outline is a state of the live canvas, not of the card: it is lifted for the copy and restored at once, synchronously, so nothing paints in between.
 const selected=Array.from(flow.querySelectorAll('.selected'));
 let nodeClones:[string,Element][]=[],edgeClones:Element[]=[],markers:Element|null=null;
 try{
  for(const el of selected)el.classList.remove('selected');
  nodeClones=nodeSources.map(([id,el])=>[id,cloneInlined(el,families)]);
  edgeClones=edgeSources.map(([,el])=>cloneInlined(el,families));
  markers=markerSource?cloneInlined(markerSource,families):null;
 }finally{
  for(const el of selected)el.classList.add('selected');
 }
 for(const [,clone] of nodeClones)for(const chrome of Array.from(clone.querySelectorAll(CHROME_SELECTOR)))chrome.remove();
 for(const clone of edgeClones)for(const chrome of Array.from(clone.querySelectorAll(CHROME_SELECTOR)))chrome.remove();
 const pageOrigin=location.origin;
 for(const clone of [...nodeClones.map(([,c])=>c),...edgeClones]){
  for(const media of Array.from(clone.querySelectorAll('img,image'))){
   const attribute=media.hasAttribute('href')?'href':media.hasAttribute('xlink:href')?'xlink:href':'src';
   const url=media.getAttribute(attribute);
   if(!url)continue;
   try{media.setAttribute(attribute,await inlineResource(url));}
   catch(error){const reason=resourceKind(url,pageOrigin)==='cross-origin'?'it is on another origin that does not allow copying':error instanceof Error?error.message:String(error);refused.push(`image ${describe(url)} cannot be copied into the image (${reason})`);media.removeAttribute(attribute);}
  }
  for(const element of [clone,...Array.from(clone.querySelectorAll('*'))] as HTMLElement[]){
   const background=element.style?.backgroundImage;
   if(background&&background!=='none'&&cssUrls(background).length)element.style.backgroundImage=await inlineUrls(background,refused,'background');
  }
 }

 const svg=document.createElementNS(SVG_NS,'svg');
 const view=stageViewBox(bounds,scale);
 svg.setAttribute('xmlns',SVG_NS);
 svg.setAttribute('width',String(view.width));svg.setAttribute('height',String(view.height));svg.setAttribute('viewBox',view.viewBox);
 const fonts=await fontFaceCss(families,refused);
 if(fonts){const style=document.createElementNS(SVG_NS,'style');style.textContent=fonts;svg.append(style);}
 if(markers)svg.append(markers);
 const edgeLayer=document.createElementNS(SVG_NS,'g');
 edgeLayer.setAttribute('transform',`translate(${-bounds.x} ${-bounds.y})`);
 for(const clone of edgeClones)edgeLayer.append(clone);
 svg.append(edgeLayer);
 const foreign=document.createElementNS(SVG_NS,'foreignObject');
 foreign.setAttribute('x','0');foreign.setAttribute('y','0');foreign.setAttribute('width',String(bounds.width));foreign.setAttribute('height',String(bounds.height));
 const root=document.createElementNS(XHTML_NS,'div');
 root.setAttribute('style',`position:relative;width:${bounds.width}px;height:${bounds.height}px;overflow:hidden;`);
 for(const [id,clone] of nodeClones){
  const box=request.members.get(id)!,place=stagePlacement(box,bounds);
  const html=clone as HTMLElement;
  html.style.position='absolute';html.style.left='0px';html.style.top='0px';html.style.transform=`translate(${place.left}px,${place.top}px)`;
  root.append(html);
 }
 foreign.append(root);svg.append(foreign);

 const markup=new XMLSerializer().serializeToString(svg);
 const image=new Image();
 image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
 try{await image.decode();}
 catch{throw new Error('The browser could not draw the stage into the image.');}
 const element=document.createElement('canvas');element.width=view.width;element.height=view.height;
 const context=element.getContext('2d');
 if(!context)throw new Error('This browser cannot draw the frame image.');
 context.fillStyle=PAPER;context.fillRect(0,0,view.width,view.height);
 context.drawImage(image,0,0,view.width,view.height);
 const blob=await png(element).catch(()=>{throw new Error('The stage holds a resource the browser will not copy into an image, so the PNG was not written.');});
 return {blob,refused};
}

