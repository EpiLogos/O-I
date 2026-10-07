import yaml from "js-yaml"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, posix } from "node:path"
import { Element, Root, RootContent } from "hast"
import { QuartzTransformerPlugin } from "../types"
import { classify } from "../../util/essayField"

/**
 * Source notes read down into their source houses.
 *
 * The manuscript pages carry Chicago-style endnotes and per-movement source lists
 * as plain prose. The corpus itself keeps one canonical house per source under
 * `symbolon/episteme/sources/<domain>/<author>/<source_id>/<source_id>.md`, with
 * the work's names in its frontmatter. This projection joins the two at build
 * time: every italicised work title in a note or source entry that names exactly
 * one house becomes a link to that house's page. Nothing in the corpus files
 * changes; a note whose source has no house, or whose title matches more than
 * one, stays unlinked prose.
 */
export interface SourceNotesOptions {
  sourcesRoot: string
}

const defaultOptions: SourceNotesOptions = {
  sourcesRoot: "symbolon/episteme/sources",
}

const STOP = new Set(["the", "a", "an", "of", "in", "and", "to", "on", "for", "with", "at", "by", "from", "or", "its", "edited", "translated"])

/** Fold case, accents and punctuation into comparable content words. */
const words = (s: string): string[] =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP.has(w))

interface House {
  id: string
  slug: string
  keys: Set<string> // content words of every recorded name of the work
  variants: string[][] // per recorded name, for disambiguation
  surnames: string[]
  year: string
}

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x)) : v == null ? [] : [String(v)]

/** A house file's YAML frontmatter, or null when it carries none. */
function houseFrontmatter(text: string): Record<string, unknown> | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)
  if (!m) return null
  try {
    return (yaml.load(m[1]) as Record<string, unknown>) ?? {}
  } catch {
    return null
  }
}

function readHouses(sourcesDir: string, relPrefix: string): House[] {
  const houses: House[] = []
  const walk = (dir: string) => {
    let entries: import("node:fs").Dirent[] = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    const parent = posix.basename(dir.split(join.sep).join("/"))
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!entry.name.endsWith(".md")) continue
      const stem = entry.name.slice(0, -3)
      if (stem !== parent) continue // a house file is named after its folder
      const fm = houseFrontmatter(readFileSync(full, "utf8"))
      if (!fm) continue
      const names = [String(fm.title_full ?? ""), String(fm.title ?? ""), ...asArray(fm.aliases)].filter((s) => s.trim())
      if (!names.length) continue
      const authors = asArray(fm.author)
      const surnames = authors.map((a) => words(a).at(-1) ?? "").filter((s) => s.length >= 3)
      const keys = new Set<string>()
      const variants = names.map((n) => {
        const w = words(n).filter((t) => !surnames.includes(t) && !/^\d+$/.test(t))
        w.forEach((t) => keys.add(t))
        return w
      })
      houses.push({
        id: stem,
        slug: relPrefix + "/" + posix.relative(sourcesDir, full).slice(0, -3).split(join.sep).join("/"),
        keys,
        variants,
        surnames,
        year: fm.year != null ? String(fm.year) : "",
      })
    }
  }
  walk(sourcesDir)
  return houses
}

const isEl = (n: RootContent | undefined | null, tag?: string): n is Element =>
  !!n && n.type === "element" && (!tag || n.tagName === tag)

const textOf = (n: RootContent): string =>
  n.type === "text" ? n.value : n.type === "element" ? n.children.map(textOf).join("") : ""

/** Outermost `<em>` descendants that are not already inside a link. */
function titleEls(node: Element): Element[] {
  const out: Element[] = []
  const walk = (el: Element, linked: boolean): void => {
    for (const child of el.children) {
      if (!isEl(child)) continue
      if (child.tagName === "a") walk(child, true)
      else if (child.tagName === "em" || child.tagName === "i") {
        if (!linked) out.push(child)
        walk(child, linked)
      } else walk(child, linked)
    }
  }
  walk(node, false)
  return out
}

