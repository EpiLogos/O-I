import { ComponentChildren } from "preact"
import { Element, Root, RootContent } from "hast"
import { htmlToJsx } from "../../util/jsx"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import { classify } from "../../util/essayField"

/**
 * The corpus carries authoring scaffolding at the top of its pages: the first-level
 * heading (the page head renders the title), and "Write here / Where you are / Open beside it"
 * pointers plus a "Movement 16 of 48 · This room · ← Previous · Next →" line. The breadcrumbs
 * and pager do all of those jobs, so the reading projection leaves them out.
 */
const textOf = (n: RootContent | Element): string =>
  n.type === "text" ? n.value : n.type === "element" ? n.children.map(textOf).join("") : ""
const SCAFFOLD = /^(Write here|Where you are|Open beside it)\s*:|^Movement \d+ of 48\s*·/

const isEl = (n: RootContent | undefined, tag?: string): n is Element =>
  !!n && n.type === "element" && (!tag || n.tagName === tag)
const solid = (n: Element) => n.children.filter((c) => !(c.type === "text" && !c.value.trim()))

/** An authored figure is an image paragraph followed by its caption paragraph (or blockquote). */
function figures(kids: RootContent[]): RootContent[] {
  const out: RootContent[] = []
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i]
    const img = isEl(n, "p") ? solid(n) : []
    if (img.length !== 1 || !isEl(img[0], "img")) { out.push(n); continue }
    let j = i + 1
    while (j < kids.length && kids[j].type === "text") j++
    const next = kids[j]
    const lead = isEl(next, "p") ? solid(next)[0] : undefined
    const caption = isEl(next, "p") && isEl(lead, "em") ? next.children : isEl(next, "blockquote") ? next.children : null
    const src = String(img[0].properties?.src ?? "")
    out.push({
      type: "element",
      tagName: "figure",
      properties: { className: ["fig"], "data-kind": /\.svg(\?|$)/i.test(src) ? "svg" : "photo" },
      children: [img[0], ...(caption ? [{ type: "element", tagName: "figcaption", properties: {}, children: caption } as Element] : [])],
    })
    if (caption) i = j
  }
  return out
}

function projection(tree: Root): Root {
  const kids = tree.children.slice()
  const firstEl = kids.findIndex((n) => n.type === "element")
  if (firstEl >= 0 && (kids[firstEl] as Element).tagName === "h1") kids.splice(firstEl, 1)
  return {
    ...tree,
    children: figures(kids.filter((n) => !(n.type === "element" && n.tagName === "p" && SCAFFOLD.test(textOf(n).trim())))),
  }
}

const Content: QuartzComponent = ({ fileData, tree }: QuartzComponentProps) => {
  const content = htmlToJsx(fileData.filePath!, projection(tree as Root)) as ComponentChildren
  const classes: string[] = fileData.frontmatter?.cssclasses ?? []
  const ms = classify(fileData.slug!).k === "manuscript" ? ["prose--ms"] : []
  const classString = ["popover-hint", "prose", ...ms, ...classes].join(" ")
  return <article class={classString}>{content}</article>
}

export default (() => Content) satisfies QuartzComponentConstructor
