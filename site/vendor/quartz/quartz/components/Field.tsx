import { ComponentChildren } from "preact"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, pathToRoot, resolveRelative } from "../util/path"
import { FNode, FieldModel, STATIONS, fieldModel, pad2, prettify, treePath } from "../util/essayField"
import { expressionLayer } from "../util/expressionIndex"
// @ts-ignore
import fieldScript from "./scripts/field.inline"
// @ts-ignore
import themeBoot from "./scripts/field-theme.inline"

/** Icons are symbols in the page shell (see renderPage); every use carries explicit pixels. */
export const Icon = ({ name, size = 16, style }: { name: string; size?: number; style?: string }) => (
  <svg width={size} height={size} style={style} aria-hidden="true">
    <use href={`#i-${name}`} />
  </svg>
)

const model = (p: QuartzComponentProps): FieldModel => fieldModel(p.allFiles)
const here = (p: QuartzComponentProps): FNode | undefined => model(p).bySlug.get(p.fileData.slug as string)

/* ───────── left sidebar ───────── */
export const FieldTitle = (() => {
  const C: QuartzComponent = ({ fileData, cfg }: QuartzComponentProps) => (
    <div class="page-title">
      <a class="page-title__mark" href={`${pathToRoot(fileData.slug!)}/../`} data-router-ignore="true" aria-label="O:I — the site">
        O<i>:</i>I
      </a>
      <a class="page-title__text" href={pathToRoot(fileData.slug!) + "/"} aria-label="Reading home">{cfg.pageTitle}</a>
      <button class="ibtn ibtn--sm sidebar-collapse" data-act="left-toggle" aria-label="Put the explorer away" type="button">
        <Icon name="chev" style="transform:scaleX(-1)" />
      </button>
      <button class="ibtn ibtn--sm drawer-close" data-act="drawer-close" aria-label="Close" type="button">
        <Icon name="x" />
      </button>
    </div>
  )
  return C
}) satisfies QuartzComponentConstructor

export const FieldSearch = (() => {
  const C: QuartzComponent = () => (
    <div class="search" id="search">
      <label class="search-bar">
        <Icon name="search" size={15} />
        <input id="q" type="search" placeholder="Search" autocomplete="off" spellcheck={false} aria-label="Search the essay" />
        <kbd id="q-kbd">⌘K</kbd>
        <button class="search-x" id="q-clear" hidden type="button" aria-label="Clear search"><Icon name="x" size={12} /></button>
      </label>
      <div class="shist" id="q-hist" hidden></div>
      <p class="sstatus" id="q-status" role="status" aria-live="polite"></p>
    </div>
  )
  return C
}) satisfies QuartzComponentConstructor

export const FieldExplorer = (() => {
  const C: QuartzComponent = ({ allFiles }: QuartzComponentProps) => (
    <>
      <div class="explorer" id="explorer">
        <div id="tree"></div>
        <div id="results" hidden></div>
      </div>
      <p class="left-foot" id="left-foot">
        {model({ allFiles } as QuartzComponentProps).nodes.length.toLocaleString("en-US")} pages<br />8 rooms · 48 movements
      </p>
    </>
  )
  return C
}) satisfies QuartzComponentConstructor

/* ───────── centre: tabs · view · theme (head) and breadcrumbs (foot) ───────── */
export const FieldHead = (() => {
  const C: QuartzComponent = () => (
    <header class="center-head">
      <button class="ibtn head-browse" data-act="browse-drawer" type="button" aria-label="Browse the essay"><Icon name="tree" size={18} /></button>
      <div class="tabs" id="tabs" role="tablist" aria-label="Open pages"></div>
      <div class="seg viewseg" role="group" aria-label="Library">
        <button type="button" data-view="library" aria-pressed="false" title="Library: the Expressions (L)"><Icon name="library" size={15} /><span>Library</span></button>
      </div>
      <button class="ibtn" data-act="theme" type="button" aria-label="Toggle light / dark">
        <span class="t-sun"><Icon name="sun" size={17} /></span>
        <span class="t-moon"><Icon name="moon" size={17} /></span>
      </button>
    </header>
  )
  C.beforeDOMLoaded = themeBoot
  C.afterDOMLoaded = fieldScript
  return C
}) satisfies QuartzComponentConstructor

