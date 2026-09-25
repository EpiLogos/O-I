/* Document host bridge — page side. Reads the payload island the page
 * itself maintains; no native IPC, no authority, no writes. The host asks;
 * this only answers about the document the page already holds in its own
 * data island (DOCUMENT-SURFACE.md). */
(() => {
  if (window.__OI_DOCUMENT_HOST__) return;
  const ISLANDS = { "ql-doc": "ql-doc", "mockup-provenance": "mockup-provenance" };
  const read = () => {
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
  window.addEventListener("message", event => {
    if (parent === window || event.source !== parent || event.data?.type !== "oi:document-host-request") return;
    const { request, op } = event.data;
    if (typeof request !== "string" || request.length > 128 || op !== "read") return;
    parent.postMessage({ type: "oi:document-host-response", request, result: read() }, "*");
  });
})();
