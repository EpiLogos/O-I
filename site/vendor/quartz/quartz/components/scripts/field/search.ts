/* ───────── search: in the left sidebar; every hit says where it lives ───────── */
import { $, $$, D, S, STATIONS, act, emit, esc, fold, listen, pathOf, setHover, urlFor, mountCleanup } from "./core"

declare const fetchData: Promise<Record<string, { content: string }>>

// the 12 MB full-text index is fetched once, on first use, and survives page navigations
let text: string[] | null = null, raw: string[] | null = null, slugF: string[] | null = null
let loading: Promise<void> | null = null

function light() {
  if (text) return
  text = D.nodes.map((n: any) => fold(n.t))
  raw = D.nodes.map((n: any) => n.t)
  slugF = D.nodes.map((n: any) => fold(n.s))
}
function upgrade(): Promise<void> {
  return (loading ??= (async () => {
    try {
      const idx = await fetchData
      raw = D.nodes.map((n: any) => (idx[n.s]?.content ?? "").replace(/\s+/g, " ").trim())
      text = D.nodes.map((n: any, i: number) => fold(n.t + " \n " + raw![i]))
      full = true
    } catch { loading = null /* titles and paths still work; try again on the next focus */ }
  })())
}
let full = false
const scope = new Set<string>()
let hits: [number, number][] = [], active = -1, q = ""

const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const parse = (rawQ: string) => {
  const phrases: string[] = [], tokens: string[] = []
  rawQ = rawQ.replace(/"([^"]+)"/g, (_, p) => { phrases.push(fold(p.trim())); return " " })
  rawQ.split(/\s+/).filter(Boolean).forEach((t) => tokens.push(fold(t)))
  return { phrases, tokens }
}

function run(query: string) {
  const { phrases, tokens } = parse(query), terms = [...phrases, ...tokens], out: [number, number][] = []
  for (let i = 0; i < text!.length; i++) {
    const t = text![i], s = slugF![i]
    let score = 0, ok = true
    for (const term of terms) {
      const inSlug = s.includes(term)
      let pos = t.indexOf(term)
      if (pos < 0 && !inSlug) { ok = false; break }
      let c = 0
      while (pos >= 0 && c < 30) { c++; pos = t.indexOf(term, pos + term.length) }
      score += c + (inSlug ? 12 : 0)
      const ft = fold(D.nodes[i].lab + " " + D.nodes[i].t)
      if (ft.includes(term)) score += 40 + (ft.startsWith(term) ? 20 : 0)
    }
    if (!ok) continue
    const n = D.nodes[i]
    if (n.hub) score *= 0.35
    if (n.k === "movement" || n.k === "room" || n.k === "manuscript") score += 8
    out.push([i, score])
  }
  out.sort((a, b) => b[1] - a[1])
  return { out, terms }
}

const markUp = (str: string, terms: string[]) => {
  const f = fold(str)
  if (f.length !== str.length) return esc(str)
  const re = new RegExp(terms.map(reEsc).join("|"), "g")
  let m: RegExpExecArray | null, res = "", last = 0
  while ((m = re.exec(f))) { res += esc(str.slice(last, m.index)) + "<mark>" + esc(str.slice(m.index, m.index + m[0].length)) + "</mark>"; last = m.index + m[0].length }
  return res + esc(str.slice(last))
}
function snippet(i: number, terms: string[]) {
  const body = raw?.[i] || "", f = fold(body)
  let best = -1
  for (const t of terms) { const p = f.indexOf(t); if (p >= 0 && (best < 0 || p < best)) best = p }
  if (best < 0 || f.length !== body.length) return esc(body.slice(0, 150)) + (body.length > 150 ? "…" : "")
  const a = Math.max(0, best - 60), win = body.slice(a, a + 190)
  return (a > 0 ? "…" : "") + markUp(win, terms) + "…"
}
const whereList = (i: number) => { const segs = pathOf(i).slice(0, -1).map((f) => f.label); return segs.length ? segs : [STATIONS[D.nodes[i].st].name] }

