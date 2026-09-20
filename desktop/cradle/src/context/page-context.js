/* Page-only observations. No native IPC, source writes or authority. */
(() => {
  if (window.__OI_PAGE_CONTEXT__) return;
  const documentId=crypto.randomUUID(), observations=new Map(), marks=new Map();
  let mode='off',pending=null,hovered=null,selectedRange=null,signal=null,pointer=null;
  const style=document.createElement('style');style.dataset.oiContextUi='';
  style.textContent='::highlight(oi-prepared-context){background:color-mix(in srgb, currentColor 12%, transparent);text-decoration:underline;}';
  (document.head||document.documentElement).append(style);
  const outline=document.createElement('div');outline.dataset.oiContextUi='';outline.setAttribute('aria-hidden','true');
  outline.style.cssText='position:fixed;pointer-events:none;z-index:2147483646;border:1px solid currentColor;display:none;box-sizing:border-box';
  const bubble=document.createElement('button');bubble.dataset.oiContextUi='';bubble.type='button';bubble.textContent='Add to context';bubble.setAttribute('aria-label','Add selected text to context');
  bubble.style.cssText='position:fixed;z-index:2147483647;display:none;padding:6px 10px;border:1px solid color-mix(in srgb,currentColor 30%,transparent);border-radius:5px;background:Canvas;color:CanvasText;font:12px system-ui;box-shadow:0 2px 10px #0002;cursor:pointer';
  const clearHover=()=>{hovered=null;outline.style.display='none';};
  const textOf=node=>(node.getAttribute('aria-label')||node.innerText||node.getAttribute('alt')||node.tagName.toLowerCase()).trim();
  const pathOf=node=>{const parts=[];while(node&&node.nodeType===1&&parts.length<8){const siblings=node.parentElement?[...node.parentElement.children].filter(el=>el.tagName===node.tagName):[];parts.unshift(node.tagName.toLowerCase()+(siblings.length>1?`:nth-of-type(${siblings.indexOf(node)+1})`:''));node=node.parentElement;}return parts.join(' > ');};
  const ui=node=>!!node?.closest?.('[data-oi-context-ui]');
  const currentRange=()=>{const s=getSelection();return s?.rangeCount===1&&!s.isCollapsed?s.getRangeAt(0):null;};
  const emit=value=>{pending=value;if(value)signal?.();};
  const observe=(node,range)=>{
    const text=range?range.toString():textOf(node);if(!text.trim())return null;
    const key=crypto.randomUUID(),box=(range||node).getBoundingClientRect();
    const error=text.length>65536?'This selection exceeds 65,536 characters. Select a smaller range; nothing was truncated.':undefined;
    const value={key,documentId,text:error?'':text,error,selector:pathOf(node),role:range?'text':node.getAttribute('role')||node.tagName.toLowerCase(),bounds:{x:box.x,y:box.y,width:box.width,height:box.height},pageUrl:location.href,nodeRef:node.closest('[data-source-ref],[data-node-ref],[data-entry-id],[data-fixture-id]')?.getAttribute('data-source-ref')||node.closest('[data-entry-id]')?.getAttribute('data-entry-id')||undefined};
    if(error)return value;
    observations.set(key,{node,range:range?.cloneRange(),text});
    if(observations.size>64){const oldest=observations.keys().next().value;observations.delete(oldest);marks.delete(oldest);}
    // A contiguous literal Markdown span can carry an exact source range.
    // Selections crossing formatting stay observations, never guessed ranges.
    if(range&&range.startContainer===range.endContainer&&range.startContainer.nodeType===3){const span=range.startContainer.parentElement;if(span?.hasAttribute('data-source-start')){const base=Number(span.dataset.sourceStart);if(Number.isSafeInteger(base)){value.sourceStart=base+range.startOffset;value.sourceEnd=base+range.endOffset;}}}
    return value;
  };
  const selected=()=>{const range=currentRange()||selectedRange;if(!range||!range.startContainer.isConnected||!range.endContainer.isConnected)return null;const node=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;return node&&!ui(node)?observe(node,range):null;};
  bubble.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();});
  bubble.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();emit(selected());bubble.style.display='none';});
  document.addEventListener('pointerdown',event=>{if(ui(event.target))return;pointer={x:event.clientX,y:event.clientY};},true);
  document.addEventListener('pointermove',event=>{if(mode!=='components'||ui(event.target))return;const node=event.composedPath().find(item=>item instanceof Element&&!ui(item)&&!['HTML','BODY','SCRIPT','STYLE','INPUT','TEXTAREA'].includes(item.tagName));if(!node){clearHover();return;}hovered=node;const box=node.getBoundingClientRect();if(!outline.isConnected)document.documentElement.append(outline);Object.assign(outline.style,{display:'block',left:`${box.x}px`,top:`${box.y}px`,width:`${box.width}px`,height:`${box.height}px`});},true);
  document.addEventListener('click',event=>{if(mode!=='components'||ui(event.target)||currentRange()||pointer&&Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>4)return;const node=hovered;if(!node)return;event.preventDefault();event.stopImmediatePropagation();emit(observe(node));clearHover();},true);
  document.addEventListener('selectionchange',()=>{const range=currentRange();if(!range){if(!ui(document.activeElement)){selectedRange=null;bubble.style.display='none';}return;}if(ui(range.commonAncestorContainer.parentElement))return;selectedRange=range.cloneRange();const box=range.getBoundingClientRect();if(!bubble.isConnected)document.documentElement.append(bubble);Object.assign(bubble.style,{display:'block',left:`${Math.max(4,Math.min(box.left,innerWidth-130))}px`,top:`${Math.max(4,Math.min(box.bottom+6,innerHeight-38))}px`});});
  document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.shiftKey&&event.code==='Digit2'){event.preventDefault();emit(selected());}if(event.key==='Escape'){bubble.style.display='none';clearHover();}});
  document.addEventListener('scroll',()=>{clearHover();bubble.style.display='none';},true);
  const api=window.__OI_PAGE_CONTEXT__={
    setSignal(callback){signal=callback;},
    mode(value){const scope=typeof value==='object'?value?.scope:value;if(value?.ink&&CSS.supports('color',value.ink))outline.style.color=value.ink;mode=scope==='components'?'components':'off';clearHover();return true;},
    take(){const value=pending;pending=null;return value;},
    selection:selected,
    validate(value){const key=typeof value==='string'?value:value?.key;if(typeof value==='object'&&value.documentId!==documentId)return false;const held=observations.get(key);return !!held?.node.isConnected&&(!held.range||(held.range.startContainer.isConnected&&held.range.endContainer.isConnected))&&(held.range?held.range.toString():textOf(held.node))===held.text;},
    mark(value){if(value?.documentId!==documentId)return false;const held=observations.get(value.key);if(!held||!api.validate(value))return false;if(value.enabled){const range=held.range?.cloneRange()||document.createRange();if(!held.range)range.selectNodeContents(held.node);marks.set(value.key,range);}else marks.delete(value.key);if(CSS.highlights&&typeof Highlight==='function')CSS.highlights.set('oi-prepared-context',new Highlight(...marks.values()));return true;}
  };
  window.addEventListener('message',event=>{if(parent===window||event.source!==parent||event.data?.type!=='oi:page-context-request')return;const {request,op,value}=event.data;if(typeof request!=='string'||request.length>128)return;let result=null;if(op==='mode')result=api.mode(value);if(op==='take')result=api.take();if(op==='selection')result=api.selection();if(op==='validate')result=api.validate(value);if(op==='mark')result=api.mark(value);parent.postMessage({type:'oi:page-context-response',request,result},'*');});
})();
