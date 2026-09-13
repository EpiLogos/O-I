/** Beings / Things reference carriers. O-I#279 PW1, not a person/Wiki store.
 * The HTML can be authored source. Native source revision and document revision
 * are distinct. No provider, model, network, filesystem or publication effects.
 * v0.1 deliberately supports text/link pages; media, native edited-preview Save,
 * full roster extension discovery and public publication are later PW joins.
 */
export const PAGE_PROFILE = "oi.page/v1";
export const CATEGORIES = Object.freeze(["C1", "C2", "C3", "C4"]);
const escape = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const jsonText = value => JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = message => { throw new Error(`Beings/Things: ${message}`); };
const string = (value, path) => { if (typeof value !== "string") fail(`${path} must be text`); };
/** An actual locator, not an inferred semantic ref. No active/data/file URL. */
export function allowedLink(value) {
  if (typeof value !== "string" || !value || /[\u0000-\u0020\\]/.test(value) || value.startsWith("//")) return false;
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(value);
  return !scheme || /^(https?|mailto)$/i.test(scheme[1]);
}
export function validatePage(doc) {
  if (!record(doc) || doc.profile !== PAGE_PROFILE) fail("unsupported page profile; no lossy conversion performed");
  if (!record(doc.meta) || !["beings", "things"].includes(doc.meta.family)) fail("unsupported reference family");
  for (const key of ["title", "template", "templateVersion"]) string(doc.meta[key], `meta.${key}`);
  if (!Number.isSafeInteger(doc.meta.revision) || doc.meta.revision < 0) fail("invalid document revision");
  for (const key of ["documentId", "created"]) if (doc.meta[key] !== null && typeof doc.meta[key] !== "string") fail(`invalid ${key}`);
  if (!["authored", "derived"].includes(doc.meta.sourceMode)) fail("source standing is required");
  if (!record(doc.bindings) || !Array.isArray(doc.bindings.categories) || !doc.bindings.categories.length ||
      doc.bindings.categories.some(c => !CATEGORIES.includes(c)) || new Set(doc.bindings.categories).size !== doc.bindings.categories.length) fail("categories must name actual C1–C4 subject offices");
  for (const key of ["worldRef", "subjectRef", "expressionRef"]) if (doc.bindings[key] !== null && typeof doc.bindings[key] !== "string") fail(`invalid bindings.${key}`);
  if (!Array.isArray(doc.bindings.sources)) fail("source bases must be explicit");
  for (const source of doc.bindings.sources) { if (!record(source)) fail("invalid source basis"); string(source.ref, "source.ref"); string(source.revision, "source.revision"); }
  if (!record(doc.page)) fail("missing page body");
  string(doc.page.subtitle, "page.subtitle"); string(doc.page.introduction, "page.introduction");
  if (!Array.isArray(doc.page.sections) || !Array.isArray(doc.page.links)) fail("sections and links must be arrays");
  for (const [key, fields] of [["sections", ["id", "heading", "text"]], ["links", ["id", "label", "href", "relation"]]]) {
    const ids = new Set();
    for (const row of doc.page[key]) {
      if (!record(row)) fail(`invalid ${key} item`);
      for (const field of fields) string(row[field], `${key}.${field}`);
      if (!row.id || ids.has(row.id)) fail(`duplicate or empty ${key} identity`); ids.add(row.id);
      if (key === "links" && !allowedLink(row.href)) fail(`unsupported link locator: ${row.id}`);
    }
  }
  if (!record(doc.appearance) || !["portrait", "editorial"].includes(doc.appearance.layout) || !["paper", "ink"].includes(doc.appearance.tone)) fail("unsupported reference appearance; preserve custom source rather than silently translating it");
  return doc;
}
export function blankPage(family) {
  if (!["beings", "things"].includes(family)) fail("unknown reference family");
  return {profile:PAGE_PROFILE, meta:{documentId:null,created:null,title:"",revision:0,family,template:`oi.template/${family}`,templateVersion:"0.1.0",sourceMode:"authored"},
    bindings:{worldRef:null,subjectRef:null,categories:["C2"],expressionRef:null,sources:[]},
    appearance:{layout:family === "beings" ? "portrait" : "editorial",tone:"paper"},
    page:{subtitle:"",introduction:"",sections:[{id:"section-1",heading:"",text:""}],links:[]},notes:[],extensions:{}};
}
/** Reads JSON, not scraped prose. Unknown extension data is retained intact. */
export function readPage(html) {
  const matches = [...html.matchAll(/<script\b[^>]*\bid=["']ql-doc["'][^>]*>([\s\S]*?)<\/script\s*>/gi)];
  if (matches.length !== 1) fail("expected one embedded ql-doc state");
  try { return validatePage(JSON.parse(matches[0][1])); }
  catch (error) { fail(`invalid embedded state (${error.message})`); }
}
export function availableForms(roster) {
  if (!record(roster) || roster.profile !== "oi.html-form-roster/v1" || !Array.isArray(roster.forms)) fail("invalid form roster");
  const seen = new Set();
  return roster.forms.filter(form => {
    if (!record(form)) fail("invalid form descriptor");
    for (const field of ["kind", "label", "hint", "templateRef"]) string(form[field], `form.${field}`);
    if (!/^document-[a-z0-9-]+$/.test(form.kind) || seen.has(form.kind)) fail("duplicate or invalid form identity"); seen.add(form.kind);
    if (form.file === null) return false; // Declared scope is not available UI.
    if (typeof form.file !== "string" || !/^[a-z0-9][a-z0-9._-]*\.html$/i.test(form.file)) fail("form must name a file in the owner-resolved document directory");
    return true;
  });
}
/** Display-only temporal grouping. Explicit occurrence wins, then creation;
 * revisions never move a page to 'today'. No files, Day or NOW are created. */
export function pageDate(doc) {
  validatePage(doc);
  const date = doc.meta.occurredOn;
  if (date !== undefined) {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) !== date) fail("invalid declared occurrence date");
    return {date,basis:"occurrence"};
  }
  // Caller must supply civil creation date: never silently use UTC for a Day.
  if (doc.meta.createdOn !== undefined) { pageDate({...doc,meta:{...doc.meta,occurredOn:doc.meta.createdOn}}); return {date:doc.meta.createdOn,basis:"creation"}; }
  return null;
}
const CSS = `:root{--paper:#EFEFED;--field:#FAFAF8;--ink:#000;--mid:#6E6E6A;--faint:#A3A39E;--rule:#C9C9C4;--serif:Charter,"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;--sans:"Helvetica Neue",Helvetica,Arial,sans-serif;--w:1180px;--gap:28px}
*{box-sizing:border-box}html{background:var(--paper);color:var(--ink)}body{margin:0;font:18px/1.65 var(--serif)}body[data-tone=ink]{--paper:#20231f;--field:#282c26;--ink:#eeeee8;--mid:#b2b7aa;--faint:#8e9688;--rule:#555e50}a{color:inherit;text-underline-offset:4px}button,select{font:13px var(--sans);color:inherit;background:none;border:1px solid var(--rule);border-radius:2px;padding:7px 12px;cursor:pointer}button:hover{background:var(--field)}:focus-visible{outline:2px solid var(--ink);outline-offset:4px}[hidden]{display:none!important}.doc{max-width:var(--w);margin:auto;padding:0 clamp(22px,5vw,64px) 12vh}.bar{display:flex;justify-content:space-between;align-items:center;gap:24px;padding-top:28px;font:12px/1.5 var(--sans)}.brand{letter-spacing:.18em}.controls{display:flex;gap:8px;flex-wrap:wrap}.mast{padding:11vh 0 7vh;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:var(--gap);border-bottom:1px solid var(--rule)}.intro{grid-column:1/10;min-width:0}.eyebrow{font:12px/1.5 var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--mid);margin:0 0 24px}h1{font:400 clamp(42px,6vw,78px)/1.04 var(--serif);letter-spacing:-.025em;margin:0 0 26px;overflow-wrap:anywhere}.subtitle{font:italic clamp(20px,2.5vw,28px)/1.4 var(--serif);color:var(--mid);max-width:48ch}.opening{font:22px/1.65 var(--serif);white-space:pre-wrap;max-width:58ch;margin:28px 0 0}.mark{grid-column:10/13;align-self:start;width:100%;max-width:150px;fill:none;stroke:var(--ink);stroke-width:1}.mark circle:last-child{stroke-dasharray:1 4}.contents{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:var(--gap);padding-top:44px}.sections{grid-column:1/9;min-width:0}.section{display:grid;grid-template-columns:34px 1fr;gap:20px;padding:0 0 44px;margin-bottom:32px;border-bottom:1px solid var(--rule)}.ordinal{font:12px/1.8 var(--sans);color:var(--faint);padding-top:6px}h2{font:400 27px/1.25 var(--serif);margin:0 0 18px}.body{white-space:pre-wrap;overflow-wrap:anywhere;min-height:4em;margin:0}.rail{grid-column:10/13;font:14px/1.7 var(--sans);min-width:0}.rail h2{font:12px/1.5 var(--sans);letter-spacing:.12em;text-transform:uppercase}.relation{border-top:1px solid var(--rule);padding:14px 0}.relation small{display:block;color:var(--mid)}.relation a{overflow-wrap:anywhere}.empty{color:var(--faint);font-style:italic}.provenance{margin-top:36px}.provenance pre{font:11px/1.6 monospace;white-space:pre-wrap;overflow-wrap:anywhere}.footer{margin-top:40px;border-top:1px solid var(--rule);padding-top:18px;font:12px/1.6 var(--sans);color:var(--mid);display:flex;justify-content:space-between;gap:24px}.status{max-width:72ch}[data-field]:empty:before{content:attr(data-placeholder);color:var(--faint)}body[data-editing=true] [data-field]{outline:1px dashed var(--rule);outline-offset:7px}body[data-layout=editorial] .mark{grid-column:1/3;grid-row:1}body[data-layout=editorial] .intro{grid-column:3/13}body[data-layout=editorial] .sections{grid-column:3/10}body[data-layout=editorial] .rail{grid-column:11/13}[data-field]{min-height:1.2em}select option{color:#111;background:#EFEFED}
@media(max-width:720px){.bar{align-items:flex-start}.mast{padding-top:8vh}.intro,body[data-layout=editorial] .intro{grid-column:1/13}.mark,body[data-layout=editorial] .mark{display:none}.sections,body[data-layout=editorial] .sections,.rail,body[data-layout=editorial] .rail{grid-column:1/13}.opening{font-size:20px}.section{grid-template-columns:24px 1fr;gap:12px}.footer{display:block}.footer span{display:block}.controls{justify-content:flex-end}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}@media print{.controls,.author-tools,.footer button{display:none!important}.doc{padding:0}.mast{padding-top:32px}.section{break-inside:avoid}}`;
/** Self-contained reference runtime; no host bridge, network or storage. A full
 * copy preserves unknown payload and custom shell. This is NOT redaction. */
function pageRuntime() {
  const stateNode=document.getElementById("ql-doc"); let doc;
  const status=document.getElementById("page-status");
  try {doc=JSON.parse(stateNode.textContent);} catch {status.textContent="The page data could not be read. Original content is retained.";return;}
  let dirty=false, editing=false;
  const serial=value=>JSON.stringify(value).replace(/</g,"\\u003c");
  const changed=()=>{dirty=true;doc.meta.revision+=1;stateNode.textContent=serial(doc);status.textContent="Changes are in this page only. Save an HTML copy to keep them; native source Save is separate.";};
  const fields=()=>document.querySelectorAll("[data-field]");
  const mode=()=>{document.body.dataset.editing=String(editing);fields().forEach(el=>el.setAttribute("contenteditable",editing?"plaintext-only":"false"));document.getElementById("edit-page").textContent=editing?"Read":"Edit";document.getElementById("edit-page").setAttribute("aria-pressed",String(editing));document.querySelectorAll(".author-tools").forEach(el=>el.hidden=!editing);};
  document.getElementById("edit-page").addEventListener("click",()=>{editing=!editing;mode();});
  document.addEventListener("input",event=>{const el=event.target.closest("[data-field]");if(!el||!editing)return;const key=el.dataset.field;const text=el.innerText.replace(/\r\n/g,"\n");if(el.dataset.section){const section=doc.page.sections.find(s=>s.id===el.dataset.section);if(section&&section[key]!==text){section[key]=text;changed();}}else{const target=key==="title"?doc.meta:doc.page;if(target[key]!==text){target[key]=text;changed();}}});
  for(const key of ["layout","tone"]){const select=document.getElementById(`page-${key}`);select.value=doc.appearance[key];select.addEventListener("change",()=>{doc.appearance[key]=select.value;document.body.dataset[key]=select.value;changed();});}
  document.getElementById("add-section").addEventListener("click",()=>{let n=doc.page.sections.length+1;while(doc.page.sections.some(s=>s.id===`section-${n}`))n++;const section={id:`section-${n}`,heading:"",text:""};doc.page.sections.push(section);const article=document.createElement("article");article.className="section";const ordinal=document.createElement("span");ordinal.className="ordinal";ordinal.textContent=String(n).padStart(2,"0");article.append(ordinal);const body=document.createElement("div");for(const [tag,key,label] of [["h2","heading","Section title"],["p","text","Write here…"]]){const el=document.createElement(tag);el.dataset.field=key;el.dataset.section=section.id;el.dataset.placeholder=label;if(key==="text")el.className="body";body.append(el);}article.append(body);document.getElementById("page-sections").append(article);changed();mode();body.querySelector("h2").focus();});
  const save=()=>{
    try {
      const next=JSON.parse(JSON.stringify(doc));
      if(!next.meta.documentId){if(!globalThis.crypto?.getRandomValues)throw new Error("This browser cannot create a document identity here");const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");next.meta.documentId=[hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join("-");next.meta.created=new Date().toISOString();}
      const clone=document.documentElement.cloneNode(true);clone.querySelector("#ql-doc").textContent=serial(next);
      clone.querySelector("title").textContent=next.meta.title||next.meta.family;
      clone.querySelector("body").dataset.editing="false";clone.querySelectorAll("[contenteditable]").forEach(el=>el.setAttribute("contenteditable","false"));clone.querySelectorAll(".author-tools").forEach(el=>el.hidden=true);clone.querySelector("#edit-page").textContent="Edit";clone.querySelector("#edit-page").setAttribute("aria-pressed","false");clone.querySelector("#page-status").textContent="Portable document. Editing does not save back to its source automatically.";
      const blob=new Blob(["<!doctype html>\n"+clone.outerHTML],{type:"text/html;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`${next.meta.family}-${next.meta.documentId}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);doc=next;stateNode.textContent=serial(doc);dirty=false;status.textContent="HTML copy prepared. It includes the complete embedded data; this is not filtered publication or native source Save.";
    }catch(error){status.textContent=`HTML copy could not be prepared: ${error.message}`;}
  };
  document.getElementById("save-copy").addEventListener("click",save);
  document.addEventListener("keydown",event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="s"){event.preventDefault();save();}});
  window.addEventListener("beforeunload",event=>{if(dirty){event.preventDefault();event.returnValue="";}});
  mode();
}
export function renderPage(doc) {
  validatePage(doc);
  const family=doc.meta.family === "beings"?"Beings":"Things";
  const sections=doc.page.sections.map((s,i)=>`<article class="section"><span class="ordinal">${String(i+1).padStart(2,"0")}</span><div><h2 data-field="heading" data-section="${escape(s.id)}" data-placeholder="Section title">${escape(s.heading)}</h2><p class="body" data-field="text" data-section="${escape(s.id)}" data-placeholder="Write here…">${escape(s.text)}</p></div></article>`).join("");
  const links=doc.page.links.map(link=>`<div class="relation" data-link-id="${escape(link.id)}"><small>${escape(link.relation)}</small><a href="${escape(link.href)}" rel="noopener noreferrer">${escape(link.label)}</a></div>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="ql-template" content="${escape(doc.meta.template)} ${escape(doc.meta.templateVersion)}"><title>${escape(doc.meta.title||family)}</title><style id="oi-page-style">${CSS}</style></head>
<body data-layout="${doc.appearance.layout}" data-tone="${doc.appearance.tone}" data-editing="false"><div class="doc">
<header class="bar"><span class="brand">O:I / ${family}</span><nav class="controls" aria-label="Page controls"><button id="edit-page" aria-pressed="false">Edit</button><button id="save-copy">Save HTML copy</button></nav></header>
<main><header class="mast"><div class="intro"><p class="eyebrow">${family === "Beings"?"A presence and its world":"A subject and its relations"}</p><h1 data-field="title" data-placeholder="${family === "Beings"?"An opening into a world.":"Give a thing its place."}">${escape(doc.meta.title)}</h1><p class="subtitle" data-field="subtitle" data-placeholder="A line of introduction.">${escape(doc.page.subtitle)}</p><p class="opening" data-field="introduction" data-placeholder="Begin with what matters here.">${escape(doc.page.introduction)}</p></div><svg class="mark" viewBox="0 0 120 120" aria-hidden="true"><circle cx="47" cy="60" r="35"/><circle cx="73" cy="60" r="35"/></svg></header>
<div class="contents"><section id="page-sections" class="sections" aria-label="Page content">${sections}</section><aside class="rail"><h2>In relation</h2>${links||'<p class="empty">Links to the wider world can live here.</p>'}<details class="provenance"><summary>Source &amp; form</summary><pre>${escape(JSON.stringify({template:doc.meta.template,sourceMode:doc.meta.sourceMode,...doc.bindings},null,2))}</pre></details><div class="author-tools" hidden><p><label>Composition <select id="page-layout"><option value="portrait">Portrait</option><option value="editorial">Editorial</option></select></label></p><p><label>Ground <select id="page-tone"><option value="paper">Paper</option><option value="ink">Ink</option></select></label></p><button id="add-section">Add section</button></div></aside></div></main>
<footer class="footer"><span class="status" id="page-status" role="status">Portable document. Editing does not save back to its source automatically.</span><span>${family} / 0.1</span></footer><noscript>This page remains readable. Editing and HTML-copy export require JavaScript; native source editing remains separate.</noscript></div>
<script type="application/json" id="ql-doc">${jsonText(doc)}</script><script>(${pageRuntime.toString()})();</script></body></html>\n`;
}