export const FieldFoot = (() => {
  const C: QuartzComponent = (props: QuartzComponentProps) => {
    const m = model(props), n = here(props)
    const chain: { label: string; ni?: number }[] = n
      ? treePath(m, n.i)
      : // a folder listing: its own path, labelled the way the explorer labels folders
        [{ label: "Essay", ni: m.bySlug.get("index")?.i }, ...props.fileData.slug!.replace(/\/?index$/, "").split("/").filter(Boolean).map((seg) => ({ label: prettify(seg), ni: undefined }))]
    const slugOf = (ni: number) => m.nodes[ni].s as FullSlug
    return (
      <footer class="center-foot">
        <nav class="breadcrumb-container" id="crumbs" aria-label="Where you are">
          <ol>
            {chain.map((f, k) => {
              const last = k === chain.length - 1
              return (
                <li class={`cr${last ? " cr--cur" : ""}`}>
                  {f.ni != null && !last ? (
                    <a class="cr__l" href={resolveRelative(props.fileData.slug!, slugOf(f.ni))} data-ni={f.ni}>{f.label}</a>
                  ) : (
                    <span class="cr__l" aria-current={last ? "page" : undefined}>{f.label}</span>
                  )}
                  {!last && <i class="cr__sep">›</i>}
                </li>
              )
            })}
          </ol>
        </nav>
        <span class="head-pos" id="head-pos"></span>
      </footer>
    )
  }
  return C
}) satisfies QuartzComponentConstructor

/* ───────── right sidebar: graph · contents · connections ───────── */
export const FieldGraph = (() => {
  const C: QuartzComponent = () => (
    <section class="graph" id="graph">
      <div class="graph-head">
        <h3>Graph</h3>
        <span class="graph-count" id="graph-count" title="Direct connections"></span>
        <div class="top__spacer"></div>
        <button class="ibtn ibtn--sm" id="graph-filter" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Filter the graph" title="Filter · reach"><Icon name="sliders" /></button>
        <button class="ibtn ibtn--sm" id="graph-fit" type="button" aria-label="Fit and recentre" title="Fit"><Icon name="fit" /></button>
        <button class="ibtn ibtn--sm sidebar-collapse" data-act="right-toggle" type="button" aria-label="Put the field away"><Icon name="chev" /></button>
        <div class="gmenu" id="gmenu" hidden role="menu"></div>
      </div>
      <div class="graph-container" id="graph-container">
        <svg id="graph-svg" role="img" aria-label="Local graph: the page you are reading and what it links to"></svg>
        <div class="gcard" id="gcard" hidden></div>
      </div>
    </section>
  )
  return C
}) satisfies QuartzComponentConstructor

export const FieldContents = (() => {
  // Filled in the browser from the page's own headings (the 48 movements for the manuscript).
  const C: QuartzComponent = () => (
    <section class="toc" id="toc-box">
      <h3>On this page</h3>
      <div id="toc"></div>
    </section>
  )
  return C
}) satisfies QuartzComponentConstructor

export const FieldConnections = (() => {
  const C: QuartzComponent = () => (
    <section class="backlinks" id="conn"><div id="conn-body"></div></section>
  )
  return C
}) satisfies QuartzComponentConstructor

/* ───────── article head and pager (server-rendered, so no-JS readers get them too) ───────── */
function eyebrow(n: FNode, m: FieldModel): ComponentChildren {
  const room = n.room != null ? m.rooms[n.room] : undefined
  if (n.k === "movement") return <><span>{n.sec}</span><span>Movement {n.m} of 48</span></>
  if (n.k === "room") return <><span>{n.sec}</span><span>Room {pad2(n.room!)}</span></>
  if (n.k === "reading" || n.k === "alignment") return <><span>{room?.sec}</span><span>{room?.title}</span></>
  if (n.k === "manuscript") return <><span>Manuscript</span><span>{n.mvs && n.mvs.length !== 48 ? "§0/1" : "M01–M48"}</span></>
  if (n.k === "argument") return <><span>Argument</span><span>{n.coord}</span></>
  const ch = treePath(m, n.i).slice(0, -1), st = STATIONS[n.st]
  const tail = ch.length ? ch[ch.length - 1].label : ""
  return <><span>{st.name}</span>{tail && tail !== st.name ? <span>{tail}</span> : n.k === "core" ? <span>The relation itself</span> : null}</>
}

