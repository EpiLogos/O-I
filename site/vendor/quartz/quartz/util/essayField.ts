/**
 * The essay's structure, read once from the published pages.
 *
 * One model feeds three consumers so they can never disagree: the build emitter
 * (`static/fieldIndex.json`, which the explorer, graph, search and footer
 * breadcrumbs read in the browser), and the server-rendered page head and pager.
 *
 * Classification follows the corpus's own layout: section-rooms 00–07 hold the
 * 48 movements (M01–M48, joined to the manuscript's `<a id="M##">` anchors by the
 * number in the file name), and the publication's #1–#4 offices live under
 * symbolon/. Page bodies are read only for word counts and, on the manuscript
 * pages, for the `<a id="M##">` anchors each one carries.
 */
import { readFileSync } from "node:fs"
import type { QuartzPluginData } from "../plugins/vfile"
import { simplifySlug, type FullSlug } from "./path"

export type Register = "essay" | "core" | "matheme" | "mytheme" | "episteme"
export const REG_ORDER: Register[] = ["essay", "core", "matheme", "mytheme", "episteme"]
export const REGS: Record<Register, string> = {
  essay: "Essay",
  core: "Symbolon",
  matheme: "Matheme",
  mytheme: "Mytheme",
  episteme: "Episteme",
}
export const STATIONS: Record<string, { name: string; reg: Register; gloss: string }> = {
  "#0": { name: "Section-rooms", reg: "essay", gloss: "where the essay is argued, movement by movement" },
  "#1": { name: "Symbolon", reg: "core", gloss: "the relation itself · parā" },
  "#2": { name: "Matheme", reg: "matheme", gloss: "visionary operative logic · paśyantī" },
  "#3": { name: "Mytheme", reg: "mytheme", gloss: "formed, lived operations · madhyamā" },
  "#4": { name: "Episteme", reg: "episteme", gloss: "the documented utterance · vaikharī" },
  "#5": { name: "The essay", reg: "essay", gloss: "the manuscript, M01–M48" },
}

export type Kind =
  | "root" | "rooms-root" | "manuscript" | "movement" | "room" | "reading" | "alignment"
  | "argument" | "core" | "register" | "record"

export interface FNode {
  i: number
  s: string // full slug
  t: string // page title as written
  lab: string // short reading label
  coord: string // M16, §1, A07 …
  st: string // station #0–#5
  k: Kind
  r: Register
  w: number // words
  m?: number // manuscript movement 1–48
  mvs?: number[] // the movement anchors a manuscript page carries, ascending
  room?: number
  sec?: string
  pos?: string
  hub?: 1
  asset?: 1
}
export interface FRoom { sec: string; title: string; slug: string; i: number }
export interface FMove { i: number; title: string; sec: string; room: number }
export interface TreeNode {
  id: string
  kind: "root" | "section" | "folder" | "leaf"
  label: string
  reg?: Register
  ni?: number
  coord?: string
  gloss?: string
  key?: string
  xhide?: 1
  generic?: 1
  count: number
  vcount: number
  children: TreeNode[]
}
export interface FieldModel {
  nodes: FNode[]
  links: [number, number][]
  rooms: Record<number, FRoom>
  moves: Record<number, FMove>
  tree: TreeNode
  bySlug: Map<string, FNode>
}

