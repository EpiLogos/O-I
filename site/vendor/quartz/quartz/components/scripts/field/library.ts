/* ───────── library: the Expressions, as a view of the field ─────────
   The same navigation as the rest of the essay — tabs, tangents, the graph that follows — with the gallery's face: covers,
   collections, search, a grid or a column. Opening a card opens the Expression as a tab (the full renderer in a frame).
   "Here" narrows the gallery to the Expressions of the page you are on and of what the graph shows around it.            */
import { $, D, S, act, esc, exprOf, listen, loadExpressions, neighbours, shortTitle, sub, xCover, type XEntry, type XIndex } from "./core"

// the gallery's own state outlives a page turn
const L = { q: "", coll: "all", here: false, mode: "grid" as "grid" | "rows", top: 0 }

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
const NAMES: Record<string, string> = { essay: "The essay", rooms: "Section-rooms", symbolon: "Symbolon", arguments: "Arguments", matheme: "Matheme", mytheme: "Mytheme wholes", episteme: "Episteme", products: "The products" }
const DETAIL: Record<string, string> = {
  essay: "The sovereign reading path.",
  rooms: "Eight rooms, each its own Expression.",
  symbolon: "The relation itself, and its twelvefold spine.",
  arguments: "A01–A36 and their conjugates.",
  matheme: "Visionary operative logic, worked scene by scene.",
  mytheme: "Formed, lived operations: the worlds.",
  episteme: "Concepts, dossiers, etymologies, histories, lenses.",
  products: "The S0–S5 product field.",
}

/** Expressions about the page in view and about what the graph shows around it. */
function hereIds(): Set<string> {
  const ids = new Set<string>()
  const focus = S.cur?.i
  if (focus == null) return ids
  const near = [focus, ...neighbours(focus, false).all]
  for (const i of near) for (const id of exprOf(i)) ids.add(id)
  return ids
}
const pagesOf = (e: XEntry) => e.nodes.map((s) => D.bySlug.get(s)).filter(Boolean)

