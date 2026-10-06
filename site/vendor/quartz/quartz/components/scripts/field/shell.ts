/* ───────── layout modes, breadcrumbs, theme, keys ───────── */
import { $, $$, D, S, act, emit, esc, listen, mountCleanup, observe, pad, pathOf, readsAsMovement, store, sub, urlFor } from "./core"

const narrow = matchMedia("(max-width: 1099px)")
const narrowPhone = matchMedia("(max-width: 759px)")
let pop: HTMLElement | null = null
const firstLeaf = (f: any): number | null => { for (const c of f.children) { if (c.kind === "leaf") return c.ni; const x = firstLeaf(c); if (x != null) return x } return null }

export function mountShell() {
  const app = $("#quartz-root")!
  const params = new URLSearchParams(location.search)

  /* One reading view, one resizable field panel, and the Library as a visit. (Essay/Split/Field were three widths of the
     same two panels; the panel's own drag handle is that now. "field" remains only as the phone's full-screen panel.) */
  let before = "essay"
  function setView(v: string, persist = true) {
    if (v === "split" || (v === "field" && !narrowPhone.matches)) v = "essay"
    if (v === "library" && S.view !== "library") before = S.view || "essay"
    S.view = v; app.dataset.view = v
    $$("button[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v)))
    if (v !== "essay" && app.dataset.right === "closed") app.removeAttribute("data-right")
    if (persist && v !== "library") store.set("view", v)   // the gallery is a visit, not a way of reading
    emit("view", { v })
  }
  act.setView = setView
  const setLeft = (open: boolean) => { app.dataset.left = open ? "open" : "closed"; store.set("left", open); emit("view", {}) }
  const setRight = (open: boolean) => { if (open) app.removeAttribute("data-right"); else app.dataset.right = "closed"; store.set("right", open); emit("view", {}) }
  const setDrawer = (open: boolean) => { app.dataset.drawer = open ? "open" : "closed"; $$('[data-act="browse-drawer"]').forEach((b) => b.setAttribute("aria-pressed", String(open))) }
  const focusSearch = () => { if (narrow.matches) setDrawer(true); else if (app.dataset.left === "closed") setLeft(true); setTimeout(() => act.focusSearch(), 30) }
  const setTheme = (t: string) => {
    document.documentElement.setAttribute("saved-theme", t)
    try { localStorage.setItem("theme", t) } catch { /* ignore */ }
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: t } }))
  }

  // panel state that outlives a page turn
  setView(params.get("view") || store.get("view", "essay"), false)
  if (!narrow.matches && (params.get("left") === "closed" || store.get<boolean>("left", true) === false)) app.dataset.left = "closed"
  if (!narrow.matches && store.get<boolean>("right", true) === false && S.view === "essay") app.dataset.right = "closed"
  if (params.get("depth")) S.depth = +params.get("depth")!
  sub("drawer", ({ open }) => setDrawer(open))

  // the Library buttons toggle: pressing it again goes back to the reading view you came from
  for (const b of $$("button[data-view]")) listen(b, "click", () => setView(b.dataset.view === "library" && S.view === "library" ? before : b.dataset.view!))
  listen(document, "click", (e: MouseEvent) => {
    const b = (e.target as Element).closest?.("[data-act]") as HTMLElement | null; if (!b || !app.contains(b)) return
    switch (b.dataset.act) {
      case "search": focusSearch(); break
      case "theme": setTheme(document.documentElement.getAttribute("saved-theme") === "dark" ? "light" : "dark"); break
      case "left-toggle": setLeft(app.dataset.left === "closed"); break
      case "right-toggle": setRight(app.dataset.right === "closed"); break
      case "browse-drawer": setDrawer(app.dataset.drawer !== "open"); break
      case "drawer-close": setDrawer(false); break
    }
  })
  listen($("#scrim"), "click", () => setDrawer(false))
  listen(document, "keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape") { closePop(); if (narrow.matches) setDrawer(false) }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement as Element)?.tagName)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); focusSearch(); return }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === "/") { e.preventDefault(); focusSearch() }
    else if (e.key === "1") setView("essay"); else if (e.key === "4") setView("library"); else if (e.key.toLowerCase() === "l") setView(S.view === "library" ? before : "library")
    else if (e.key === "[") setLeft(app.dataset.left === "closed")
    else if (e.key === "Escape") { closePop(); if (narrow.matches) setDrawer(false) }
  })
  // following a link in the drawer puts it away
  listen($("#left"), "click", (e: MouseEvent) => { if (narrow.matches && (e.target as Element).closest("a[href]")) setDrawer(false) })

  /* the field panel's width: drag its left edge, arrow keys on the handle, double-click to reset; remembered */
  const rsz = $("#rsz"), DEFAULT_W = 340
  const maxW = () => Math.round(Math.min(900, innerWidth * 0.66))
  const setWidth = (w: number, persist = true) => {
    w = Math.max(260, Math.min(maxW(), Math.round(w)))
    app.style.setProperty("--rw", w + "px"); if (persist) store.set("rw", w)
    return w
  }
  const saved = store.get<number>("rw", DEFAULT_W); if (saved !== DEFAULT_W && !narrowPhone.matches) setWidth(saved, false)
  if (rsz) {
    let start: { x: number; w: number } | null = null
    const width = () => ($("#right") as HTMLElement).getBoundingClientRect().width
    listen(rsz, "pointerdown", (e: PointerEvent) => {
      if (e.button) return
      e.preventDefault(); rsz.setPointerCapture(e.pointerId); start = { x: e.clientX, w: width() }; app.dataset.resizing = "1"
    })
    listen(rsz, "pointermove", (e: PointerEvent) => { if (start) setWidth(start.w + (start.x - e.clientX), false) })
    const end = () => { if (!start) return; start = null; delete app.dataset.resizing; store.set("rw", Math.round(width())); emit("view", {}) }
    listen(rsz, "pointerup", end); listen(rsz, "pointercancel", end)
    listen(rsz, "dblclick", () => { setWidth(DEFAULT_W); emit("view", {}) })
    listen(rsz, "keydown", (e: KeyboardEvent) => {
      const step = e.shiftKey ? 80 : 24
      if (e.key === "ArrowLeft") { e.preventDefault(); setWidth(width() + step); emit("view", {}) }
      else if (e.key === "ArrowRight") { e.preventDefault(); setWidth(width() - step); emit("view", {}) }
      else if (e.key === "Home" || e.key === "Enter") { e.preventDefault(); setWidth(DEFAULT_W); emit("view", {}) }
    })
    listen(window, "resize", () => { const w = width(); if (w > maxW()) setWidth(maxW(), false) })
  }

  /* breadcrumbs: structure labels, not slugs; every separator opens that level's siblings (upward: it is a footer) */
  const crumbsEl = $("#crumbs")!
  function renderCrumbs() {
    const n = D.nodes[S.cur.i]; if (!n) return
    const chain = pathOf(n.i)
    if (!chain.length) return
    const home = D.bySlug.get("index")
    crumbsEl.innerHTML = `<ol>${chain.map((f, k) => {
      const last = k === chain.length - 1, sib = f.parent ? f.parent.children.length : 0
      // a page is a link; the root goes home; a folder with no page of its own opens what is in it
      const target = f.ni ?? (k === 0 ? home?.i : null)
      const label = target != null && !last ? `<a class="cr__l" href="${urlFor(D.nodes[target].s)}" data-ni="${target}">${esc(f.label)}</a>`
        : !last && f.children.length ? `<button class="cr__l cr__f" type="button" data-kids="${f.id}" aria-haspopup="true" title="What is in ${esc(f.label)}">${esc(f.label)}</button>`
        : `<span class="cr__l"${last ? ' aria-current="page"' : ""}>${esc(f.label)}</span>`
      return `<li class="cr${last ? " cr--cur" : ""}">${label}${!last && sib > 1 ? `<button class="cr__s" type="button" data-fid="${f.id}" aria-label="Siblings of ${esc(f.label)}"><svg width="12" height="12" aria-hidden="true"><use href="#i-chev"/></svg></button>` : !last ? '<i class="cr__sep">›</i>' : ""}</li>`
    }).join("")}</ol>`
    fitCrumbs()
  }
  function fitCrumbs() {
    const ol = crumbsEl.firstElementChild as HTMLElement | null; if (!ol) return
    const items = [...ol.children] as HTMLElement[]; items.forEach((li) => (li.hidden = false))
    $(".cr--more", ol)?.remove()
    const room = crumbsEl.clientWidth - 6, cur = items[items.length - 1]
    const natural = (li: HTMLElement) => (li === cur ? (cur.querySelector(".cr__l") as HTMLElement).scrollWidth + 8 : li.offsetWidth)
    const total = () => items.filter((li) => !li.hidden).reduce((s, li) => s + natural(li), 0) + (ol.querySelector(".cr--more") ? 28 : 0)
    let k = 1
    while (total() > room && k < items.length - 1) { items[k].hidden = true; k++ }
    if (k > 1) {
      const hid = items.slice(1, k).map((li) => li.querySelector(".cr__l")?.textContent).join(" › ")
      const more = document.createElement("li"); more.className = "cr cr--more"; more.innerHTML = `<span class="cr__l" title="${esc(hid)}">…</span><i class="cr__sep">›</i>`
      items[1].before(more)
    }
  }
  // refit only when the width changes: fitting itself changes the height, which would re-trigger the observer forever
  let fitW = -1
  observe(crumbsEl, (es) => { const w = Math.round(es[0].contentRect.width); if (w === fitW) return; fitW = w; fitCrumbs() })
  listen(crumbsEl, "click", (e: MouseEvent) => {
    const t = e.target as Element
    const a = t.closest("a[data-ni]") as HTMLElement | null
    if (a) { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); e.stopPropagation(); closePop(); act.openMain(+a.dataset.ni!); return }
    const kids = t.closest("[data-kids]") as HTMLElement | null
    if (kids) { e.stopPropagation(); openList(kids, kids.dataset.kids!, "kids"); return }
    const b = t.closest(".cr__s") as HTMLElement | null; if (b) { e.stopPropagation(); openList(b, b.dataset.fid!, "sibs") }
  }, true)
  function closePop() { pop?.remove(); pop = null }
  /** A small list under (above, it is a footer) a crumb: the folder's contents, or its siblings. */
  function openList(btn: HTMLElement, fid: string, mode: "kids" | "sibs") {
    const key = mode + fid
    const same = pop?.dataset.for === key; closePop(); if (same) return
    const f = D.treeIndex.get(fid), cur = pathOf(S.cur.i)
    const items = (mode === "kids" ? f.children : f.parent.children).filter((c: any) => !c.xhide || mode === "kids")
    const title = mode === "kids" ? f.label : f.parent.label
    const flat = mode === "kids" && items.length === 1 && items[0].kind === "folder" ? items[0].children : items
    pop = document.createElement("div"); pop.className = "cpop"; pop.dataset.for = key
    pop.innerHTML = `<p class="cpop__h">${esc(title)} <span>${flat.length}</span></p><ul>${flat.slice(0, 80).map((s: any) => `<li><a href="#" data-router-ignore="true" data-sid="${s.id}" class="${cur.includes(s) ? "is-here" : ""}" style="--rc:var(--c-${s.reg || "essay"})"><i></i>${s.coord ? `<em>${esc(s.coord)}</em>` : ""}<span>${esc(s.label)}</span><b>${s.kind === "folder" ? s.count : ""}</b></a></li>`).join("")}</ul>${flat.length > 80 ? `<p class="cpop__more">+${flat.length - 80} more in the explorer</p>` : ""}`
    ;($("#quartz-root") ?? document.body).appendChild(pop)
    const r = btn.getBoundingClientRect()
    pop.style.left = Math.min(innerWidth - pop.offsetWidth - 8, Math.max(8, r.left - 10)) + "px"
    const up = r.bottom + pop.offsetHeight + 12 > innerHeight
    pop.style.top = (up ? Math.max(8, r.top - pop.offsetHeight - 6) : r.bottom + 6) + "px"
    pop.addEventListener("click", (e) => {
      const a = (e.target as Element).closest("a[data-sid]") as HTMLElement | null; if (!a) return; e.preventDefault(); e.stopPropagation()
      const x = D.treeIndex.get(a.dataset.sid!), target = x.ni ?? firstLeaf(x)
      closePop(); if (target != null) act.openMain(target)
    })
  }
  listen(document, "pointerdown", (e: Event) => { if (pop && !pop.contains(e.target as Node) && !(e.target as Element).closest(".cr__s") && !(e.target as Element).closest("[data-kids]")) closePop() })
  mountCleanup(closePop)

  function renderPos() {
    const n = D.nodes[S.cur.i]; if (!n) return
    const m = S.cur.m, reading = readsAsMovement(n)
    $("#head-pos")!.innerHTML = reading && m ? `<span class="pos"><b>M${pad(m)}</b><i>/48</i></span>` : n.k === "room" ? `<span class="pos"><b>${esc(n.sec)}</b></span>` : ""
  }
  sub("locus", () => { renderCrumbs(); renderPos() })
  sub("position", ({ m }) => { S.cur.m = m; renderPos() })
  if (S.cur.i != null) { renderCrumbs(); renderPos() }
  if (params.get("drawer") === "open") setDrawer(true)
  if (params.get("q")) setTimeout(() => act.searchSet(params.get("q")!), 50)
}
