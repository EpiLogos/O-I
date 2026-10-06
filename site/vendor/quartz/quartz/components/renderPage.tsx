import { render } from "preact-render-to-string"
import { QuartzComponent, QuartzComponentProps } from "./types"
import BodyConstructor from "./Body"
import { JSResourceToScriptElement, StaticResources } from "../util/resources"
import { FullSlug, RelativeURL, joinSegments, normalizeHastElement } from "../util/path"
import { clone } from "../util/clone"
import { visit } from "unist-util-visit"
import { Root, Element, ElementContent } from "hast"
import { GlobalConfiguration } from "../cfg"
import { i18n } from "../i18n"
import { styleText } from "util"

interface RenderComponents {
  head: QuartzComponent
  header: QuartzComponent[]
  beforeBody: QuartzComponent[]
  pageBody: QuartzComponent
  afterBody: QuartzComponent[]
  left: QuartzComponent[]
  right: QuartzComponent[]
  footer: QuartzComponent
}

const headerRegex = new RegExp(/h[1-6]/)
export function pageResources(
  baseDir: FullSlug | RelativeURL,
  staticResources: StaticResources,
): StaticResources {
  // Absolute URLs, resolved when the page first runs: client-side navigation changes
  // the document URL, and a relative path would then point at the wrong folder.
  const contentIndexPath = joinSegments(baseDir, "static/contentIndex.json")
  const fieldIndexPath = joinSegments(baseDir, "static/fieldIndex.json")
  // The structure index (graph, explorer, breadcrumbs) is small and needed at once. The full-text
  // index is 12 MB: it is a thenable, so nothing is fetched until search first awaits it.
  const contentIndexScript = `const __cx = (p) => new URL(p, location.href).href
const __fieldUrl = __cx("${fieldIndexPath}"), __textUrl = __cx("${contentIndexPath}")
const fieldData = fetch(__fieldUrl).then(data => data.json())
let __fullText
const fetchData = {
  then(resolve, reject) {
    __fullText ||= fetch(__textUrl).then(data => data.json()).catch((err) => { __fullText = undefined; throw err })
    return __fullText.then(resolve, reject)
  },
}`

  const resources: StaticResources = {
    css: [
      {
        content: joinSegments(baseDir, "index.css"),
      },
      ...staticResources.css,
    ],
    js: [
      {
        src: joinSegments(baseDir, "prescript.js"),
        loadTime: "beforeDOMReady",
        contentType: "external",
      },
      {
        loadTime: "beforeDOMReady",
        contentType: "inline",
        spaPreserve: true,
        script: contentIndexScript,
      },
      ...staticResources.js,
    ],
    additionalHead: staticResources.additionalHead,
  }

  resources.js.push({
    src: joinSegments(baseDir, "postscript.js"),
    loadTime: "afterDOMReady",
    moduleType: "module",
    contentType: "external",
  })

  return resources
}

function renderTranscludes(
  root: Root,
  cfg: GlobalConfiguration,
  slug: FullSlug,
  componentData: QuartzComponentProps,
  visited: Set<FullSlug>,
) {
  // process transcludes in componentData
  visit(root, "element", (node, _index, _parent) => {
    if (node.tagName === "blockquote") {
      const classNames = (node.properties?.className ?? []) as string[]
      if (classNames.includes("transclude")) {
        const inner = node.children[0] as Element
        const transcludeTarget = (inner.properties["data-slug"] ?? slug) as FullSlug
        if (visited.has(transcludeTarget)) {
          console.warn(
            styleText(
              "yellow",
              `Warning: Skipping circular transclusion: ${slug} -> ${transcludeTarget}`,
            ),
          )
          node.children = [
            {
              type: "element",
              tagName: "p",
              properties: { style: "color: var(--secondary);" },
              children: [
                {
                  type: "text",
                  value: `Circular transclusion detected: ${transcludeTarget}`,
                },
              ],
            },
          ]
          return
        }
        visited.add(transcludeTarget)

        const page = componentData.allFiles.find((f) => f.slug === transcludeTarget)
        if (!page) {
          return
        }

        let blockRef = node.properties.dataBlock as string | undefined
        if (blockRef?.startsWith("#^")) {
          // block transclude
          blockRef = blockRef.slice("#^".length)
          let blockNode = page.blocks?.[blockRef]
          if (blockNode) {
            if (blockNode.tagName === "li") {
              blockNode = {
                type: "element",
                tagName: "ul",
                properties: {},
                children: [blockNode],
              }
            }

            node.children = [
              normalizeHastElement(blockNode, slug, transcludeTarget),
              {
                type: "element",
                tagName: "a",
                properties: { href: inner.properties?.href, class: ["internal", "transclude-src"] },
                children: [
                  { type: "text", value: i18n(cfg.locale).components.transcludes.linkToOriginal },
                ],
              },
            ]
          }
        } else if (blockRef?.startsWith("#") && page.htmlAst) {
          // header transclude
          blockRef = blockRef.slice(1)
          let startIdx = undefined
          let startDepth = undefined
          let endIdx = undefined
          for (const [i, el] of page.htmlAst.children.entries()) {
            // skip non-headers
            if (!(el.type === "element" && el.tagName.match(headerRegex))) continue
            const depth = Number(el.tagName.substring(1))

            // lookin for our blockref
            if (startIdx === undefined || startDepth === undefined) {
              // skip until we find the blockref that matches
              if (el.properties?.id === blockRef) {
                startIdx = i
                startDepth = depth
              }
            } else if (depth <= startDepth) {
              // looking for new header that is same level or higher
              endIdx = i
              break
            }
          }

          if (startIdx === undefined) {
            return
          }

          node.children = [
            ...(page.htmlAst.children.slice(startIdx, endIdx) as ElementContent[]).map((child) =>
              normalizeHastElement(child as Element, slug, transcludeTarget),
            ),
            {
              type: "element",
              tagName: "a",
              properties: { href: inner.properties?.href, class: ["internal", "transclude-src"] },
              children: [
                { type: "text", value: i18n(cfg.locale).components.transcludes.linkToOriginal },
              ],
            },
          ]
        } else if (page.htmlAst) {
          // page transclude
          node.children = [
            {
              type: "element",
              tagName: "h1",
              properties: {},
              children: [
                {
                  type: "text",
                  value:
                    page.frontmatter?.title ??
                    i18n(cfg.locale).components.transcludes.transcludeOf({
                      targetSlug: page.slug!,
                    }),
                },
              ],
            },
            ...(page.htmlAst.children as ElementContent[]).map((child) =>
              normalizeHastElement(child as Element, slug, transcludeTarget),
            ),
            {
              type: "element",
              tagName: "a",
              properties: { href: inner.properties?.href, class: ["internal", "transclude-src"] },
              children: [
                { type: "text", value: i18n(cfg.locale).components.transcludes.linkToOriginal },
              ],
            },
          ]
        }
      }
    }
  })
}