/** Link every note and source entry that names exactly one source house. */
function linkListItems(li: Element, houses: House[], slug: string, stats: PageStats): void {
  const text = li.children.map(textOf).join("")
  if (!text.trim()) return
  stats.notes += 1
  const lower = text.toLowerCase()
  const chosen = new Map<House, Element>()
  for (const em of titleEls(li)) {
    const w = words(em.children.map(textOf).join(""))
    if (!w.length || w.length > 14) continue
    // a cited title runs contiguously within its recorded name, anchored at the
    // name's start or end ("On Learned Ignorance" of "De docta ignorantia / On
    // Learned Ignorance", "Agentworld" of "Agentworld: …"); a single word must
    // open the name, so terms from inside a title stay prose ("Bedeutung", "Sinn")
    const citesTitle = (h: House) => h.variants.some((v) => {
      if (v.length === 0) return false
      if (w.length === 1) return v[0] === w[0]
      for (let start = 0; start + w.length <= v.length; start++) {
        let run = true
        for (let i = 0; i < w.length; i++) if (v[start + i] !== w[i]) { run = false; break }
        if (run && (start === 0 || start + w.length === v.length)) return true
      }
      return false
    })
    const candidates = houses.filter((h) => {
      if (!w.every((t) => h.keys.has(t))) return false
      if (!citesTitle(h)) return false
      if (h.surnames.length === 0) return true // anonymous work: the whole name decides
      return h.surnames.some((s) => lower.includes(s))
    })
    let house: House | undefined
    if (candidates.length === 1) {
      house = candidates[0]
    } else if (candidates.length > 1) {
      // several houses carry these words: keep one only if the full recorded name
      // (or its year) settles it, and only if it wins outright
      const scored = candidates.map((h) => {
        const textWords = new Set(words(text))
        let containment = 0
        for (const v of h.variants) {
          if (!v.length) continue
          containment = Math.max(containment, v.filter((t) => textWords.has(t)).length / v.length)
        }
        return { h, score: containment * 2 + (h.year && lower.includes(h.year) ? 0.5 : 0) }
      })
      scored.sort((a, b) => b.score - a.score)
      if (scored[0].score >= scored[1].score + 0.3 && scored[0].score >= 1.5) house = scored[0].h
    }
    if (house && !chosen.has(house)) chosen.set(house, em)
    if (!house) stats.unmatched += 1
  }
  for (const [house, em] of chosen) {
    const dir = posix.dirname(slug)
    const rel = posix.relative(dir === "." ? "" : dir, house.slug)
    const href = "./" + (rel || house.slug)
    Object.assign(em, {
      tagName: "a",
      properties: { href, className: ["internal", "src-house"] },
      children: [{ type: "element", tagName: "em", properties: {}, children: em.children }],
    })
    stats.linked += 1
  }
  if (chosen.size === 0) stats.without.push(text.slice(0, 72))
}

interface PageStats { notes: number; linked: number; unmatched: number; without: string[] }

export const SourceNotes: QuartzTransformerPlugin<Partial<SourceNotesOptions>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }
  let houses: House[] | null = null
  return {
    name: "SourceNotes",
    htmlPlugins(ctx) {
      return [
        () => {
          return async (tree: Root, file) => {
            const slug = file.data.slug
            if (!slug || classify(slug).k !== "manuscript") return
            if (!houses) {
              const root = join(ctx.argv.directory, opts.sourcesRoot)
              houses = existsSync(root) ? readHouses(root, opts.sourcesRoot) : []
            }
            if (!houses.length) return
            const stats: PageStats = { notes: 0, linked: 0, unmatched: 0, without: [] }

            // endnotes: the GFM footnote section
            const visitNotes = (node: Element): void => {
              for (const child of node.children) {
                if (!isEl(child)) continue
                if (child.tagName === "li") linkListItems(child, houses!, slug, stats)
                else visitNotes(child)
              }
            }
            // source lists: every list under a "Sources" heading
            let inSources = false
            const walkSections = (node: Element): void => {
              for (const child of node.children) {
                if (!isEl(child)) continue
                if (/^h[1-6]$/.test(child.tagName)) {
                  inSources = textOf(child).trim().toLowerCase() === "sources"
                  continue
                }
                if (inSources && (child.tagName === "ul" || child.tagName === "ol")) {
                  for (const item of child.children) if (isEl(item, "li")) linkListItems(item, houses!, slug, stats)
                  continue
                }
                walkSections(child)
              }
            }
            for (const child of tree.children) if (isEl(child)) { visitNotes(child); walkSections(child) }
            if (stats.notes > 0) {
              console.log(
                `[sourceNotes] ${slug}: ${stats.linked} of ${stats.notes} entries linked into their source houses` +
                  (stats.without.length ? ` (${stats.without.length} left as prose)` : ""),
              )
              for (const line of stats.without.slice(0, 12)) console.log(`[sourceNotes]   · ${line}…`)
            }
          }
        },
      ]
    },
  }
}
