/* Document host bridge — page side. Reads the payload island the page
 * itself maintains; no native IPC, no authority, no writes. The host asks;
 * this only answers about the document the page already holds in its own
 * data island (DOCUMENT-SURFACE.md). */
(() => {
  if (window.__OI_DOCUMENT_HOST__) return;
  const ISLANDS = { "ql-doc": "ql-doc", "mockup-provenance": "mockup-provenance" };
  const read = () => {
    if(typeof window.__OI_DOCUMENT_PAYLOAD_READ__==='function'){
      try{
        const doc=window.__OI_DOCUMENT_PAYLOAD_READ__(),text=JSON.stringify(doc),meta=doc?.meta;
        if(doc&&typeof doc==='object'&&!Array.isArray(doc)&&typeof text==='string')return {present:true,payload:'ql-doc',text,documentId:typeof meta?.documentId==='string'?meta.documentId:typeof meta?.uuid==='string'?meta.uuid:null,revision:Number.isSafeInteger(meta?.revision)?meta.revision:null,valid:true};
      }catch{return {present:true,payload:'ql-doc',text:null,documentId:null,revision:null,valid:false};}
    }
    for (const payload of Object.keys(ISLANDS)) {
      const node = document.getElementById(ISLANDS[payload]);
      if (!node) continue;
      let doc = null, revision = null, documentId = null;
      try {
        doc = JSON.parse(node.textContent);
        const meta = doc && typeof doc === "object" && !Array.isArray(doc) ? doc.meta : null;
        if (meta && typeof meta === "object") {
          if (Number.isSafeInteger(meta.revision)) revision = meta.revision;
          if (typeof meta.documentId === "string") documentId = meta.documentId;
          if (typeof meta.uuid === "string") documentId = documentId ?? meta.uuid;
        }
      } catch { doc = null; }
      return { present: true, payload, text: node.textContent, documentId, revision, valid: !!doc };
    }
    const role = document.body?.getAttribute?.("data-doc-role");
    if (role === "mockup") return { present: false, payload: "none", text: null, documentId: null, revision: null, valid: false, docRole: role };
    return { present: false, payload: "none", text: null, documentId: null, revision: null, valid: false };
  };
  window.__OI_DOCUMENT_HOST__ = { read };
  // Read-only change disclosure: the document still owns its payload. No
  // native operation, write, or new domain state is exposed to this frame.
  let last;
  const disclose = () => {
    if(parent === window)return;
    const result=read(),signature=JSON.stringify(result);
    if(signature===last)return;last=signature;
    parent.postMessage({type:'oi:document-host-changed',result},'*');
  };
  const observe=()=>{
    const observer=new MutationObserver(disclose);
    observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
    disclose();
  };
  if(typeof MutationObserver==='function'&&document.documentElement){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
  }
  window.addEventListener("message", event => {
    if (parent === window || event.source !== parent || event.data?.type !== "oi:document-host-request") return;
    const { request, op } = event.data;
    if (typeof request !== "string" || request.length > 128 || op !== "read") return;
    parent.postMessage({ type: "oi:document-host-response", request, result: read() }, "*");
  });
})();
