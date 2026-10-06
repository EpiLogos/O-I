/* ───────── explorer: the essay's hierarchy, grouped and labelled — not a file dump ───────── */
import { $, $$, D, S, esc, exprOf, listen, setHover, store, sub, urlFor, TNode, mountCleanup, assetThumb } from "./core"

// persists across page navigations; the DOM does not
const X_MARK = `<span class="tn__x" title="Has an Expression"><svg width="11" height="11" aria-hidden="true"><use href="#i-expression"/></svg></span>`
const open = new Set<string>(store.get("tree-open", ["essay", "field", "rooms"]))
let lastScroll = 0

export function mountExplorer() {
  const root = $("#tree")!, scroller = $("#explorer")!
  if (!root || !scroller) return
  const openKey = (f: TNode) => f.key || f.id
  const rows = new Map<number, HTMLElement>(), folderEls = new Map<string, HTMLElement>()
  const persist = () => store.set("tree-open", [...open])

  function renderFolder(f: TNode, depth: number) {
    const li: any = document.createElement("li")
    li.className = `tn tn--${f.kind}`
    li.dataset.id = f.id
    li.style.setProperty("--rc", `var(--c-${f.reg || "essay"})`)
    li.setAttribute("role", "treeitem")
    const isSection = f.kind === "section"
    const label = f.ni != null && !isSection ? `<a class="tn__label" href="${urlFor(D.nodes[f.ni].s)}" tabindex="-1">${esc(f.label)}</a>` : `<span class="tn__label">${esc(f.label)}</span>`
    li.innerHTML = `<div class="tn__row" style="--d:${depth}" tabindex="0">
        <button class="tn__chev" tabindex="-1" type="button" aria-label="Toggle ${esc(f.label)}"><svg width="10" height="10" viewBox="0 0 10 10"><path d="M3 1.5 7 5 3 8.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        ${f.coord ? `<span class="tn__coord">${esc(f.coord)}</span>` : ""}${label}
        ${f.gloss && depth <= 1 ? `<span class="tn__gloss">${esc(f.gloss)}</span>` : ""}
        ${f.ni != null && exprOf(f.ni).length ? X_MARK : ""}<span class="tn__count">${f.vcount ?? f.count}</span></div><ul class="tn__kids" role="group"></ul>`
    folderEls.set(f.id, li)
    const row = li.firstElementChild as HTMLElement
    if (f.ni != null) rows.set(f.ni, row)
    const set = (v: boolean, persistIt = true) => {
      li.classList.toggle("is-open", v)
      li.setAttribute("aria-expanded", String(v))
      if (v) { open.add(openKey(f)); fill(li, f, depth) } else open.delete(openKey(f))
      if (persistIt) persist()
    }
    li._set = set
    row.addEventListener("click", (e) => {
      const a = (e.target as Element).closest("a")
      if (a) { if (!li.classList.contains("is-open")) set(true); return }   // the router follows the link
      set(!li.classList.contains("is-open"))
    })
    if (f.ni != null) {
      row.addEventListener("pointerenter", () => setHover(f.ni!, "tree"))
      row.addEventListener("pointerleave", () => setHover(null, "tree"))
    }
    set(open.has(openKey(f)), false)
    return li
  }

  function renderLeaf(f: TNode, depth: number) {
    const n = D.nodes[f.ni!]
    const li = document.createElement("li")
    li.className = "tn tn--leaf"
    li.style.setProperty("--rc", `var(--c-${f.reg || n.r})`)
    li.setAttribute("role", "treeitem")
    const thumb = assetThumb(n)
    li.innerHTML = `<div class="tn__row" style="--d:${depth}" tabindex="0">
        <span class="tn__chev tn__chev--none"></span>
        ${thumb ? `<img class="tn__thumb" width="26" height="18" src="${thumb}" alt="" loading="lazy">` : ""}
        ${f.coord ? `<span class="tn__coord">${esc(f.coord)}</span>` : ""}
        <a class="tn__label" href="${urlFor(n.s)}" tabindex="-1" title="${esc(n.t)}">${esc(f.label)}</a>
        ${exprOf(f.ni).length ? X_MARK : ""}<span class="tn__v" aria-hidden="true"></span></div>`
    const row = li.firstElementChild as HTMLElement
    rows.set(f.ni!, row)
    row.classList.toggle("is-visited", S.visited.has(f.ni))
    row.addEventListener("click", (e) => { if (!(e.target as Element).closest("a")) row.querySelector<HTMLElement>("a")!.click() })
    row.addEventListener("pointerenter", () => setHover(f.ni!, "tree"))
    row.addEventListener("pointerleave", () => setHover(null, "tree"))
    return li
  }

  function fill(li: HTMLElement, f: TNode, depth: number) {
    const ul = li.querySelector(":scope > .tn__kids") as HTMLElement
    if (ul.dataset.filled) return
    ul.dataset.filled = "1"
    const vis = f.children.filter((c) => !c.xhide)
    const bandable = vis.length > 60 && vis.every((c) => c.kind === "leaf")
    let last = ""
    const frag = document.createDocumentFragment()
    for (const c of f.children) {
      if (c.xhide) continue
      if (bandable) {
        const ch = (c.label.replace(/^[^A-Za-z0-9À-ɏ]+/, "")[0] || "#").toUpperCase()
        if (ch !== last) { last = ch; const b = document.createElement("li"); b.className = "tn__band"; b.textContent = ch; frag.appendChild(b) }
      }
      frag.appendChild(c.kind === "leaf" ? renderLeaf(c, depth + 1) : renderFolder(c, depth + 1))
    }
    ul.appendChild(frag)
  }

  const ul = document.createElement("ul")
  ul.className = "tree"; ul.setAttribute("role", "tree")
  for (const sec of D.tree.children) ul.appendChild(renderFolder(sec, 0))
  root.replaceChildren(ul)
  scroller.scrollTop = lastScroll
  listen(scroller, "scroll", () => { lastScroll = scroller.scrollTop }, { passive: true })

  let curRow: HTMLElement | null = null
  function reveal(ni: number, scroll = true) {
    const leaf = D.leafOf.get(ni)
    if (!leaf) return
    const chain: TNode[] = []
    for (let f: TNode | null = leaf.kind === "leaf" ? leaf.parent : leaf; f && f.kind !== "root"; f = f.parent) chain.unshift(f)
    for (const f of chain) { const li: any = folderEls.get(f.id); if (li && !li.classList.contains("is-open")) li._set(true) }
    $$(".has-current", root).forEach((e) => e.classList.remove("has-current"))
    for (const f of chain) folderEls.get(f.id)?.classList.add("has-current")
    curRow?.classList.remove("is-current"); curRow?.removeAttribute("aria-current")
    curRow = rows.get(ni) || null
    if (curRow) {
      curRow.classList.add("is-current"); curRow.setAttribute("aria-current", "page")
      const r = curRow.getBoundingClientRect(), b = scroller.getBoundingClientRect()
      if (scroll && b.height && (r.top < b.top + 40 || r.bottom > b.bottom - 40)) curRow.scrollIntoView({ block: "center" })
    }
  }
  let reading: HTMLElement[] = []
  function markReading() {
    reading.forEach((r) => r.classList.remove("is-reading")); reading = []
    const c = S.cur; if (c.i == null) return
    const n = D.nodes[c.i]
    const m = n.s === "THE-RETURN-OF-ZERO" ? c.m : n.k === "movement" ? n.m : null
    if (!m || !D.moves[m]) return
    for (const ni of [D.moves[m].i, D.rooms[D.moves[m].room].i]) { const r = rows.get(ni); if (r && ni !== c.i) { r.classList.add("is-reading"); reading.push(r) } }
  }
  sub("locus", ({ i }) => { reveal(i); rows.get(i)?.classList.add("is-visited"); markReading() })
  sub("position", markReading)
  let hov: HTMLElement | null = null
  sub("hover", ({ i, from }) => { hov?.classList.remove("is-hover"); hov = null; if (i == null || from === "tree") return; hov = rows.get(i) || null; hov?.classList.add("is-hover") })
  if (S.cur.i != null) { reveal(S.cur.i, false); markReading() }

  listen(root, "keydown", (e: KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Enter"].includes(e.key)) return
    const vis = $$(".tn__row", root).filter((r) => r.offsetParent)
    const i = vis.indexOf((document.activeElement as Element)?.closest?.(".tn__row") as HTMLElement)
    if (e.key === "ArrowDown") { vis[Math.min(vis.length - 1, i + 1)]?.focus(); e.preventDefault() }
    else if (e.key === "ArrowUp") { vis[Math.max(0, i - 1)]?.focus(); e.preventDefault() }
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") { const li: any = vis[i]?.parentElement; if (li?._set) { li._set(e.key === "ArrowRight"); e.preventDefault() } }
    else if (e.key === "Enter") vis[i]?.click()
  })
  mountCleanup(() => { lastScroll = scroller.scrollTop })
}