export function mountLibrary() {
  const pane = $("#library-pane"), scroller = $("#scroller")
  if (!pane || !scroller) return
  let index: XIndex | null = null

  function card(e: XEntry, here: Set<string>) {
    const pages = pagesOf(e), first = pages.slice(0, 2)
    const scenes = e.scenes.slice(0, 5)
    return `<article class="xcard${here.has(e.id) ? " is-here" : ""}" data-x="${esc(e.id)}">
      <button class="xcard__open" type="button" data-open="${esc(e.id)}" aria-label="Open ${esc(shortTitle(e.title))}">
        <span class="xcard__cover"><img src="${esc(xCover(e))}" alt="" loading="lazy" width="640" height="400"><span class="xcard__n">${String(e.scenes.length).padStart(2, "0")} Scenes</span>${here.has(e.id) ? '<span class="xcard__here">Here</span>' : ""}</span>
        <span class="xcard__copy"><strong>${esc(shortTitle(e.title))}</strong><span class="xcard__sub">${esc(e.summary)}</span></span>
      </button>
      ${L.mode === "rows" ? `<small class="xcard__where">${esc(e.group)}</small>` : ""}
      <div class="xcard__scenes" aria-label="Scenes">${scenes.map((s, k) => `<button type="button" class="xchip-s" data-open="${esc(e.id)}" data-scene="${esc(s.id)}" title="${esc(s.name)}"><span>${String(k).padStart(2, "0")}</span>${esc(s.name)}</button>`).join("")}${e.scenes.length > scenes.length ? `<button type="button" class="xchip-s xchip-s--more" data-open="${esc(e.id)}">+${e.scenes.length - scenes.length}</button>` : ""}</div>
      ${pages.length ? `<div class="xcard__pages"><span>On the page${pages.length > 1 ? "s" : ""}</span>${first.map((p: any) => `<a href="#" data-router-ignore="true" data-page="${p.i}">${esc(p.coord ? p.coord + " · " + p.lab : p.lab)}</a>`).join("")}${pages.length > 2 ? `<em>+${pages.length - 2}</em>` : ""}</div>` : ""}
    </article>`
  }

  function results() {
    if (!index) return ""
    const here = hereIds(), q = fold(L.q.trim())
    let list = index.entries
    if (L.coll !== "all") list = list.filter((e) => e.collection === L.coll)
    if (L.here) list = list.filter((e) => here.has(e.id))
    if (q) list = list.filter((e) => fold(e.title + " " + e.summary + " " + e.scenes.map((s) => s.name).join(" ") + " " + pagesOf(e).map((p: any) => p.lab).join(" ")).includes(q))
    const count = `<p class="xcount" role="status">${list.length} ${list.length === 1 ? "Expression" : "Expressions"}${q ? ` matching “${esc(L.q.trim())}”` : ""}${L.here ? " here" : ""}</p>`
    if (!list.length) return count + `<section class="xempty"><h2>${L.here ? "Nothing here has an Expression." : "No Expression matches."}</h2><p>${L.here ? "Move along the graph, or look at the whole collection." : "Try another phrase, or the whole collection."}</p><button type="button" data-clear>Show everything</button></section>`
    const groups = index.collections.filter((c) => list.some((e) => e.collection === c.id))
    return count + groups.map((g) => {
      const items = list.filter((e) => e.collection === g.id)
      return `<section class="xsection"><header><h2>${esc(NAMES[g.id] ?? g.label)}</h2><span>${esc(DETAIL[g.id] ?? "")}</span></header><div class="${L.mode === "grid" ? "xgrid" : "xrows"}">${items.map((e) => card(e, here)).join("")}</div></section>`
    }).join("")
  }
  function chips() {
    if (!index) return ""
    const here = hereIds(), hereN = index.entries.filter((e) => here.has(e.id)).length
    const all = index.entries.length
    return `<button type="button" data-coll="all" aria-pressed="${L.coll === "all" && !L.here}">All · ${all}</button>` +
      `<button type="button" data-here aria-pressed="${L.here}" ${hereN ? "" : "disabled"} title="Expressions about this page and what the graph shows around it">Here · ${hereN}</button>` +
      index.collections.map((c) => `<button type="button" data-coll="${c.id}" aria-pressed="${L.coll === c.id}">${esc(NAMES[c.id] ?? c.label)} · ${c.count}</button>`).join("")
  }

  function frame() {
    pane!.innerHTML = `<header class="xhead"><div><p class="eyebrow">O:I · THE PUBLISHED COLLECTION</p><h1>Expressions<span>.</span></h1><p>Enter the work. Follow its relations.<br>Turn to the source.</p></div></header>
      <div class="xtools"><label class="xsearch"><svg width="15" height="15" aria-hidden="true"><use href="#i-search"/></svg><input type="search" value="${esc(L.q)}" placeholder="Find an idea, a world, a scene" aria-label="Search the Expressions"></label>
      <div class="seg seg--sm" role="group" aria-label="Library view"><button type="button" data-mode="grid" aria-pressed="${L.mode === "grid"}">Gallery</button><button type="button" data-mode="rows" aria-pressed="${L.mode === "rows"}">Columns</button></div></div>
      <nav class="xcolls" aria-label="Collections">${chips()}</nav><div class="xresults">${index ? results() : '<p class="xcount" role="status">Opening the Library…</p>'}</div>`
  }
  const redraw = () => { const r = $(".xresults", pane), c = $(".xcolls", pane); if (r) r.innerHTML = results(); if (c) c.innerHTML = chips() }

  frame()
  loadExpressions().then((i) => {
    index = i
    if (!i) { pane.innerHTML = `<section class="xempty"><h2>The Library is not in this edition.</h2><p>This essay was published without its Expression layer.</p></section>`; return }
    frame()
    if (S.view === "library") scroller.scrollTop = L.top
  })

  let t: any
  listen(pane, "input", (e: Event) => { const el = e.target as HTMLInputElement; if (!el.matches(".xsearch input")) return; clearTimeout(t); t = setTimeout(() => { L.q = el.value; redraw() }, 90) })
  listen(pane, "click", (e: MouseEvent) => {
    const el = e.target as Element
    const open = el.closest("[data-open]") as HTMLElement | null
    if (open) { e.preventDefault(); act.openExpression(open.dataset.open!, open.dataset.scene || ""); return }
    const page = el.closest("[data-page]") as HTMLElement | null
    if (page) { e.preventDefault(); e.stopPropagation(); act.openTangent(+page.dataset.page!); return }
    const coll = el.closest("[data-coll]") as HTMLElement | null
    if (coll) { L.coll = coll.dataset.coll!; L.here = false; redraw(); return }
    if (el.closest("[data-here]")) { L.here = !L.here; if (L.here) L.coll = "all"; redraw(); return }
    const mode = el.closest("[data-mode]") as HTMLElement | null
    if (mode) { L.mode = mode.dataset.mode as any; pane.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String((b as HTMLElement).dataset.mode === L.mode))); redraw(); return }
    if (el.closest("[data-clear]")) { L.q = ""; L.coll = "all"; L.here = false; frame() }
  })
  // the gallery keeps its place, and its "Here" follows the reading
  listen(scroller, "scroll", () => { if (S.view === "library") L.top = scroller.scrollTop }, { passive: true })
  sub("locus", () => { if (index && S.view === "library") redraw(); else if (index) { const c = $(".xcolls", pane); if (c) c.innerHTML = chips() } })
  sub("view", () => { if (S.view === "library") { if (index) redraw(); requestAnimationFrame(() => { scroller.scrollTop = L.top }); if (!$(".xsearch input", pane)) frame() } })
}
