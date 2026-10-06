/* ───────── tabs: page-over-page ─────────
   The first tab is the page the address bar names; it stays exactly where you left it. Anything you follow from
   the field or from the text opens as a *tangent* in a preview tab — italic, replaced by the next tangent, kept by
   double-clicking its tab. Inside a tangent, following something replaces it in place. The explorer, the pager and
   the breadcrumbs turn the main page itself (a real navigation: the address changes).

   An Expression is a tab too: the full renderer (the shell's expression.html) in a frame, in the same pane, so it
   is opened, kept, closed and returned from exactly like a page. The Library view swaps the pane for the gallery.  */
import { $, D, S, act, emit, esc, expressionUrl, isManuscript, listen, loadExpressions, markVisited, mountCleanup, pad, session, shortTitle, sub, urlFor, view, currentNode, type XEntry } from "./core"

interface Tab { id: number; i: number; m: number | null; h: string | null; top: number | null; preview: boolean; main: boolean; x?: string; scene?: string }
const T: { list: Tab[]; active: number; uid: number } = { list: [], active: 0, uid: 1 }
const html = new Map<number, Promise<string | null>>()   // tangent bodies, by page

const curTab = () => T.list[T.active]
const mkTab = (i: number, o: Partial<Tab> = {}): Tab => {
  const n = D.nodes[i]
  return { id: T.uid++, i, m: o.m ?? (n.k === "movement" ? n.m : null), h: o.h ?? null, top: null, preview: !!o.preview, main: !!o.main }
}
const persist = () => session.set("tabs", T.list.filter((t) => !t.main && !t.x).map((t) => ({ s: D.nodes[t.i].s, preview: t.preview })))

/** A page body for a tangent: the same server-rendered pane the page itself has, with its links made absolute. */
function fetchBody(i: number): Promise<string | null> {
  let p = html.get(i)
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(urlFor(D.nodes[i].s))
        if (!res.ok) return null
        const doc = new DOMParser().parseFromString(await res.text(), "text/html")
        const pane = doc.querySelector("#essay-pane")
        if (!pane) return null
        const base = res.url
        for (const a of pane.querySelectorAll("a[href]")) { const h = a.getAttribute("href")!; if (!/^[a-z][a-z0-9+.-]*:/i.test(h) && !h.startsWith("#")) a.setAttribute("href", new URL(h, base).href) }
        for (const a of pane.querySelectorAll("a[href^='#']")) a.setAttribute("href", new URL(a.getAttribute("href")!, base).href)
        for (const e of pane.querySelectorAll("img[src],source[src],video[src]")) e.setAttribute("src", new URL(e.getAttribute("src")!, base).href)
        return pane.innerHTML
      } catch { return null }
    })()
    html.set(i, p)
  }
  return p
}

