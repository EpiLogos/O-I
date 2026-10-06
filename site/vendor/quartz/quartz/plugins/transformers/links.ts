import { QuartzTransformerPlugin } from "../types"
import {
  type FullSlug,
  type RelativeURL,
  type SimpleSlug,
  type TransformOptions,
  stripSlashes,
  simplifySlug,
  splitAnchor,
  transformLink,
  resolveRelative,
  slugifyFilePath,
  type FilePath,
} from "../../util/path"
import path from "path"
import fs from "fs"
import { visit } from "unist-util-visit"
import isAbsoluteUrl from "is-absolute-url"
import { Root } from "hast"

interface Options {
  /** How to resolve Markdown paths */
  markdownLinkResolution: TransformOptions["strategy"]
  /** Strips folders from a link so that it looks nice */
  prettyLinks: boolean
  openLinksInNewTab: boolean
  lazyLoad: boolean
  externalLinkIcon: boolean
}

const defaultOptions: Options = {
  markdownLinkResolution: "absolute",
  prettyLinks: true,
  openLinksInNewTab: false,
  lazyLoad: false,
  externalLinkIcon: true,
}


/** Intrinsic pixel size of a staged image (png/jpeg/gif/webp/svg), read from its header. */
function imageSize(file: string): { width: number; height: number } | null {
  try {
    const buf = fs.readFileSync(file)
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
    if (buf.length > 10 && buf.toString("ascii", 0, 3) === "GIF") return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
    if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
      const kind = buf.toString("ascii", 12, 16)
      if (kind === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) }
      if (kind === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
      if (kind === "VP8L") { const b = buf.readUInt32LE(21); return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) } }
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let at = 2
      while (at + 9 < buf.length) {
        if (buf[at] !== 0xff) { at++; continue }
        const marker = buf[at + 1]
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: buf.readUInt16BE(at + 5), width: buf.readUInt16BE(at + 7) }
        at += 2 + buf.readUInt16BE(at + 2)
      }
      return null
    }
    const head = buf.toString("utf8", 0, 1200)
    if (/<svg[\s>]/.test(head)) {
      const box = head.match(/viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/)
      if (box) return { width: Math.round(parseFloat(box[1])), height: Math.round(parseFloat(box[2])) }
    }
  } catch {}
  return null
}

/**
 * Corpus links are written as true relative file paths (`../ROOM-02-x.md`, `15-x.md#a`).
 * Quartz reads them from the vault root unless the file name is unique, which breaks
 * most of them. Resolve them against the linking page's own folder first.
 */
export function resolveRelativeSlug(cur: FullSlug, dest: string, slugs: Set<string>): string | null {
  const [fp, anchor] = splitAnchor(decodeURI(dest))
  if (!fp || /^[a-z][a-z0-9+.-]*:/i.test(fp)) return null
  if (!/\.md$/i.test(fp) && !/^\.{1,2}\//.test(fp)) return null
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(cur), fp.replace(/\/$/, "")))
  if (joined.startsWith("..")) return null
  const slug = slugifyFilePath((joined.replace(/\.md$/i, "") + ".md") as FilePath)
  const hit = [slug, slug + "/index", slug === "README" ? "index" : slug].find((c) => slugs.has(c))
  if (!hit) return null
  return resolveRelative(cur, hit as FullSlug) + anchor
}