const ROOM_RE = /^section-rooms\/(\d\d)-([^/]+)\//
const MOVE_RE = /^section-rooms\/(\d\d)-([^/]+)\/movements\/(\d\d)-(s\w+)-(p\d)-(.+)$/
const REG_OF_STATION: Record<string, Register> = { "#2": "matheme", "#3": "mytheme", "#4": "episteme" }

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
const pad = (m: number) => String(m).padStart(2, "0")
export const prettify = (seg: string) => {
  const s = seg.replace(/^\d+-/, "").replace(/[-_]+/g, " ").trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function classify(slug: string): { st: string; k: Kind } {
  if (slug === "index") return { st: "#5", k: "root" }
  if (slug === "THE-RETURN-OF-ZERO" || slug === "CONFRONTING-THE-LIMIT-S01") return { st: "#5", k: "manuscript" }
  if (slug.startsWith("section-rooms/")) {
    if (ROOM_RE.test(slug)) {
      if (slug.includes("/movements/")) return { st: "#0", k: "movement" }
      const base = slug.split("/").pop()!
      if (base.startsWith("ROOM-")) return { st: "#0", k: "room" }
      if (base.startsWith("READING-")) return { st: "#0", k: "reading" }
      return { st: "#0", k: "alignment" }
    }
    if (slug.startsWith("section-rooms/arguments")) return { st: "#0", k: "argument" }
    return { st: "#0", k: "rooms-root" }
  }
  const parts = slug.split("/")
  if (parts[0] === "symbolon") {
    if (parts.length === 2) return { st: "#1", k: "core" }
    const st = ({ matheme: "#2", mytheme: "#3", episteme: "#4" } as Record<string, string>)[parts[1]] ?? "#1"
    return { st, k: parts.length === 3 ? "register" : "record" }
  }
  return { st: "#5", k: "root" }
}

const fmStr = (d: QuartzPluginData, key: string): string => {
  const v = (d.frontmatter as any)?.[key]
  return v == null ? "" : String(v)
}

/** Build the model from every published page. Memoised by the page array. */
const memo = new WeakMap<object, FieldModel>()
export function fieldModel(files: QuartzPluginData[]): FieldModel {
  const cached = memo.get(files)
  if (cached) return cached
  const model = build(files)
  memo.set(files, model)
  return model
}

function build(files: QuartzPluginData[]): FieldModel {
  const pages = files.filter((f) => f.slug).slice().sort((a, b) => natural(a.slug!, b.slug!))
  const nodes: FNode[] = pages.map((f, i) => {
    const s = f.slug as string
    const { st, k } = classify(s)
    const n: FNode = {
      i, s, t: String(f.frontmatter?.title ?? s).trim(), lab: "", coord: "",
      st, k, r: STATIONS[st].reg, w: (f.text ?? "").split(/\s+/).filter(Boolean).length,
    }
    if (k === "movement") {
      const m = s.match(MOVE_RE)
      if (m) { n.m = +m[3]; n.room = +m[1] }
      n.sec = fmStr(f, "station"); n.pos = fmStr(f, "position")
    }
    if (k === "manuscript" && f.filePath) {
      try {
        const ids = [...readFileSync(f.filePath, "utf8").matchAll(/id="M(\d+)"/g)].map((x) => +x[1])
        if (ids.length) n.mvs = [...new Set(ids)].sort((a, b) => a - b)
      } catch { /* the anchors ride along when the source file is readable */ }
    }
    if (k === "room") { n.room = +s.match(ROOM_RE)![1]; n.sec = fmStr(f, "station") }
    if (k === "reading" || k === "alignment") n.room = +s.match(ROOM_RE)![1]
    if (fmStr(f, "asset")) n.asset = 1
    if (s.includes("/navigation/") || ["README", "index"].includes(s.split("/").pop()!)) n.hub = 1
    return n
  })
  const bySlug = new Map(nodes.map((n) => [n.s, n]))

  // links: contentIndex-style simplified slugs resolve to a page or its folder index
  const bySimple = new Map<string, number>()
  for (const n of nodes) bySimple.set(simplifySlug(n.s as FullSlug), n.i)
  const links: [number, number][] = []
  pages.forEach((f, a) => {
    const seen = new Set<number>()
    for (const t of f.links ?? []) {
      const b = bySimple.get(t) ?? bySimple.get(t + "/index") ?? (t === "/" ? bySlug.get("index")?.i : undefined)
      if (b != null && b !== a && !seen.has(b)) { seen.add(b); links.push([a, b]) }
    }
  })

  // rooms and movements
  const rooms: Record<number, FRoom> = {}
  for (const n of nodes) {
    if (n.k !== "room") continue
    const m = n.t.match(/^§[^ ]+ Room — ([^—]+?)(?: — .*)?$/)
    rooms[n.room!] = { sec: n.sec ?? "", title: (m ? m[1] : n.t).trim(), slug: n.s, i: n.i }
  }
  const moves: Record<number, FMove> = {}
  for (const n of nodes) {
    if (n.k !== "movement" || n.m == null) continue
    moves[n.m] = { i: n.i, title: n.t.replace(/^§[^ ]+ · #[^ ]+ — /, "").trim(), sec: n.sec ?? "", room: n.room! }
  }

  // reading labels
  for (const n of nodes) {
    let t = n.t, coord = "", m: RegExpMatchArray | null
    if (n.k === "movement") { t = t.replace(/^§[^ ]+ · #[^ ]+ — /, ""); coord = "M" + pad(n.m!) }
    else if (n.k === "room") { t = rooms[n.room!].title; coord = n.sec ?? "" }
    else if (n.k === "reading") { t = "Reading route"; coord = rooms[n.room!]?.sec ?? "" }
    else if (n.k === "alignment") { t = "Canonical alignment"; coord = rooms[n.room!]?.sec ?? "" }
    else if (n.s === "THE-RETURN-OF-ZERO") { t = "Confronting the Limit"; coord = "M01–M48" }
    else if (n.s === "CONFRONTING-THE-LIMIT-S01") { t = "§0/1 — The Integral Threshold"; coord = "§0/1" }
    else if (n.s === "index") t = "Reading home"
    else if (n.k === "argument" && (m = t.match(/^([AC]\d+′?) — (.+)$/))) { coord = m[1]; t = m[2] }
    else if (n.k === "argument" && (m = n.s.split("/").pop()!.match(/^([AC]\d+)-prime-(.+)$/))) { coord = m[1] + "′"; t = prettify(m[2]) }
    else if (n.k === "argument" && (m = n.s.split("/").pop()!.match(/^([AC]\d+)-(.+)$/))) { coord = m[1]; t = prettify(m[2]) }
    else if (/^[A-Z0-9-]+$/.test(t) && t.includes("-")) t = prettify(t.toLowerCase())
    n.lab = t; n.coord = coord
  }

  return { nodes, links, rooms, moves, tree: buildTree(nodes, rooms), bySlug }
}

/* ───────── the structure tree: grouped and labelled, not a file dump ───────── */
function buildTree(nodes: FNode[], rooms: Record<number, FRoom>): TreeNode {
  let uid = 0
  type T = TreeNode & { parent?: T }
  const mk = (kind: T["kind"], label: string, o: Partial<T> = {}): T => ({ id: "f" + uid++, kind, label, children: [], count: 0, vcount: 0, ...o }) as T
  const add = (p: T, c: T) => { c.parent = p; p.children.push(c); return c }
  const leaf = (n: FNode, o: Partial<T> = {}) => mk("leaf", n.lab, { ni: n.i, coord: n.coord, reg: n.r, ...o })
  const bySlug = new Map(nodes.map((n) => [n.s, n]))
  const root = mk("root", "Corpus")

  const essay = add(root, mk("section", "Essay", { reg: "essay", key: "essay" }))
  const ms = add(essay, mk("folder", "The manuscript", { reg: "essay", key: "ms" }))
  const manuscript = bySlug.get("THE-RETURN-OF-ZERO"), s01 = bySlug.get("CONFRONTING-THE-LIMIT-S01"), home = bySlug.get("index")
  if (manuscript) add(ms, leaf(manuscript, { label: "Confronting the Limit" }))
  if (s01) {
    const sections = add(ms, mk("folder", "Sections", { reg: "essay", key: "ms-sections", ni: s01.i, gloss: "the essay's sections as they are submitted" }))
    add(sections, leaf(s01))
  }
  if (home) add(ms, leaf(home, { label: "Reading home", coord: "" }))
  const roomsF = add(essay, mk("folder", "Section-rooms", { reg: "essay", key: "rooms", gloss: "eight rooms, forty-eight movements" }))
  const roomsRoot = bySlug.get("section-rooms/README")
  if (roomsRoot) roomsF.ni = roomsRoot.i
  for (let r = 0; r < 8; r++) {
    const rm = rooms[r]
    if (!rm) continue
    const rf = add(roomsF, mk("folder", rm.title, { reg: "essay", coord: rm.sec, ni: rm.i, key: "room" + r }))
    const inRoom = nodes.filter((n) => n.room === r)
    for (const n of inRoom.filter((n) => n.k === "reading" || n.k === "alignment")) add(rf, leaf(n))
    const mf = add(rf, mk("folder", "Movements", { reg: "essay", key: "mv" + r, xhide: 1 }))
    for (const n of inRoom.filter((n) => n.k === "movement").sort((a, b) => a.m! - b.m!)) add(mf, leaf(n))
  }
  const args = add(roomsF, mk("folder", "Arguments", { reg: "essay", key: "args", gloss: "A01–A36 with their conjugate faces A01′–A36′ and their concepts — one A/C field" }))
  const argSub: Record<string, T> = {}
  // the A/C root parents the suite: 72 arguments (A and A′) stand in the folder itself
  const ac = bySlug.get("section-rooms/arguments/conjugate/AC")
  if (ac) args.ni = ac.i
  else { const argR = bySlug.get("section-rooms/arguments/README"); if (argR) args.ni = argR.i }
  for (const n of nodes.filter((n) => n.k === "argument" && n.s !== "section-rooms/arguments/README")) {
    const parts = n.s.split("/")
    if (parts[2] === "conjugate") {
      // the conjugate faces are arguments, not a side folder; AC.md is the folder's own page
      if (parts[3] === "AC" || parts[3] === "README") continue
      add(args, leaf(n))
      continue
    }
    let par = args
    if (parts.length > 3) {
      par = argSub[parts[2]] ?? (argSub[parts[2]] = add(args, mk("folder", prettify(parts[2]), { reg: "essay", key: "args-" + parts[2] })))
      if (parts[3] === "README") { par.ni = n.i; continue }
    }
    add(par, leaf(n))
  }

  const field = add(root, mk("section", "The field", { reg: "core", key: "field" }))
  const core = add(field, mk("folder", "Symbolon", { reg: "core", key: "core", gloss: STATIONS["#1"].gloss }))
  const symRoot = bySlug.get("symbolon/README")
  if (symRoot) core.ni = symRoot.i
  for (const n of nodes.filter((n) => n.k === "core" && n !== symRoot)) add(core, leaf(n))
  for (const st of ["#2", "#3", "#4"]) {
    const S = STATIONS[st], regKey = REG_OF_STATION[st]
    const rf = add(field, mk("folder", S.name, { reg: S.reg, key: S.reg, gloss: S.gloss, generic: 1 }))
    const rr = bySlug.get(`symbolon/${regKey}/README`)
    if (rr) rf.ni = rr.i
    const dirs = new Map<string, T>()
    for (const n of nodes.filter((n) => n.st === st && n.k === "record")) {
      const parts = n.s.split("/").slice(2)
      let par = rf, path = ""
      for (let k = 0; k < parts.length - 1; k++) {
        path += "/" + parts[k]
        let f = dirs.get(path)
        if (!f) { f = add(par, mk("folder", prettify(parts[k]), { reg: S.reg, key: S.reg + path, generic: 1 })); dirs.set(path, f) }
        par = f
      }
      const base = parts[parts.length - 1]
      if ((base === "README" || base === "index") && par !== rf) { par.ni = n.i; continue }
      add(par, leaf(n))
    }
  }

  const tidy = (f: T) => {
    for (const c of f.children) if (c.kind !== "leaf") tidy(c as T)
    f.children = f.children.map((c) => {
      if (c.kind === "folder" && c.children.length === 1 && c.children[0].kind === "leaf" && c.ni == null) { const l = c.children[0] as T; l.parent = f; return l }
      if (c.kind === "folder" && c.children.length === 1 && c.children[0].kind === "folder" && c.ni == null && !c.key!.startsWith("room")) { const g = c.children[0] as T; g.label = c.label + " › " + g.label; g.parent = f; return g }
      return c
    })
    for (const c of f.children) if (c.kind === "folder" && !c.children.length && c.ni != null) { c.kind = "leaf"; c.count = 1 }
    if (f.generic) f.children.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "folder" ? -1 : 1) || natural(a.label, b.label))
    const own = f.kind === "folder" && f.ni != null ? 1 : 0
    f.count = f.children.reduce((s, c) => s + (c.kind === "leaf" ? 1 : c.count), 0) + own
    f.vcount = f.children.reduce((s, c) => s + (c.xhide ? 0 : c.kind === "leaf" ? 1 : c.vcount), 0) + own
  }
  tidy(root)
  // parents are rebuilt in the browser; drop the cycle for JSON
  const strip = (f: T) => { delete f.parent; f.children.forEach((c) => strip(c as T)) }
  strip(root)
  return root
}

/* ───────── helpers for server-rendered pieces ───────── */
const chains = new WeakMap<TreeNode, Map<number, TreeNode[]>>()
/** Root-to-leaf chain of structure nodes for a page (explorer path = footer breadcrumbs). */
export function treePath(model: FieldModel, ni: number): TreeNode[] {
  let map = chains.get(model.tree)
  if (!map) {
    map = new Map()
    const walk = (f: TreeNode, chain: TreeNode[]) => {
      const here = f.kind === "root" ? chain : [...chain, f]
      if (f.ni != null && !map!.has(f.ni)) map!.set(f.ni, here)
      f.children.forEach((c) => walk(c, here))
    }
    walk(model.tree, [])
    chains.set(model.tree, map)
  }
  return map.get(ni) ?? []
}
export const pad2 = pad
