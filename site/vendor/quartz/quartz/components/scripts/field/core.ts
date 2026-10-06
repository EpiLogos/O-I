/* ───────── field core: state, bus, the data model, and where things live ───────── */
import { getFullSlug, pathToRoot } from "../../../util/path"

declare const fieldData: Promise<any>

export const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document as unknown as ParentNode) => r.querySelector(s) as T | null
export const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document as unknown as ParentNode) => [...r.querySelectorAll(s)] as T[]
export const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)
export const pad = (m: number) => String(m).padStart(2, "0")
export const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ø/g, "o").replace(/ß/g, "ss")

/** Storage is best-effort: private windows and embedded previews may refuse it. */
export const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem("oi-essay-" + k)
      return v == null ? d : JSON.parse(v)
    } catch {
      return d
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem("oi-essay-" + k, JSON.stringify(v))
    } catch {
      /* ignore */
    }
  },
}
export const session = {
  get<T>(k: string, d: T): T {
    try {
      const v = sessionStorage.getItem("oi-essay-" + k)
      return v == null ? d : JSON.parse(v)
    } catch {
      return d
    }
  },
  set(k: string, v: unknown) {
    try {
      sessionStorage.setItem("oi-essay-" + k, JSON.stringify(v))
    } catch {
      /* ignore */
    }
  },
}

/** One shared state. Every region reads it and listens; none reaches into another.
 *  cur = { i: page, m: manuscript movement | null, h: heading id | null } */
export const S: any = {
  cur: { i: null, m: null, h: null },
  hover: null,
  hits: null,
  query: "",
  view: "essay",
  depth: 1,
  hubs: false,
  hidden: new Set<string>(),
  visited: new Set<number>(store.get("visited", [] as number[])),
}
export const bus = new EventTarget()
export const emit = (type: string, detail?: any) => bus.dispatchEvent(new CustomEvent(type, { detail }))
export const on = (type: string, fn: (d: any) => void) => {
  const h = (e: Event) => fn((e as CustomEvent).detail)
  bus.addEventListener(type, h)
  return () => bus.removeEventListener(type, h)
}
export function setHover(i: number | null, from?: string) {
  if (S.hover === i) return
  S.hover = i
  emit("hover", { i, from })
}
export function markVisited(i: number) {
  if (S.visited.has(i)) return
  S.visited.add(i)
  store.set("visited", [...S.visited])
}

/* ───────── data ───────── */
export const REGS: Record<string, string> = { essay: "Essay", core: "Symbolon", matheme: "Matheme", mytheme: "Mytheme", episteme: "Episteme" }
export const REG_ORDER = ["essay", "core", "matheme", "mytheme", "episteme"]
export let STATIONS: Record<string, { name: string; reg: string; gloss: string }> = {}
export const D: any = { ready: false }

export interface TNode {
  id: string; kind: string; label: string; reg?: string; ni?: number; coord?: string; gloss?: string; key?: string
  xhide?: number; generic?: number; count: number; vcount: number; children: TNode[]; parent: TNode | null
}

export async function loadModel(): Promise<void> {
  if (D.ready) return
  const raw = await fieldData
  STATIONS = raw.stations
  D.nodes = raw.nodes
  D.links = raw.links
  D.rooms = raw.rooms
  D.moves = raw.moves
  D.bySlug = new Map(D.nodes.map((n: any) => [n.s, n]))
  D.byBase = new Map()
  for (const n of D.nodes) { const b = n.s.split("/").pop(); D.byBase.set(b, D.byBase.has(b) ? null : n) }
  D.out = D.nodes.map(() => []); D.in = D.nodes.map(() => [])
  for (const [a, b] of D.links) { D.out[a].push(b); D.in[b].push(a) }
  D.deg = D.nodes.map((_: any, i: number) => new Set([...D.out[i], ...D.in[i]]).size)
  D.manuscript = D.bySlug.get("THE-RETURN-OF-ZERO")
  D.moveNode = (m: number) => (D.moves[m] ? D.nodes[D.moves[m].i] : null)
  // the tree arrives without parent pointers
  D.tree = raw.tree
  D.leafOf = new Map(); D.treeIndex = new Map()
  const link = (f: TNode, parent: TNode | null) => {
    f.parent = parent
    D.treeIndex.set(f.id, f)
    if (f.ni != null && !D.leafOf.has(f.ni)) D.leafOf.set(f.ni, f)
    f.children.forEach((c) => link(c, f))
  }
  link(D.tree, null)
  // pages that have an Expression (ids); the gallery fetches the full index when it opens
  D.x = new Map<number, string[]>(Object.entries(raw.x ?? {}).map(([i, ids]) => [+i, ids as string[]]))
  D.ready = true
}

export function counts(i: number) {
  const hub = D.nodes[i].hub, keep = (j: number) => hub || !D.nodes[j].hub
  return { cites: D.out[i].filter(keep).length, citedBy: D.in[i].filter(keep).length, hubIn: D.in[i].filter((j: number) => D.nodes[j].hub).length }
}
export function neighbours(i: number, hubs = S.hubs) {
  const hub = D.nodes[i].hub, keep = (j: number) => hubs || hub || !D.nodes[j].hub
  const out: number[] = D.out[i].filter(keep), inn: number[] = D.in[i].filter(keep)
  return { out, inn, all: [...new Set([...out, ...inn])] }
}
export const pathOf = (ni: number): TNode[] => {
  const chain: TNode[] = []
  for (let f: TNode | null = D.leafOf.get(ni) ?? null; f && f.kind !== "root"; f = f.parent) chain.unshift(f)
  return chain
}
export const whereOf = (i: number) => {
  const ch = pathOf(i).slice(0, -1).map((f) => f.label)
  return ch.length ? ch.join(" › ") : STATIONS[D.nodes[i].st].name
}
export function resolveWiki(target: string) {
  const t = target.replace(/\.md$/, "").trim()
  return D.bySlug.get(t) || D.byBase.get(t.split("/").pop()!) || null
}

