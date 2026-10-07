/* ───────── reader: reading position, contents, the 48-movement rail, figures ───────── */
import { $, $$, D, S, act, emit, esc, isManuscript, listen, nodeForUrl, observe, pad, setHover, sub, view, readsAsMovement, currentNode } from "./core"

// survives navigations: where the reader was, per page
let lastM: number | null = null

export function mountReader() {
  const scroller = $("#scroller")!, progress = $("#progress")!, rail = $("#mrail")!, tocEl = $("#toc")!, lightbox = $<HTMLDialogElement>("#lightbox")!
  if (!scroller || !progress || !rail || !tocEl || !lightbox) return
  let anchors: { m: number; top: number }[] = [], raf = 0, pin: { m: number; until: number } | null = null
  let settling = false, wasVisible = true, lastTop = 0
  const pane = () => view.pane || $("#essay-pane")!
  const visible = () => scroller.clientHeight > 0 && pane().isConnected && !pane().hidden
  const base = () => scroller.getBoundingClientRect().top - scroller.scrollTop

  function measure() {
    if (!visible()) return
    const b = base()
    anchors = $$("a[id^='M']", pane()).filter((a) => /^M\d+$/.test(a.id)).map((a) => ({ m: +a.id.slice(1), top: a.getBoundingClientRect().top - b }))
  }
  const glide = (top: number, smooth: boolean) => scroller.scrollTo({ top: Math.max(0, top), behavior: smooth && Math.abs(top - scroller.scrollTop) < scroller.clientHeight * 2 ? "smooth" : "auto" })
  act.scrollToM = (m, smooth = true) => { measure(); const a = anchors.find((x) => x.m === m); if (!a) return; glide(a.top - 24, smooth); pin = { m, until: performance.now() + 2500 } }
  act.scrollToId = (id, smooth = true) => {
    const el = pane().querySelector("#" + CSS.escape(id)) as HTMLElement | null; if (!el) return
    glide(el.getBoundingClientRect().top - base() - 24, smooth)
  }
  for (const t of ["wheel", "touchstart", "keydown", "pointerdown"]) listen(scroller, t, () => { pin = null }, { passive: true })

  /** A page (or tangent) has just been shown: prepare it and put the reader where the locus says. */
  function settle(cur: any) {
    const n = view.node
    prepare()
    buildToc(n); buildRail(n)
    requestAnimationFrame(() => {
      measure()
      settling = true
      if (cur.top != null) { scroller.scrollTop = cur.top; pin = null }
      else if (cur.m && isManuscript(n)) act.scrollToM(cur.m, !cur.fresh)
      else if (cur.h) act.scrollToId(cur.h, !cur.fresh)
      else scroller.scrollTop = 0
      settling = false
      lastTop = scroller.scrollTop
      onScroll(true)
    })
  }

  // figures: authored in the corpus as image + caption (the page's figure wrapper does the rest)
  function prepare() {
    for (const im of $$<HTMLImageElement>("figure.fig img, article > p > img", pane())) {
      im.decoding = "async"
      im.title = im.title || "Click to enlarge"
    }
  }

  function onScroll(force = false) {
    raf = 0
    if (!visible() || settling) return
    lastTop = scroller.scrollTop
    const y = scroller.scrollTop + 90, max = scroller.scrollHeight - scroller.clientHeight
    progress!.style.transform = `scaleX(${max > 0 ? scroller.scrollTop / max : 0})`
    const n = view.node
    if (!n) return
    let m: number | null = null
    if (isManuscript(n)) { for (const a of anchors) { if (a.top <= y) m = a.m; else break } if (m == null && anchors.length) m = anchors[0].m }
    else if (n.k === "movement") m = n.m
    if (m !== lastM || force) {
      lastM = m; S.cur.m = m; emit("position", { m })
      $$(".mrail__t", rail!).forEach((t) => t.classList.toggle("is-here", +t.dataset.m! === m))
      markToc(m)
    }
  }
  listen(scroller, "scroll", () => { if (!raf) raf = requestAnimationFrame(() => onScroll()) }, { passive: true })
  observe(scroller, () => {
    const v = visible()
    if (v && !wasVisible) {   // pane reopened: re-measure and put the reader back where it was
      wasVisible = true; measure()
      if (isManuscript(view.node) && S.cur.m) act.scrollToM(S.cur.m, false)
      else scroller.scrollTop = lastTop
      onScroll()
    } else if (!v) wasVisible = false
    else { measure(); onScroll() }
  })
  for (const p of $$(".pane")) observe(p, () => {
    if (!visible() || p !== pane()) return
    measure()
    if (pin && performance.now() < pin.until) { const a = anchors.find((x) => x.m === pin!.m); if (a && Math.abs(scroller.scrollTop - (a.top - 24)) > 2) scroller.scrollTo({ top: Math.max(0, a.top - 24), behavior: "auto" }) }
    onScroll()
  })

  /* contents: Quartz's table of contents, position-aware; a manuscript page's
     contents are the movements it itself carries (all 48 on the whole manuscript,
     M01–M06 on §0/1), so both track and are tracked the same way */
  function buildToc(n: any) {
    let html = ""
    const xv = (view as any).x
    if (xv) {
      // an Expression's contents are its scenes; choosing one tells the frame
      html = xv.entry.scenes.map((sc: any, k: number) => `<a class="l3${sc.id === xv.scene ? " is-here" : ""}" href="#" data-router-ignore="true" data-xscene="${esc(sc.id)}"><b>${pad(k + 1)}</b>${esc(sc.name)}</a>`).join("")
    } else if (isManuscript(n)) {
      let room = -1
      for (const m of n.mvs ?? []) {
        const mv = D.moves[m]
        if (!mv) continue
        if (mv.room !== room) {
          room = mv.room
          const r = D.rooms[room]
          if (r) html += `<a class="l2" href="#" data-router-ignore="true" data-room="${room}"><b>${esc(r.sec)}</b>${esc(r.title)}</a>`
        }
        html += `<a class="l3" href="#" data-router-ignore="true" data-m="${m}"><b>M${pad(m)}</b>${esc(mv.title)}</a>`
      }
    } else {
      const hs = $$("article h2, article h3", pane())
      html = hs.length ? hs.map((h) => `<a href="#${esc(h.id)}" class="l${h.tagName[1]}" data-h="${esc(h.id)}">${esc((h.textContent || "").trim())}</a>`).join("") : '<p class="toc__none">This page has no sections.</p>'
    }
    tocEl!.innerHTML = html
    markToc(lastM)
  }
  function markToc(m: number | null) {
    $("a.is-here", tocEl!)?.classList.remove("is-here")
    if (m == null || !isManuscript(view.node)) return
    $(`a[data-m="${m}"]`, tocEl!)?.classList.add("is-here")
  }
  listen(tocEl, "click", (e) => {
    const a = (e.target as Element).closest("a") as HTMLElement | null; if (!a) return
    e.preventDefault(); e.stopPropagation()
    if (a.dataset.xscene) {
      const f = document.querySelector<HTMLIFrameElement>("iframe.xframe")
      f?.contentWindow?.postMessage({ type: "oi-scene", scene: a.dataset.xscene }, location.origin)
      $$("a.is-here", tocEl!).forEach((x) => x.classList.remove("is-here")); a.classList.add("is-here")
      ;(view as any).x.scene = a.dataset.xscene
    } else if (a.dataset.m) openM(+a.dataset.m)
    else if (a.dataset.room != null) openM(+Object.entries<any>(D.moves).find(([, v]) => v.room === +a.dataset.room!)![0])
    else act.scrollToId(a.dataset.h!, true)
  })

  /* the reading line: the page's own movements as an edge rail */
  function buildRail(n: any) {
    const on_ = readsAsMovement(n)
    rail!.hidden = !on_
    if (!on_) return
    const mvs = (isManuscript(n) ? n.mvs ?? [] : Object.keys(D.moves).map(Number)).filter((m) => D.moves[m])
    const sig = mvs.join(",")
    if (rail!.dataset.mvs !== sig || !rail!.firstChild) {
      rail!.dataset.mvs = sig
      let room = -1, html = ""
      for (const m of mvs) {
        const mv = D.moves[m], brk = mv.room !== room; room = mv.room
        html += `<button class="mrail__t${brk ? " is-first" : ""}" type="button" data-m="${m}" aria-label="M${pad(m)} ${esc(mv.title)}"><i></i><span class="mrail__tip"><b>M${pad(m)}</b> ${esc(mv.title)}<em>${esc(D.rooms[mv.room]?.sec ?? "")}</em></span></button>`
      }
      rail!.innerHTML = html
    }
    $$(".mrail__t", rail!).forEach((t) => t.classList.toggle("is-here", +t.dataset.m! === lastM))
  }
  function openM(m: number) { isManuscript(view.node) ? act.scrollToM(m, true) : act.openTangent(D.moves[m].i) }
  listen(rail, "click", (e) => { const b = (e.target as Element).closest(".mrail__t") as HTMLElement | null; if (b) openM(+b.dataset.m!) })
  listen(rail, "pointerover", (e) => { const b = (e.target as Element).closest(".mrail__t") as HTMLElement | null; if (b) setHover(D.moves[+b.dataset.m!].i, "rail") })
  listen(rail, "pointerleave", () => setHover(null, "rail"))

  /* following things from the text: a tangent opens beside the essay; inside a tangent it replaces itself */
  function openLightbox(img: HTMLImageElement) {
    const cap = img.closest("figure")?.querySelector("figcaption")
    lightbox!.innerHTML = `<form method="dialog"><button class="lb__x" type="submit" aria-label="Close">×</button></form><div class="lb__mat"><img src="${img.currentSrc || img.src}" alt="${esc(img.alt)}"></div>${cap ? `<div class="lb__cap">${cap.innerHTML}</div>` : ""}`
    lightbox!.showModal()
  }
  listen(lightbox, "click", (e) => { if (e.target === lightbox) lightbox!.close() })
  listen(scroller, "click", (e: MouseEvent) => {
    const t = e.target as Element
    const fig = t.closest("figure.fig img, article > p > img") as HTMLImageElement | null
    if (fig) { openLightbox(fig); return }
    const chip = t.closest("a.xchip[data-x]") as HTMLElement | null
    if (chip && !(e.metaKey || e.ctrlKey || e.shiftKey)) { e.preventDefault(); e.stopPropagation(); act.openExpression(chip.dataset.x!); return }
    const a = t.closest("a[href]") as HTMLAnchorElement | null
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank" || a.dataset.routerIgnore != null) return
    let url: URL
    try { url = new URL(a.href) } catch { return }
    const here = pane() === $("#essay-pane") ? currentNode() : view.node
    // an in-page jump (including the heading anchors): scroll the pane, not the window
    if (a.getAttribute("href")?.startsWith("#") || (here && nodeForUrl(url) === here && url.hash)) {
      e.preventDefault(); e.stopPropagation()
      act.scrollToId(decodeURIComponent(url.hash.slice(1)), true)
      return
    }
    const n = nodeForUrl(url)
    if (!n) return                                  // not a page of the essay: the browser decides
    if (a.closest(".pager") && pane() === $("#essay-pane")) return   // reading on: the router turns the page
    e.preventDefault(); e.stopPropagation()
    act.openTangent(n.i, { h: url.hash ? decodeURIComponent(url.hash.slice(1)) : null })
  }, true)
  listen(scroller, "pointerover", (e) => { const a = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null; if (!a) return; try { const n = nodeForUrl(new URL(a.href)); if (n) setHover(n.i, "reader") } catch { /* ignore */ } })
  listen(scroller, "pointerout", (e) => { if ((e.target as Element).closest("a[href]")) setHover(null, "reader") })

  sub("locus", settle)
  // back from the Library view: the page is where it was left
  sub("restore", ({ top }) => { if (top == null) return; measure(); scroller.scrollTop = top; lastTop = top; onScroll(true) })
  if (view.node) settle({ ...S.cur, top: null, fresh: true })
}
