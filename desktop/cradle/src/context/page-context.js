/* Read-only page observations. No IPC, file access, or owner operations. */
(() => {
  if (window.__OI_PAGE_CONTEXT__) return;
  let mode = 'off', pending = null, hovered = null, selectedRange = null, signal = null;
  const observations = new Map();
  const style = document.createElement('style');
  style.textContent = '*{scrollbar-width:none!important}*::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}';
  const mount = () => { if (!style.isConnected) (document.head || document.documentElement)?.append(style); };
  mount(); document.addEventListener('DOMContentLoaded', mount, {once:true});
  const outline = document.createElement('div');
  outline.setAttribute('aria-hidden', 'true');
  outline.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:1px solid currentColor;background:transparent;box-sizing:border-box;display:none';
  const clear = () => { hovered = null; outline.style.display = 'none'; };
  const textOf = node => (node.getAttribute('aria-label') || node.innerText || node.getAttribute('alt') || node.tagName.toLowerCase()).trim().slice(0,12000);
  const pathOf = node => {
    const parts = [];
    while (node && node.nodeType === 1 && parts.length < 8) {
      const siblings = node.parentElement ? [...node.parentElement.children].filter(el => el.tagName === node.tagName) : [];
      parts.unshift(node.tagName.toLowerCase() + (siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(node)+1})` : ''));
      node = node.parentElement;
    }
    return parts.join(' > ');
  };
  const observe = (node, range) => {
    const text = range ? range.toString().slice(0,12000) : textOf(node);
    if (!text.trim()) return null;
    const key = crypto.randomUUID(), box = (range || node).getBoundingClientRect();
    observations.set(key,{node,range:range?.cloneRange(),text});
    if(observations.size>32)observations.delete(observations.keys().next().value);
    return {key,text,selector:pathOf(node),role:range?'text':node.getAttribute('role')||node.tagName.toLowerCase(),bounds:{x:box.x,y:box.y,width:box.width,height:box.height},pageUrl:location.href};
  };
  document.addEventListener('pointermove', event => {
    if(mode!=='components')return;
    const node=event.composedPath().find(item=>item instanceof Element && item!==outline && !['HTML','BODY','SCRIPT','STYLE','INPUT','TEXTAREA'].includes(item.tagName));
    if(!node){clear();return;}
    hovered=node;const box=node.getBoundingClientRect();
    if(!outline.isConnected)document.documentElement.append(outline);
    Object.assign(outline.style,{display:'block',left:`${box.x}px`,top:`${box.y}px`,width:`${box.width}px`,height:`${box.height}px`});
  },true);
  document.addEventListener('click',event=>{
    if(mode==='off')return;
    event.preventDefault();event.stopImmediatePropagation();
    if(mode==='components'){const node=hovered||event.composedPath().find(item=>item instanceof Element&&!['HTML','BODY','SCRIPT','STYLE','INPUT','TEXTAREA'].includes(item.tagName));if(node){pending=observe(node);clear();if(pending)signal?.();}}
  },true);
  document.addEventListener('selectionchange',()=>{
    const selection=getSelection();
    if(selection?.rangeCount&&!selection.isCollapsed)selectedRange=selection.getRangeAt(0).cloneRange();
  });
  document.addEventListener('scroll',clear,true);
  document.addEventListener('pointerleave',clear,true);
  const api = window.__OI_PAGE_CONTEXT__ = {
    setSignal(callback){signal=callback;},
    mode(value){const scope=typeof value==='object'?value?.scope:value;if(value?.ink&&CSS.supports('color',value.ink)){outline.style.borderColor=value.ink;outline.style.backgroundColor=`color-mix(in srgb, ${value.ink} 6%, transparent)`;}mode=['text','components'].includes(scope)?scope:'off';clear();pending=null;return true;},
    take(){const value=pending;pending=null;return value;},
    selection(){const selection=getSelection();const range=selection?.rangeCount&&!selection.isCollapsed?selection.getRangeAt(0):selectedRange;if(mode==='off'||!range)return null;const node=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;return node?observe(node,range):null;},
    validate(key){const value=observations.get(key);return !!value?.node.isConnected&&(value.range?value.range.toString().slice(0,12000):textOf(value.node))===value.text;}
  };
  // Opaque material frames speak only to their own parent. Their observations
  // remain untrusted page data and are reviewed before entering an owner draft.
  window.addEventListener('message',event=>{
    if(parent===window||event.source!==parent||event.data?.type!=='oi:page-context-request')return;
    const {request,op,value}=event.data;if(typeof request!=='string')return;
    let result=null;
    if(op==='mode')result=api.mode(value);
    if(op==='take')result=api.take();
    if(op==='selection')result=api.selection();
    if(op==='validate')result=api.validate(value);
    parent.postMessage({type:'oi:page-context-response',request,result},'*');
  });
})();