/* ───────── where things live ───────── */
/** Site root as an absolute URL, from the current page's slug. */
export const rootUrl = () => new URL(pathToRoot(getFullSlug(window)) + "/", location.href)
export function urlFor(slug: string, hash = ""): URL {
  const u = slug === "index" ? new URL(rootUrl()) : new URL(slug.split("/").map(encodeURIComponent).join("/"), rootUrl())
  u.hash = hash
  return u
}
/** Page index for an absolute URL inside the essay, or null. */
export function nodeForUrl(url: URL): any {
  const base = rootUrl()
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return null
  let slug = decodeURIComponent(url.pathname.slice(base.pathname.length)).replace(/\.html$/, "").replace(/\/+$/, "")
  if (!slug) slug = "index"
  return D.bySlug.get(slug) ?? D.bySlug.get(slug + "/index") ?? (slug.endsWith("/README") ? null : D.bySlug.get(slug + "/README")) ?? null
}
export const currentNode = () => {
  const slug = getFullSlug(window)
  // a folder listing (section-rooms/index) is the folder's README as far as the structure is concerned
  return D.bySlug.get(slug) ?? (slug.endsWith("/index") ? D.bySlug.get(slug.slice(0, -"/index".length) + "/README") : null) ?? null
}
export const isManuscript = (n: any) => n?.s === "THE-RETURN-OF-ZERO"
export const readsAsMovement = (n: any) => n && (n.s === "THE-RETURN-OF-ZERO" || n.k === "movement")

/* ───────── cross-module actions and per-page cleanup ───────── */
/** Registered by the module that owns them, so modules never import each other. */
export const act: {
  openExpression: (id: string, scene?: string) => void
  openMain: (i: number, o?: { m?: number | null; h?: string | null }) => void
  openTangent: (i: number, o?: { m?: number | null; h?: string | null }) => void
  scrollToM: (m: number, smooth?: boolean) => void
  scrollToId: (id: string, smooth?: boolean) => void
  focusSearch: () => void
  setView: (v: string) => void
  searchSet: (q: string) => void
} = {} as any

let disposers: (() => void)[] = []
export const mountCleanup = (fn: () => void) => { disposers.push(fn) }
export function resetMount() {
  for (const fn of disposers) { try { fn() } catch { /* ignore */ } }
  disposers = []
}
export const sub = (type: string, fn: (d: any) => void) => mountCleanup(on(type, fn))
export function listen(el: any, type: string, fn: (e: any) => void, opts?: AddEventListenerOptions | boolean) {
  if (!el) return
  el.addEventListener(type, fn, opts)
  mountCleanup(() => el.removeEventListener(type, fn, opts))
}
export function observe(el: Element | null, fn: ResizeObserverCallback) {
  if (!el) return
  const ro = new ResizeObserver(fn)
  ro.observe(el)
  mountCleanup(() => ro.disconnect())
}

/** A small image for a page's tree row: the first figure the page embeds, if the index knows one. */
export const assetThumb = (_n: any): string | null => null

/** Which pane is showing (the page itself, or a tangent) and which page it holds. Set by the tabs. */
export const view: { pane: HTMLElement | null; node: any } = { pane: null, node: null }

/* ───────── the Expression layer ───────── */
export interface XEntry {
  id: string; title: string; summary: string; collection: string; group: string
  scenes: { id: string; name: string; character: string }[]
  nodes: string[]; digest: string; journey: string; cover: string
}
export interface XIndex { entries: XEntry[]; collections: { id: string; label: string; count: number }[]; byId: Map<string, XEntry> }
export const exprOf = (i: number | null | undefined): string[] => (i == null ? [] : D.x?.get(i) ?? [])
let xIndex: Promise<XIndex | null> | null = null
/** The Expression index, fetched once (small: ~0.2 MB). Null when the essay was built without the layer. */
export function loadExpressions(): Promise<XIndex | null> {
  return (xIndex ??= fetch(new URL("expressions/index.json", rootUrl()).href)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && j.entries ? { entries: j.entries, collections: j.collections, byId: new Map(j.entries.map((e: XEntry) => [e.id, e])) } : null))
    .catch(() => { xIndex = null; return null }))
}
export const xCover = (e: XEntry) => new URL("expressions/" + e.cover, rootUrl()).href
/** The full renderer (the shell's expression.html), as a URL. */
export function expressionUrl(id: string, scene = "", embed = false): string {
  const u = new URL("../expression.html", rootUrl())
  u.searchParams.set("x", id)
  if (scene) u.searchParams.set("scene", scene)
  if (embed) {
    u.searchParams.set("embed", "1")
    u.searchParams.set("theme", document.documentElement.getAttribute("saved-theme") === "dark" ? "dark" : "light")
  }
  return u.href
}
export const shortTitle = (t: string) => t.replace(/^Return of Zero\s+[—·-]\s+/, "").replace(/^Return of Zero · Room \d of \d · /, "")