export function mountSearch() {
  const input = $<HTMLInputElement>("#q"), body = $("#results"), hist = $("#q-hist"), statusEl = $("#q-status"), clear = $("#q-clear"), tree = $("#tree")
  if (!input || !body || !hist || !statusEl || !clear || !tree) return
  const root = $("#quartz-root")!

  function drawHist(all: [number, number][]) {
    const c: Record<string, number> = {}
    for (const [i] of all) c[D.nodes[i].st] = (c[D.nodes[i].st] || 0) + 1
    hist!.innerHTML = Object.keys(STATIONS).map((st) => {
      const n = c[st] || 0, St = STATIONS[st]
      return `<button class="sh" type="button" data-st="${st}" style="--rc:var(--c-${St.reg});flex:${Math.max(n, 0.001)} 1 ${n ? 40 : 0}px" aria-pressed="${scope.has(st)}" ${n ? "" : "disabled"} title="${St.name}: ${n} hits"><span class="sh__bar"></span><span class="sh__l">${st}<b>${n}</b></span></button>`
    }).join("")
    hist!.hidden = false
  }
  function render(terms: string[]) {
    const shown = hits.slice(0, 80)
    body!.innerHTML = `<ol class="hits">${shown.map(([i], k) => {
      const n = D.nodes[i], where = whereList(i)
      return `<li class="hit${k === active ? " is-active" : ""}" data-i="${i}" data-k="${k}"><a href="${urlFor(n.s)}" tabindex="-1" style="--rc:var(--c-${n.r})">
        <span class="hit__top"><span class="hit__dot"></span><span class="hit__t">${markUp(n.k === "movement" || n.k === "room" || n.k === "argument" ? n.lab : n.t, terms)}</span>${n.coord ? `<span class="hit__c">${esc(n.coord)}</span>` : ""}</span>
        <span class="hit__where">${where.map(esc).join("<i>›</i>")}</span>
        <span class="hit__s">${snippet(i, terms)}</span></a></li>`
    }).join("")}</ol>${hits.length > 80 ? `<p class="hits__more">${hits.length - 80} more — narrow the query or pick a station above.</p>` : ""}`
  }
  const show = (on_: boolean) => { tree!.hidden = on_; body!.hidden = !on_; root.classList.toggle("is-searching", on_) }

  function update() {
    light()
    q = input!.value.trim()
    if (!q) { S.query = ""; S.hits = null; emit("hits"); hist!.hidden = true; statusEl!.textContent = ""; clear!.hidden = true; show(false); return }
    show(true); clear!.hidden = false
    const { out, terms } = run(q)
    drawHist(out)
    hits = scope.size ? out.filter(([i]) => scope.has(D.nodes[i].st)) : out
    S.query = q; S.hits = new Set(hits.map(([i]) => i))
    active = hits.length ? 0 : -1
    statusEl!.textContent = hits.length
      ? `${hits.length} page${hits.length === 1 ? "" : "s"}` + (scope.size ? ` in ${[...scope].map((s) => STATIONS[s].name).join(" + ")}` : "") + (full ? " · full text" : " · titles & paths · loading full text…")
      : full ? "No page matches" : "No title or path matches · loading full text…"
    if (!hits.length) body!.innerHTML = `<p class="hits__none">Nothing matches <b>${esc(q)}</b>.<br>Search folds diacritics: Śūnya is found as sunya.</p>`
    else render(terms)
    emit("hits")
    if (hits.length) setHover(hits[0][0], "search-active")
  }
  // reflect state that survived the navigation
  if (input.value) update()

  let t: any
  listen(input, "input", () => { clearTimeout(t); t = setTimeout(update, 60) })
  listen(input, "focus", () => { light(); upgrade().then(() => { if (input.value.trim()) update() }) })
  listen(clear, "click", () => { input.value = ""; update(); input.focus() })
  listen(hist, "click", (e) => { const b = (e.target as Element).closest(".sh") as HTMLElement | null; if (!b) return; const st = b.dataset.st!; scope.has(st) ? scope.delete(st) : scope.add(st); update() })
  const move = (d: number) => {
    const n = Math.min(hits.length, 80); if (!n) return
    active = (active + d + n) % n
    $$(".hit", body).forEach((el, k) => el.classList.toggle("is-active", k === active))
    $(".hit.is-active", body)?.scrollIntoView({ block: "nearest" })
    setHover(hits[active][0], "search-active")
  }
  listen(input, "keydown", (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") { move(1); e.preventDefault() }
    else if (e.key === "ArrowUp") { move(-1); e.preventDefault() }
    else if (e.key === "Enter" && hits[active]) { e.preventDefault(); e.shiftKey ? act.openMain(hits[active][0]) : act.openTangent(hits[active][0]) }
    else if (e.key === "Escape") { input.value = ""; update(); input.blur() }
  })
  listen(body, "click", (e: MouseEvent) => {
    const li = (e.target as Element).closest(".hit") as HTMLElement | null; if (!li) return
    if (e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault(); e.stopPropagation(); active = +li.dataset.k!; act.openTangent(+li.dataset.i!)
  }, true)
  listen(body, "pointerover", (e) => { const li = (e.target as Element).closest(".hit") as HTMLElement | null; if (li) setHover(+li.dataset.i!, "search") })
  listen(body, "pointerleave", () => setHover(null, "search"))

  act.focusSearch = () => { input.focus(); input.select() }
  act.searchSet = (v: string) => { input.value = v; update() }
  mountCleanup(() => { /* the query stays in the input across navigations via S.query */ })
}