export const CrawlLinks: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }
  return {
    name: "LinkProcessing",
    htmlPlugins(ctx) {
      const slugSet = new Set<string>(ctx.allSlugs)
      return [
        () => {
          return (tree: Root, file) => {
            const curSlug = simplifySlug(file.data.slug!)
            const outgoing: Set<SimpleSlug> = new Set()

            const transformOptions: TransformOptions = {
              strategy: opts.markdownLinkResolution,
              allSlugs: ctx.allSlugs,
            }

            visit(tree, "element", (node, _index, _parent) => {
              // rewrite all links
              if (
                node.tagName === "a" &&
                node.properties &&
                typeof node.properties.href === "string"
              ) {
                let dest = node.properties.href as RelativeURL
                const classes = (node.properties.className ?? []) as string[]
                const isExternal = isAbsoluteUrl(dest, { httpOnly: false })
                classes.push(isExternal ? "external" : "internal")

                if (isExternal && opts.externalLinkIcon) {
                  node.children.push({
                    type: "element",
                    tagName: "svg",
                    properties: {
                      "aria-hidden": "true",
                      class: "external-icon",
                      style: "max-width:0.8em;max-height:0.8em",
                      viewBox: "0 0 512 512",
                    },
                    children: [
                      {
                        type: "element",
                        tagName: "path",
                        properties: {
                          d: "M320 0H288V64h32 82.7L201.4 265.4 178.7 288 224 333.3l22.6-22.6L448 109.3V192v32h64V192 32 0H480 320zM32 32H0V64 480v32H32 456h32V480 352 320H424v32 96H64V96h96 32V32H160 32z",
                        },
                        children: [],
                      },
                    ],
                  })
                }

                // Check if the link has alias text
                if (
                  node.children.length === 1 &&
                  node.children[0].type === "text" &&
                  node.children[0].value !== dest
                ) {
                  // Add the 'alias' class if the text content is not the same as the href
                  classes.push("alias")
                }
                node.properties.className = classes

                if (isExternal && opts.openLinksInNewTab) {
                  node.properties.target = "_blank"
                }

                // don't process external links or intra-document anchors
                const isInternal = !(
                  isAbsoluteUrl(dest, { httpOnly: false }) || dest.startsWith("#")
                )
                if (isInternal) {
                  dest = node.properties.href = (resolveRelativeSlug(file.data.slug!, dest, slugSet) ??
                    transformLink(file.data.slug!, dest, transformOptions)) as RelativeURL

                  // url.resolve is considered legacy
                  // WHATWG equivalent https://nodejs.dev/en/api/v18/url/#urlresolvefrom-to
                  const url = new URL(dest, "https://base.com/" + stripSlashes(curSlug, true))
                  const canonicalDest = url.pathname
                  let [destCanonical, _destAnchor] = splitAnchor(canonicalDest)
                  if (destCanonical.endsWith("/")) {
                    destCanonical += "index"
                  }

                  // need to decodeURIComponent here as WHATWG URL percent-encodes everything
                  const full = decodeURIComponent(stripSlashes(destCanonical, true)) as FullSlug
                  const simple = simplifySlug(full)
                  outgoing.add(simple)
                  node.properties["data-slug"] = full
                }

                // rewrite link internals if prettylinks is on
                if (
                  opts.prettyLinks &&
                  isInternal &&
                  !classes.includes("alias") &&
                  node.children.length === 1 &&
                  node.children[0].type === "text" &&
                  !node.children[0].value.startsWith("#")
                ) {
                  node.children[0].value = path.basename(node.children[0].value)
                }
              }

              // transform all other resources that may use links
              if (
                ["img", "video", "audio", "iframe"].includes(node.tagName) &&
                node.properties &&
                typeof node.properties.src === "string"
              ) {
                if (opts.lazyLoad) {
                  node.properties.loading = "lazy"
                }

                if (!isAbsoluteUrl(node.properties.src, { httpOnly: false })) {
                  let dest = node.properties.src as RelativeURL
                  // A path that already resolves to a staged file, relative to the page's
                  // own folder, is correct as written (pages and assets publish at their
                  // source paths). Only bare names fall back to link resolution.
                  const clean = decodeURIComponent(dest.split(/[?#]/)[0])
                  const found = file.data.relativePath
                    ? path.join(ctx.argv.directory, path.dirname(file.data.relativePath), clean)
                    : null
                  if (found && fs.existsSync(found)) {
                    if (node.tagName === "img") {
                      const size = imageSize(found)
                      if (size && node.properties.width === undefined) {
                        node.properties.width = size.width
                        node.properties.height = size.height
                      }
                    }
                  } else {
                    dest = node.properties.src = transformLink(file.data.slug!, dest, transformOptions)
                    node.properties.src = dest
                  }
                }
              }
            })

            file.data.links = [...outgoing]
          }
        },
      ]
    },
  }
}

declare module "vfile" {
  interface DataMap {
    links: SimpleSlug[]
  }
}