export function mountTabs() {
  const scroller = $("#scroller")!, essay = $("#essay-pane")!, tangent = $("#tangent-pane")!, library = $("#library-pane")!, tabsEl = $("#tabs")!
  const nav: any = (window as any).spaNavigate

  // the first tab is this page; restore tangents kept for the session
  const node = currentNode()
  if (!node) return
  const main = mkTab(node.i, { main: true })
  const mParam = new URLSearchParams(location.search).get("m")
  if (mParam && isManuscript(node)) main.m = +mParam
  if (location.hash) main.h = decodeURIComponent(location.hash.slice(1))
  if (!T.list.length) {
    T.list = [main]
    for (const s of session.get<{ s: string; preview: boolean }[]>("tabs", [])) { const x = D.bySlug.get(s.s); if (x && x.i !== node.i) T.list.push(mkTab(x.i, { preview: s.preview })) }
  } else {
    // navigated to another page: that page becomes the first tab; tangents stay
    const keep = T.list.slice(1).filter((t) => t.i !== node.i)
    T.list = [main, ...keep]
  }
  T.active = 0
  const first = { ...main }

  /** What the centre shows: the page, a tangent, an Expression — or, in the Library view, the gallery. */
  function applyPanes() {
    const t = curTab(), lib = S.view === "library"
    library.hidden = !lib
    essay.hidden = lib || !t.main
    tangent.hidden = lib || t.main
    view.pane = t.main ? essay : tangent
    scroller.classList.toggle("has-x", !lib && !!t.x)
  }
  async function activate(idx: number, { fresh = false } = {}) {
    const old = curTab()
    if (old && scroller.clientHeight && S.view !== "library") old.top = scroller.scrollTop
    T.active = idx
    const t = curTab(), n = D.nodes[t.i]
    if (!t.main && t.x) {
      const index = await loadExpressions(), e = index?.byId.get(t.x)
      if (curTab() !== t) return
      tangent.classList.add("is-expression")
      tangent.innerHTML = e ? `<iframe class="xframe" data-x="${esc(t.x)}" title="${esc(e.title)}" src="${esc(expressionUrl(t.x, t.scene, true))}" allow="fullscreen" loading="eager"></iframe>` : `<p class="stubnote">This Expression is not in the published collection.</p>`
      ;(view as any).x = e ? { id: t.x, scene: t.scene ?? e.scenes[0]?.id, entry: e } : null
    } else {
      tangent.classList.remove("is-expression")
      ;(view as any).x = null
      // leaving an Expression stops it: a frame left running in a hidden pane would keep drawing
      if (t.main && tangent.querySelector("iframe")) tangent.innerHTML = ""
      if (!t.main) {
        const body = await fetchBody(t.i)
        if (curTab() !== t) return                      // the reader moved on while this loaded
        tangent.innerHTML = body ?? `<p class="stubnote">This page could not be loaded.</p>`
      }
    }
    applyPanes()
    view.node = t.x ? null : n
    S.cur = { i: t.i, m: t.m, h: t.h }
    markVisited(n.i)
    try { document.title = `${t.x ? shortTitle((view as any).x?.entry?.title ?? n.lab) : n.lab} — ${document.title.split(" — ").pop()}` } catch { /* ignore */ }
    emit("locus", { ...S.cur, top: fresh ? null : t.top, fresh })
    renderTabs()
    persist()
    if (matchMedia("(max-width: 1099px)").matches) emit("drawer", { open: false })
  }

  function openTangent(i: number, { m = null, h = null }: { m?: number | null; h?: string | null } = {}) {
    if (D.nodes[i] == null) return
    leaveLibrary()
    const act_ = curTab()
    const at = T.list.findIndex((t) => !t.x && t.i === i)
    if (at >= 0) {                                    // already open somewhere: go there
      const t = T.list[at]
      if (m != null || h != null) { t.m = m ?? t.m; t.h = h; t.top = null }
      else if (at === T.active) { applyPanes(); return }
      activate(at, { fresh: m != null || h != null }); return
    }
    place(mkTab(i, { m, h, preview: true }), act_)
  }
  /** A new preview tab takes the place of the standing preview of its own kind: one slot for a page, one for an Expression,
   *  so following a page out of an Expression opens it beside, and the Expression stays. */
  function place(tab: Tab, act_: Tab | undefined) {
    const same = (t: Tab | undefined) => !!t && t.preview && !!t.x === !!tab.x
    if (act_ && same(act_)) { Object.assign(act_, tab, { id: act_.id }); activate(T.active, { fresh: true }); return }
    const prev = T.list.findIndex(same)
    if (prev >= 0) { T.list[prev] = tab; activate(prev, { fresh: true }) }
    else { T.list.push(tab); activate(T.list.length - 1, { fresh: true }) }
  }
  async function openExpression(id: string, scene = "") {
    const index = await loadExpressions(), e = index?.byId.get(id)
    if (!e) return
    leaveLibrary()
    const at = T.list.findIndex((t) => t.x === id)
    if (at >= 0) { const t = T.list[at]; if (scene) t.scene = scene; activate(at, { fresh: !!scene }); return }
    // an Expression is about pages; the graph follows the first of them (or the page you were reading)
    const mapped = e.nodes.map((slug) => D.bySlug.get(slug)).find(Boolean)
    const tab = mkTab(mapped?.i ?? T.list[0].i, { preview: true })
    tab.x = id; tab.scene = scene || e.scenes[0]?.id; tab.m = null
    place(tab, curTab())
  }
  /** Opening something from the gallery leaves the gallery: the centre is the thing opened. */
  function leaveLibrary() { if (S.view === "library") act.setView("essay") }
  function openMain(i: number, { m = null, h = null }: { m?: number | null; h?: string | null } = {}) {
    const n = D.nodes[i]; if (!n) return
    leaveLibrary()
    const same = currentNode()?.i === i
    if (same) { T.list[0].m = m ?? T.list[0].m; T.list[0].h = h; activate(0, { fresh: true }); return }
    const url = urlFor(n.s, h ? "#" + encodeURIComponent(h) : "")
    if (m && isManuscript(n)) url.search = "?m=" + m
    nav ? nav(url) : location.assign(url)
  }
  function closeTab(idx: number) {
    const t = T.list[idx]; if (!t || t.main) return
    T.list.splice(idx, 1)
    activate(Math.min(Math.max(0, idx - 1), T.list.length - 1))
  }
  /** Make a tangent the main page: a real navigation, with the tangent tab retired. An Expression opens whole, in its own page. */
  function promote(idx: number) {
    const t = T.list[idx]; if (!t || t.main) return
    if (t.x) { window.open(expressionUrl(t.x, t.scene), "_blank", "noopener"); return }
    T.list.splice(idx, 1)
    openMain(t.i, { m: t.m, h: t.h })
  }
  act.openTangent = openTangent
  act.openMain = openMain
  act.openExpression = openExpression

  function renderTabs() {
    const idx = (window as any).__oiXIndex as Map<string, XEntry> | undefined
    tabsEl.innerHTML = T.list.map((t, k) => {
      const n = D.nodes[t.i], on_ = k === T.active
      const e = t.x ? idx?.get(t.x) : null
      const pos = !t.x && (isManuscript(n) || n.k === "movement") && t.m ? `<span class="tab__pos">M${pad(t.m)}</span>` : ""
      const label = t.x ? shortTitle(e?.title ?? t.x) : t.main ? n.lab : (n.coord ? n.coord + " · " : "") + n.lab
      const mark = t.x ? `<svg class="tab__xi" width="12" height="12" aria-hidden="true"><use href="#i-expression"/></svg>` : `<i class="dot"></i>`
      const title = t.x ? `Expression — ${e?.title ?? t.x}` : n.t
      return `<div class="tab${t.preview ? " tab--preview" : ""}${t.main ? " tab--main" : ""}${t.x ? " tab--x" : ""}" role="tab" tabindex="0" aria-selected="${on_}" data-k="${k}" title="${esc(title)}${t.preview ? " — preview (double-click to keep)" : ""}" style="--rc:${t.x ? "var(--gold)" : `var(--c-${n.r})`}">${mark}<span class="tab__t">${esc(label)}</span>${pos}${t.main ? "" : `<button class="tab__x tab__up" type="button" data-promote="${k}" aria-label="Open ${esc(label)} as ${t.x ? "its own page" : "the main page"}" title="${t.x ? "Open the Expression on its own page" : "Open as the main page"}"><svg width="11" height="11" aria-hidden="true"><use href="#i-external"/></svg></button><button class="tab__x" type="button" data-close="${k}" aria-label="Close ${esc(label)}"><svg width="10" height="10" aria-hidden="true"><use href="#i-x"/></svg></button>`}</div>`
    }).join("")
    $(".tab[aria-selected='true']", tabsEl)?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }
  loadExpressions().then((index) => { if (index) { (window as any).__oiXIndex = new Map(index.entries.map((e) => [e.id, e])); renderTabs() } })
  listen(tabsEl, "click", (e) => {
    const t = e.target as Element
    const x = t.closest("[data-close]") as HTMLElement | null; if (x) { e.stopPropagation(); closeTab(+x.dataset.close!); return }
    const up = t.closest("[data-promote]") as HTMLElement | null; if (up) { e.stopPropagation(); promote(+up.dataset.promote!); return }
    const tab = t.closest(".tab") as HTMLElement | null
    if (tab) { if (+tab.dataset.k! !== T.active || S.view === "library") { leaveLibrary(); activate(+tab.dataset.k!) } }
  })
  listen(tabsEl, "keydown", (e: KeyboardEvent) => { const tab = (e.target as Element).closest?.(".tab") as HTMLElement | null; if (tab && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); leaveLibrary(); activate(+tab.dataset.k!) } })
  listen(tabsEl, "dblclick", (e) => { const tab = (e.target as Element).closest(".tab") as HTMLElement | null; if (!tab) return; const t = T.list[+tab.dataset.k!]; if (t.preview) { t.preview = false; renderTabs(); persist() } })
  listen(tabsEl, "auxclick", (e: MouseEvent) => { const tab = (e.target as Element).closest(".tab") as HTMLElement | null; if (tab && e.button === 1) closeTab(+tab.dataset.k!) })
  listen(scroller, "scroll", () => { const t = curTab(); if (t && scroller.clientHeight && S.view !== "library") t.top = scroller.scrollTop }, { passive: true })

  // the Library view swaps the centre for the gallery; coming back puts the reader where it was
  let lastView = S.view
  sub("view", () => {
    applyPanes()
    if (lastView === "library" && S.view !== "library") {
      const t = curTab()
      requestAnimationFrame(() => emit("restore", { top: t.top }))
    }
    lastView = S.view
  })

  // frames speak to the page: an Expression asking to open an essay page, or to be re-themed
  listen(window, "message", (e: MessageEvent) => {
    if (e.origin !== location.origin || !e.data || typeof e.data !== "object") return
    if (e.data.type === "oi-open" && typeof e.data.slug === "string") { const n = D.bySlug.get(e.data.slug); if (n) openTangent(n.i) }
  })
  const retheme = () => {
    const theme = document.documentElement.getAttribute("saved-theme")
    for (const f of document.querySelectorAll<HTMLIFrameElement>("iframe.xframe")) f.contentWindow?.postMessage({ type: "oi-theme", theme }, location.origin)
  }
  listen(document, "themechange", retheme)

  // the reading position of the active tab, for the tab label and the address bar (?m=)
  let urlTimer: any
  sub("position", ({ m }) => {
    const t = curTab()
    if (t && !t.x && (isManuscript(D.nodes[t.i]) || D.nodes[t.i].k === "movement")) { t.m = m; renderTabs() }
    clearTimeout(urlTimer)
    if (t?.main && isManuscript(D.nodes[t.i]) && m) urlTimer = setTimeout(() => { try { const u = new URL(location.href); u.searchParams.set("m", String(m)); history.replaceState(history.state, "", u) } catch { /* ignore */ } }, 300)
  })
  mountCleanup(() => clearTimeout(urlTimer))

  // tangents carried over the navigation get their tabs back; the first tab is this page
  renderTabs()
  applyPanes()
  view.node = node
  S.cur = { i: first.i, m: first.m, h: first.h }
  markVisited(node.i)
  emit("locus", { ...S.cur, top: null, fresh: true })
  persist()
  ;(window as any).OI = Object.assign((window as any).OI ?? {}, { T, openTangent, openMain, openExpression, closeTab, activate })
}