export const ArticleHead = (() => {
  const C: QuartzComponent = (props: QuartzComponentProps) => {
    const m = model(props), n = here(props)
    if (!n) return null
    // pages whose title is only their file name ("P1-CANONICAL-ALIGNMENT") read as their label
    const title = ["movement", "room", "reading", "alignment"].includes(n.k) || /^[A-Z0-9-]+$/.test(n.t) ? n.lab : n.t
    const parts = n.t.split(" — ")
    const deck = n.k === "room" ? parts.slice(2).join(" — ") : n.k === "reading" ? parts.slice(1).join(" — ") : ""
    const mins = Math.max(1, Math.round(n.w / 230))
    const expressions = expressionLayer().byPage.get(n.s) ?? []
    const cites = m.links.filter(([a]) => a === n.i).length, citedBy = m.links.filter(([, b]) => b === n.i).length
    return (
      <header class="ahead">
        <p class="ahead__eyebrow">{eyebrow(n, m)}</p>
        <h1 class={`ahead__title${title.length > 52 ? " ahead__title--long" : ""}`}>{title}</h1>
        {deck && <p class="ahead__deck">{deck}</p>}
        <p class="ahead__meta">
          <span>{n.w.toLocaleString("en-US")} words</span>
          <span>{mins >= 120 ? `${Math.round(mins / 60)} h read` : `${mins} min`}</span>
          <span>cites {cites}</span>
          <span>cited by {citedBy}</span>
        </p>
        {expressions.length > 0 && (
          <p class="ahead__x" aria-label="Expressions of this page">
            {expressions.slice(0, 3).map((e) => (
              <a class="xchip" data-x={e.id} href={`${pathToRoot(props.fileData.slug!)}/../expression.html?x=${e.id}`} data-router-ignore="true">
                <svg width="13" height="13" aria-hidden="true"><use href="#i-expression" /></svg>
                <span>{e.title.replace(/^Return of Zero\s+[—·]\s+/, "").replace(/^Return of Zero · Room \d of \d · /, "")}</span>
                <b>{e.scenes.length} scenes</b>
              </a>
            ))}
            {expressions.length > 3 && <span class="xchip xchip--more">+{expressions.length - 3}</span>}
          </p>
        )}
      </header>
    )
  }
  return C
}) satisfies QuartzComponentConstructor

export const Pager = (() => {
  const C: QuartzComponent = (props: QuartzComponentProps) => {
    const m = model(props), n = here(props)
    if (!n) return null
    let prev: FNode | undefined, next: FNode | undefined, label = "Movement"
    if (n.k === "movement") { prev = m.nodes[m.moves[n.m! - 1]?.i]; next = m.nodes[m.moves[n.m! + 1]?.i] }
    else if (n.k === "room") { prev = m.nodes[m.rooms[n.room! - 1]?.i]; next = m.nodes[m.rooms[n.room! + 1]?.i]; label = "Room" }
    if (!prev && !next) return null
    const href = (x: FNode) => resolveRelative(props.fileData.slug!, x.s as FullSlug)
    const cell = (x: FNode | undefined, dir: "prev" | "next") =>
      x ? (
        <a class={`pager__${dir}`} href={href(x)}>
          <span>{dir === "prev" ? "← " : ""}{label} {x.m ?? ""}{x.k === "room" ? x.sec : ""}{dir === "next" ? " →" : ""}</span>
          <b>{x.lab}</b>
        </a>
      ) : <span></span>
    const room = n.k === "movement" ? m.rooms[n.room!] : undefined
    return (
      <nav class="pager" aria-label="Movement navigation">
        {cell(prev, "prev")}
        {room ? <a class="pager__room" href={resolveRelative(props.fileData.slug!, room.slug as FullSlug)}>The room · {room.sec}</a> : <span></span>}
        {cell(next, "next")}
      </nav>
    )
  }
  return C
}) satisfies QuartzComponentConstructor