export function renderPage(
  cfg: GlobalConfiguration,
  slug: FullSlug,
  componentData: QuartzComponentProps,
  components: RenderComponents,
  pageResources: StaticResources,
): string {
  // make a deep copy of the tree so we don't remove the transclusion references
  // for the file cached in contentMap in build.ts
  const root = clone(componentData.tree) as Root
  const visited = new Set<FullSlug>([slug])
  renderTranscludes(root, cfg, slug, componentData, visited)

  // set componentData.tree to the edited html that has transclusions rendered
  componentData.tree = root

  const {
    head: Head,
    header,
    beforeBody,
    pageBody: Content,
    afterBody,
    left,
    right,
    footer: Footer,
  } = components
  const Body = BodyConstructor()

  const lang = componentData.fileData.frontmatter?.lang ?? cfg.locale?.split("-")[0] ?? "en"
  const direction = i18n(cfg.locale).direction ?? "ltr"
  const Icons = () => (
    <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
      <symbol id="i-essay" viewBox="0 0 20 20"><path d="M5 3.5h10v13H5z M7.5 7h5 M7.5 10h5 M7.5 13h3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></symbol>
      <symbol id="i-split" viewBox="0 0 20 20"><path d="M3 4.5h14v11H3z M10 4.5v11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /></symbol>
      <symbol id="i-field" viewBox="0 0 20 20"><g fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="5" cy="14" r="1.8" /><circle cx="10.5" cy="5.5" r="1.8" /><circle cx="15.5" cy="13" r="1.8" /><path d="M6.4 12.7 9.2 7M12 6.7l2.6 4.7M6.8 14.2h6.9" /></g></symbol>
      <symbol id="i-search" viewBox="0 0 20 20"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8.8" cy="8.8" r="5" /><path d="m12.6 12.6 4 4" /></g></symbol>
      <symbol id="i-tree" viewBox="0 0 20 20"><path d="M4 4.5h5M7 9h9M7 13.5h9M4 4.5v9M4 9h3M4 13.5h3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></symbol>
      <symbol id="i-sun" viewBox="0 0 20 20"><g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="10" cy="10" r="3.2" /><path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3 6 14M14 6l1.3-1.3" /></g></symbol>
      <symbol id="i-moon" viewBox="0 0 20 20"><path d="M15.5 12.4A6.2 6.2 0 0 1 7.6 4.5a6.2 6.2 0 1 0 7.9 7.9z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /></symbol>
      <symbol id="i-x" viewBox="0 0 20 20"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></symbol>
      <symbol id="i-chev" viewBox="0 0 20 20"><path d="m7 4.5 5.5 5.5L7 15.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></symbol>
      <symbol id="i-sliders" viewBox="0 0 20 20"><g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3.5 6h6M13.5 6h3M3.5 14h2M9.5 14h7" /><circle cx="11.5" cy="6" r="1.8" /><circle cx="7.5" cy="14" r="1.8" /></g></symbol>
      <symbol id="i-fit" viewBox="0 0 20 20"><path d="M3.5 7.5v-4h4M16.5 7.5v-4h-4M3.5 12.5v4h4M16.5 12.5v4h-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></symbol>
      <symbol id="i-expression" viewBox="0 0 20 20"><g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M10 2.8 17 7v6L10 17.2 3 13V7z" /><path d="M3.3 7.2 10 11l6.7-3.8M10 11v6" stroke-linecap="round" /></g></symbol>
      <symbol id="i-library" viewBox="0 0 20 20"><g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><rect x="3" y="3.5" width="5.5" height="5.5" rx="1" /><rect x="11.5" y="3.5" width="5.5" height="5.5" rx="1" /><rect x="3" y="11" width="5.5" height="5.5" rx="1" /><rect x="11.5" y="11" width="5.5" height="5.5" rx="1" /></g></symbol>
      <symbol id="i-external" viewBox="0 0 20 20"><path d="M8 4.5H4.5v11h11V12M11 4.5h4.5V9M15.5 4.5 9 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></symbol>
    </svg>
  )
  const doc = (
    <html lang={lang} dir={direction}>
      <Head {...componentData} />
      <body data-slug={slug}>
        <Icons />
        {/* The page is Quartz's own anatomy: left sidebar, centre, right sidebar. The right sidebar is the field. */}
        <div id="quartz-root" class={`page${right.length === 0 ? " no-field" : ""}`} data-view="essay" data-left="open" data-drawer="closed">
          <a class="skip" href="#essay-pane">Skip to the essay</a>
          <Body {...componentData}>
            <aside class="left sidebar" id="left" aria-label="Browse">
              <div class="rail-left">
                <button class="ibtn" data-act="left-toggle" type="button" aria-label="Open the explorer"><svg width="18" height="18" aria-hidden="true"><use href="#i-tree" /></svg></button>
                <button class="ibtn" data-act="search" type="button" aria-label="Search"><svg width="18" height="18" aria-hidden="true"><use href="#i-search" /></svg></button>
              </div>
              <div class="left-inner">
                {left.map((BodyComponent) => (
                  <BodyComponent {...componentData} />
                ))}
              </div>
            </aside>
            <main class="center" id="center">
              {header.map((HeaderComponent) => (
                <HeaderComponent {...componentData} />
              ))}
              <div class="progress" aria-hidden="true"><i id="progress"></i></div>
              <div class="center-scroll" id="scroller">
                <div class="article pane" id="essay-pane">
                  <div class="popover-hint article-head">
                    {beforeBody.map((BodyComponent) => (
                      <BodyComponent {...componentData} />
                    ))}
                  </div>
                  <Content {...componentData} />
                  <div class="page-footer">
                    {afterBody.map((BodyComponent) => (
                      <BodyComponent {...componentData} />
                    ))}
                  </div>
                </div>
                <div class="article pane" id="tangent-pane" hidden></div>
                <div class="library pane" id="library-pane" hidden></div>
              </div>
              <nav class="mrail" id="mrail" aria-label="The 48 movements" hidden></nav>
              <Footer {...componentData} />
            </main>
            <aside class="right sidebar" id="right" aria-label="The field">
              <div class="rsz" id="rsz" role="separator" aria-orientation="vertical" aria-label="Resize the field panel (drag, or arrow keys; double-click to reset)" tabindex="0"></div>
              <div class="right-inner">
                {right.map((BodyComponent) => (
                  <BodyComponent {...componentData} />
                ))}
              </div>
              <div class="rail-right">
                <button class="ibtn" data-act="right-toggle" type="button" aria-label="Open the field"><svg width="18" height="18" aria-hidden="true"><use href="#i-field" /></svg></button>
                <span class="rail-right__t">The field</span>
              </div>
            </aside>
          </Body>
          <nav class="bottombar" aria-label="Panels">
            <button type="button" data-view="essay" aria-pressed="true"><svg width="18" height="18" aria-hidden="true"><use href="#i-essay" /></svg><span>Essay</span></button>
            <button type="button" data-view="field" aria-pressed="false"><svg width="18" height="18" aria-hidden="true"><use href="#i-field" /></svg><span>Field</span></button>
            <button type="button" data-view="library" aria-pressed="false"><svg width="18" height="18" aria-hidden="true"><use href="#i-library" /></svg><span>Library</span></button>
            <button type="button" data-act="search"><svg width="18" height="18" aria-hidden="true"><use href="#i-search" /></svg><span>Search</span></button>
          </nav>
          <div class="scrim" id="scrim"></div>
          <dialog class="lightbox" id="lightbox"></dialog>
        </div>
      </body>
      {pageResources.js
        .filter((resource) => resource.loadTime === "afterDOMReady")
        .map((res) => JSResourceToScriptElement(res, true))}
    </html>
  )

  return "<!DOCTYPE html>\n" + render(doc)
}
