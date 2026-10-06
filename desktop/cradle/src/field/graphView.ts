/**
 * The local graph — a live force layout you can handle. A port of the site's
 * (site/vendor/quartz/quartz/components/scripts/field/graph.ts), with the same physics, gestures and
 * labels, re-seated on the field's own state instead of the site's globals:
 *
 *   click        selects: the neighbourhood lights, the rest dims, the card offers the page and its Expression
 *   double-click opens the page as a tangent (Enter does the same; Shift/Ctrl/Cmd+Enter turns the main page)
 *   drag a node  it follows the pointer, the layout re-settles live; it stays where you drop it
 *                (shift-drag, or `p`, pins it for good; shift-click on a pinned node lets it go)
 *   drag nothing pan · wheel / pinch zoom at the cursor · two fingers pinch + pan · + − fit buttons
 *   keys         Tab into the graph, arrows walk between nodes, Enter opens, Esc lets go, 0 fits, + − zoom, p pins
 *
 * Selection is the encounter's (`selected`), not the graph's: a click calls `deps.select(ref)` — the same
 * `select` operation a keyboard or an agent uses — and the graph repaints from `setSelected`. Opening calls
 * `deps.openTangent` / `deps.openMain` / `deps.openExpression`: the graph never navigates by itself.
 * What is drawn comes from `planGraph` (filterModel.ts), the same neighbourhood the connections list shows.
 *
 * Imperative on purpose (one SVG, one simulation, ticks only move attributes); React mounts and tears it down.
 */
import type {CorpusIndex} from "./corpusIndex";
import type {FieldFilter, FieldRef} from "./model";
import {planGraph} from "./filterModel";

export interface GraphDeps {
  box: HTMLElement; svg: SVGSVGElement; card: HTMLElement;
  index: () => CorpusIndex;
  filter: () => FieldFilter;
  visited: (ref: FieldRef) => boolean;
  expressionsOf: (ref: FieldRef) => FieldRef[];
  select: (ref: FieldRef | null) => void;
  openTangent: (ref: FieldRef) => void;
  openMain: (ref: FieldRef) => void;
  openExpression: (ref: FieldRef) => void;
  hover: (ref: FieldRef | null) => void;
}
export interface GraphHandle {
  setFocus(ref: FieldRef | null): void;
  setSelected(ref: FieldRef | null): void;
  setHits(hits: ReadonlySet<FieldRef> | null): void;
  setHover(ref: FieldRef | null): void;
  /** The filter changed: lay out again. */
  refresh(): void;
  resize(): void;
  fit(): void;
  reset(): void;
  destroy(): void;
  /** Handle for tests and measuring; not part of the behaviour. */
  probe: { nodes(): any[]; links(): any[]; view(): { k: number; x: number; y: number }; selected(): FieldRef | null; size(): { W: number; H: number }; moving(): boolean; drawn(): FieldRef[]; count(): number };
}

const MIN_K = 0.3, MAX_K = 6;
const ZOOM_BOX = [4, 4, 48, 116];     // the zoom buttons, in the graph's own pixels: labels keep clear of it
const NS = "http://www.w3.org/2000/svg";
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]!);

export function mountGraph(deps: GraphDeps): GraphHandle {
  const {box, svg, card} = deps;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let W = 0, H = 0, focusRef: FieldRef | null = null;
  let nodes: any[] = [], links: any[] = [], byId = new Map<FieldRef, any>(), sectors: any[] = [];
  let view = {k: 1, x: 0, y: 0};
  let lastTap: { n: any; t: number } = {n: null, t: 0};
  let alpha = 0, heat = 0, raf = 0, vraf = 0, lraf = 0, sel: any = null, hot: any = null, cx = 0, cy = 0, dead = false;
  let gView: SVGGElement, gSec: SVGGElement, gEdge: SVGGElement, gNode: SVGGElement, springs = false, lastMode = "mouse", tween = false;
  let override: FieldRef[] | null = null, selectedRef: FieldRef | null = null, hits: ReadonlySet<FieldRef> | null = null, drawnCount = 0;
  const pts = new Map<number, { x: number; y: number }>();
  let gesture: any = null;
  let live: HTMLElement, zoomBox: HTMLElement;
  const disposers: (() => void)[] = [];
  const listen = (el: EventTarget | null, type: string, fn: (e: any) => void, opts?: AddEventListenerOptions | boolean) => {
    if (!el) return; el.addEventListener(type, fn, opts); disposers.push(() => el.removeEventListener(type, fn, opts));
  };
  const idx = () => deps.index();
  const node = (ref: FieldRef) => idx().node(ref)!;

  const radius = (ref: FieldRef) => Math.min(8, 3 + Math.sqrt(idx().degree(ref)) * 0.38);
  const el = (tag: string, attrs: Record<string, string | number> = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, String(attrs[k])); return e; };
  const shortLabel = (ref: FieldRef) => { const nd = node(ref); return ((nd.coord ? nd.coord + " · " : "") + nd.label).replace(/^(.{27}).+$/, "$1…"); };
  const tone = (ref: FieldRef) => `var(--c-${idx().group(node(ref).group)?.tone ?? node(ref).group})`;

  /* ----- build ----- */
  function build() {
    gesture = null; pts.clear(); sel = null; hot = null; lastTap = {n: null, t: 0}; card.hidden = true; svg.classList.remove("is-dragging", "has-sel", "has-hot");
    const index = idx();
    if (!W || !H || focusRef == null || !index.has(focusRef)) { if (svg.firstChild) svg.innerHTML = ""; nodes = []; links = []; drawnCount = 0; return; }
    const plan = planGraph(index, focusRef, deps.filter(), W * H, override);
    const {direct, second, nb} = plan;
    cx = W / 2; cy = H / 2;
    const Rx = Math.max(60, W / 2 - 58), Ry = Math.max(60, H / 2 - 34);
    const out = new Set(nb.out), inn = new Set(nb.in);
    const groups = index.groups.map(g => ({g: g.id, ids: direct.filter(r => node(r).group === g.id)})).filter(g => g.ids.length);
    const GAP = 14, total = 360 - GAP * groups.length, wt = (g: any) => Math.pow(g.ids.length, 0.8), wsum = groups.reduce((s, g) => s + wt(g), 0);
    let a = -90 + GAP / 2;
    nodes = []; links = []; byId = new Map(); sectors = []; springs = false;
    const fnode = {ref: focusRef, x: cx, y: cy, tx: cx, ty: cy, fx: null, fy: null, vx: 0, vy: 0, r: 7, depth: 0, focus: true, homeX: cx, homeY: cy, mass: 1, anchor: 1} as any;
    nodes.push(fnode); byId.set(focusRef, fnode);
    const have = new Set<string>();
    const link = (p: any, q: any, depth: number, kind: string, strength: number) => { const key = p.ref < q.ref ? p.ref + "|" + q.ref : q.ref + "|" + p.ref; if (have.has(key)) return; have.add(key); links.push({a: p, b: q, depth, kind, k: strength, len: 0}); };
    for (const g of groups) {
      const span = Math.max(14, (total * wt(g)) / wsum);
      sectors.push({g: g.g, a0: a, a1: a + span, n: g.ids.length});
      g.ids.forEach((ref, k) => {
        const ang = a + (span * (k + 0.5)) / g.ids.length, rr = g.ids.length > 7 ? (k % 2 ? 0.82 : 0.5) : 0.66, t = (ang * Math.PI) / 180;
        const x = cx + Rx * rr * Math.cos(t), y = cy + Ry * rr * Math.sin(t);
        const nd = {ref, x, y, tx: x, ty: y, fx: null, fy: null, vx: 0, vy: 0, r: radius(ref), depth: 1, ang, dir: out.has(ref) && inn.has(ref) ? "both" : out.has(ref) ? "out" : "in", homeX: x, homeY: y, mass: 1, anchor: 1} as any;
        nodes.push(nd); byId.set(ref, nd); link(fnode, nd, 1, "spoke", 0.1);
      });
      a += span + GAP;
    }
    // a node's own neighbours fan out around it, on staggered radii, instead of piling up at one angle
    const kids = new Map<FieldRef, number>(); for (const s of second) kids.set(s.parent, (kids.get(s.parent) || 0) + 1);
    const seen_ = new Map<FieldRef, number>();
    second.forEach(s => {
      const p = byId.get(s.parent); if (!p) return;
      const c = seen_.get(s.parent) || 0; seen_.set(s.parent, c + 1);
      const m = kids.get(s.parent)!, step_ = Math.min(11, 44 / m), off = (c - (m - 1) / 2) * step_;
      const t = ((p.ang + off) * Math.PI) / 180, rr = (s.depth === 2 ? 0.98 : 1.1) + 0.07 * (c % 3);
      const x = cx + Rx * rr * Math.cos(t), y = cy + Ry * rr * Math.sin(t);
      const nd = {ref: s.ref, x, y, tx: x, ty: y, fx: null, fy: null, vx: 0, vy: 0, r: radius(s.ref) * (s.depth === 2 ? 0.75 : 0.6), depth: s.depth, ang: p.ang, dir: "in", homeX: x, homeY: y, mass: 1, anchor: 1} as any;
      nodes.push(nd); byId.set(s.ref, nd); link(p, nd, s.depth, "spoke", 0.1);
    });
    // the pages that are linked to one another, not only to the centre: a faint web that moves with its nodes
    let web = 0;
    for (const p of nodes) for (const j of index.linksFrom(p.ref)) { const q = byId.get(j); if (q && q !== p && web < 160) { const n0 = links.length; link(p, q, 0, "web", 0.012); if (links.length > n0) web++; } }
    // DOM, built once per layout; ticks only move attributes
    svg.innerHTML = "";
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("aria-label", `Interactive graph: ${nodes.length - 1} pages around “${node(focusRef).label}”. Arrow keys move between pages, Enter opens one, Escape lets go, 0 fits, plus and minus zoom.`);
    gView = el("g", {class: "g-view"}) as SVGGElement; gSec = el("g") as SVGGElement; gEdge = el("g") as SVGGElement; gNode = el("g") as SVGGElement;
    gView.append(gSec, gEdge, gNode); svg.append(gView);
    for (const sc of sectors) {
      if (sc.a1 - sc.a0 >= 300) continue;
      const pts_: string[] = []; const steps = Math.max(2, Math.round((sc.a1 - sc.a0) / 4));
      for (let s = 0; s <= steps; s++) { const t = (((sc.a0 + 1) + ((sc.a1 - sc.a0 - 2) * s) / steps) * Math.PI) / 180; pts_.push(`${(cx + Rx * 1.1 * Math.cos(t)).toFixed(1)},${(cy + Ry * 1.1 * Math.sin(t)).toFixed(1)}`); }
      const tn = index.group(sc.g)?.tone ?? sc.g;
      gSec.append(el("polyline", {class: "g-sector", points: pts_.join(" "), style: `stroke:var(--c-${tn})`}));
      const mid = ((sc.a0 + sc.a1) / 2) * Math.PI / 180, cs = Math.cos(mid), sn = Math.sin(mid);
      const label = `${(index.group(sc.g)?.label ?? sc.g).toUpperCase()} ${sc.n}`, len = label.length * 6.8;
      let anchor = cs > 0.25 ? "start" : cs < -0.25 ? "end" : "middle";
      let tx = cx + Rx * 1.1 * cs + (anchor === "start" ? 7 : anchor === "end" ? -7 : 0);
      // keep the register label inside the picture: a label that would run off the edge sits against it instead
      if (anchor === "end" && tx - len < 4) { anchor = "start"; tx = 4; }
      else if (anchor === "start" && tx + len > W - 4) { anchor = "end"; tx = W - 4; }
      const ty = cy + Ry * 1.1 * sn + (sn > 0.6 ? 12 : sn < -0.6 ? -7 : 0);
      // …and clear of the zoom buttons in the top-left corner
      if (ty > ZOOM_BOX[1] && ty < ZOOM_BOX[3] + 8 && (anchor === "end" ? tx - len : anchor === "middle" ? tx - len / 2 : tx) < ZOOM_BOX[2] + 2) { anchor = "start"; tx = ZOOM_BOX[2] + 6; }
      const t = el("text", {class: "g-sector-l", x: 0, y: 0, "text-anchor": anchor, style: `fill:var(--c-${tn})`}) as any; t.textContent = label; t._wx = tx; t._wy = ty; gSec.append(t);
    }
    for (const l of links) { l.el = el("line", {class: `g-edge${l.kind === "web" ? " g-edge--x" : ""}${l.kind === "spoke" && (l.b.dir === "in" || l.depth >= 2) ? " g-edge--in" : ""}${l.depth >= 2 ? " g-edge--2" : ""}`}); gEdge.append(l.el); }
    for (const n of nodes) {
      const nd = node(n.ref);
      n.el = el("g", {class: `gn${n.focus ? " gn--focus" : ""}${deps.visited(n.ref) ? " is-visited" : ""}`, "data-ref": n.ref, style: `--rc:${tone(n.ref)}`, role: "button", "aria-label": nd.label});
      n.vis = el("g", {class: "vis"});
      if (n.focus) n.vis.append(el("circle", {class: "pulse", r: 9}), el("circle", {class: "ring", r: 11}));
      n.vis.append(el("circle", {class: "hit", r: Math.max(n.r + 6, 11)}));
      n.dot = el("circle", {class: "n", r: n.r}); if (n.focus) n.dot.setAttribute("style", "fill:var(--gold-hi);fill-opacity:1");
      n.txt = el("text", {"dominant-baseline": "central"}); n.txt.textContent = shortLabel(n.ref);
      if (deps.expressionsOf(n.ref).length) { n.el.classList.add("has-x"); n.vis.append(el("circle", {class: "xr", r: n.r + 3.6})); }
      n.vis.append(n.dot); n.el.append(n.vis, n.txt); gNode.append(n.el);
    }
    applyView(true);
    for (let t = 0; t < 70; t++) step(0.6);      // settle before first paint
    // from here the layout is at rest: each link's rest length is the length it was laid out at, so the picture is unchanged
    for (const l of links) l.len = Math.hypot(l.a.x - l.b.x, l.a.y - l.b.y);
    springs = true;
    if (deps.filter().depth > 1 || override) view = fitTarget();      // a wider reach is framed; the plain neighbourhood keeps its familiar picture
    applyView(true);
    paint(); labels();
    alpha = 0.02; kick();
    drawnCount = override ? nodes.length - 1 : nb.all.length;
    applyHits();
    paintSelection();
  }

  /* ----- physics: sector spring + links + no overlap ----- */
  function step(a: number) {
    const n = nodes.length;
    for (let p = 0; p < n; p++) {
      const A = nodes[p]; if (A.fx != null) { A.x = A.fx; A.y = A.fy; A.vx = A.vy = 0; continue; }
      const h = 0.045 * A.anchor * a; A.vx += (A.tx - A.x) * h; A.vy += (A.ty - A.y) * h;
    }
    if (springs) for (const l of links) {
      const A = l.a, B = l.b; let dx = B.x - A.x, dy = B.y - A.y; const d = Math.hypot(dx, dy) || 0.01;
      const f = ((d - l.len) / d) * l.k * a; dx *= f; dy *= f;
      const fa = A.fx == null, fb = B.fx == null, ia = fa ? (fb ? 1 : 2) / A.mass : 0, ib = fb ? (fa ? 1 : 2) / B.mass : 0;
      A.vx += dx * ia; A.vy += dy * ia; B.vx -= dx * ib; B.vy -= dy * ib;
    }
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      const A = nodes[p], B = nodes[q]; let dx = B.x - A.x, dy = B.y - A.y; const d2 = dx * dx + dy * dy;
      const min = A.r + B.r + 14 + (A.depth > 1 || B.depth > 1 ? 14 : 0);      // the wider reach gets room to spread
      if (d2 < min * min && d2 > 0.01) { const d = Math.sqrt(d2), f = ((min - d) / d) * 0.5 * a; dx *= f; dy *= f; if (A.fx == null) { A.vx -= dx / A.mass; A.vy -= dy / A.mass; } if (B.fx == null) { B.vx += dx / B.mass; B.vy += dy / B.mass; } }
    }
    for (const A of nodes) { if (A.fx != null) continue; A.vx *= 0.7; A.vy *= 0.7; const sp = Math.hypot(A.vx, A.vy); if (sp > 30) { A.vx *= 30 / sp; A.vy *= 30 / sp; } A.x += A.vx; A.y += A.vy; }
  }
  function paint() {
    for (const l of links) { l.el.setAttribute("x1", l.a.x.toFixed(1)); l.el.setAttribute("y1", l.a.y.toFixed(1)); l.el.setAttribute("x2", l.b.x.toFixed(1)); l.el.setAttribute("y2", l.b.y.toFixed(1)); }
    for (const n of nodes) n.el.setAttribute("transform", `translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`);
    if (sel && !card.hidden) placeCard(sel);
  }
  /** Run the simulation: from rest, a little; while something is held (`heat`), for as long as it is held. */
  function kick(a = 0.2) {
    alpha = Math.max(alpha, a);
    if (reduced.matches) { settle(heat ? 4 : 50); return; }
    if (!raf && !dead) raf = requestAnimationFrame(loop);
  }
  function settle(steps: number) { for (let t = 0; t < steps; t++) { step(Math.min(1, Math.max(alpha, heat) * 4)); alpha *= 0.9; } paint(); if (!heat) { alpha = 0; scheduleLabels(); } }
  function loop() {
    raf = 0; if (dead) return;
    const a = Math.max(alpha, heat);
    step(Math.min(1, a * 4)); paint(); alpha *= 0.96;
    if (alpha > 0.003 || heat > 0) raf = requestAnimationFrame(loop); else labels();
  }

  /* ----- labels: greedy, by degree; selected / hovered / focus first, then what is lit around them ----- */
  const scheduleLabels = () => { if (!lraf && !dead) lraf = requestAnimationFrame(() => { lraf = 0; labels(); }); };
  function labels() {
    if (!nodes.length) return;
    const k = view.k, vs = Math.pow(k, -0.5), placed: number[][] = [];
    // the register labels around the ring are obstacles too: a node label may not sit on them
    for (const t of gSec.querySelectorAll<any>("text.g-sector-l")) {
      const len = t.textContent.length * 6.6, x = t._wx * k + view.x, y = t._wy * k + view.y, a = t.getAttribute("text-anchor");
      const x0 = a === "end" ? x - len : a === "middle" ? x - len / 2 : x;
      placed.push([x0 - 2, y - 11, x0 + len + 2, y + 3]);
    }
    placed.push(ZOOM_BOX);
    const lit = sel || hot, near = lit ? nearSet(lit) : null;
    const rank = (n: any) => (n.focus ? 4 : 0) + (n === sel ? 8 : 0) + (n === hot ? 6 : 0) + (near && near.has(n.ref) ? 2 : 0);
    const order = nodes.slice().sort((a, b) => (rank(b) - rank(a)) || (idx().degree(b.ref) - idx().degree(a.ref)));
    let shownN = 0;
    for (const n of order) {
      const text = n.txt.textContent, w = text.length * 5.6 + 6, side = n.focus ? "mid" : n.x > cx + 8 ? "r" : n.x < cx - 8 ? "l" : "mid";
      const sx = n.x * k + view.x, sy = n.y * k + view.y, rr = n.r * k * vs + 5;      // the dot is drawn at r·√k: see applyView
      let x0, y0 = sy - 7, anchor = "start", ox = 0, oy = 0;
      if (n.focus) { anchor = "middle"; oy = rr + 14; x0 = sx - w / 2; y0 = sy + oy - 7; }
      else if (side === "r") { x0 = sx + rr; ox = rr; }
      else if (side === "l") { anchor = "end"; x0 = sx - rr - w; ox = -rr; }
      else { anchor = "middle"; x0 = sx - w / 2; oy = (n.y > cy ? 1 : -1) * (rr + 7); y0 = sy + oy - 7; }
      const r = [x0, y0, x0 + w, y0 + 14];
      const force = n.focus || n === sel || n === hot;
      const inside = r[0] > 2 && r[2] < W - 2 && r[1] > 2 && r[3] < H - 2;
      const ok = inside && !placed.some(p => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1]);
      const show = force || (ok && shownN < 28);
      n.txt.setAttribute("x", ox.toFixed(1)); n.txt.setAttribute("y", oy.toFixed(1)); n.txt.setAttribute("text-anchor", anchor);
      n.txt.setAttribute("transform", `scale(${(1 / k).toFixed(4)})`);    // text keeps its size at every zoom
      n.txt.style.display = show ? "" : "none";
      if (show) { placed.push(r); shownN++; }
    }
  }

  /* ----- view: pan + zoom ----- */
  function applyView(force = false) {
    if (!gView) return;
    gView.setAttribute("transform", `translate(${view.x.toFixed(1)} ${view.y.toFixed(1)}) scale(${view.k.toFixed(4)})`);
    // nodes grow with the square root of the zoom and register labels keep their size: zoomed far in, a dot is not a moon
    const vs = Math.pow(view.k, -0.5).toFixed(4), inv = (1 / view.k).toFixed(4);
    for (const n of nodes) n.vis.setAttribute("transform", `scale(${vs})`);
    for (const t of gSec.querySelectorAll<any>("text.g-sector-l")) t.setAttribute("transform", `translate(${t._wx.toFixed(1)} ${t._wy.toFixed(1)}) scale(${inv})`);
    if (sel && !card.hidden) placeCard(sel);
    if (!force) scheduleLabels();
  }
  const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));
  const local = (x: number, y: number) => { const r = svg.getBoundingClientRect(); return {x: x - r.left, y: y - r.top}; };
  const toWorld = (cxp: number, cyp: number) => { const p = local(cxp, cyp); return {x: (p.x - view.x) / view.k, y: (p.y - view.y) / view.k}; };
  function zoomAt(mx: number, my: number, factor: number, to = view) {
    const k = clampK(to.k * factor);
    to.x = mx - ((mx - to.x) / to.k) * k; to.y = my - ((my - to.y) / to.k) * k; to.k = k; return to;
  }
  /** Move the view to `t`, eased unless the reader asked for less motion. */
  function goTo(t: { k: number; x: number; y: number }) {
    cancelAnimationFrame(vraf); tween = false;
    if (reduced.matches) { view = {...t}; applyView(); return; }
    const from = {...view}, t0 = performance.now(), D_ = 260;
    tween = true;
    const tick = (now: number) => {
      if (dead) return;
      const u = Math.min(1, (now - t0) / D_), e = 1 - Math.pow(1 - u, 3);
      view = {k: from.k + (t.k - from.k) * e, x: from.x + (t.x - from.x) * e, y: from.y + (t.y - from.y) * e}; applyView();
      if (u < 1) vraf = requestAnimationFrame(tick); else tween = false;
    };
    vraf = requestAnimationFrame(tick);
  }
  const zoomBy = (f: number) => goTo(zoomAt(W / 2, H / 2, f, {...view}));
  /** The view that frames everything that is drawn. */
  function fitTarget() {
    if (!nodes.length) return {k: 1, x: 0, y: 0};
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodes) { x0 = Math.min(x0, n.x - n.r); y0 = Math.min(y0, n.y - n.r); x1 = Math.max(x1, n.x + n.r); y1 = Math.max(y1, n.y + n.r); }
    const padX = 64, padY = 46, bw = Math.max(40, x1 - x0), bh = Math.max(40, y1 - y0);
    const k = clampK(Math.min((W - 2 * padX) / bw, (H - 2 * padY) / bh, 1.8));
    return {k, x: W / 2 - ((x0 + x1) / 2) * k, y: H / 2 - ((y0 + y1) / 2) * k};
  }
  const fit = () => goTo(fitTarget());
  listen(svg, "wheel", (e: WheelEvent) => {
    e.preventDefault(); cancelAnimationFrame(vraf); tween = false;
    const p = local(e.clientX, e.clientY), dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    zoomAt(p.x, p.y, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)));     // a trackpad pinch arrives as ctrl+wheel, with finer steps
    applyView();
  }, {passive: false});

  /* ----- pointer: node drag, background pan, pinch, click = select, double-click = open ----- */
  const nodeAt = (t: any) => { const g = t?.closest?.(".gn"); return g ? byId.get(g.getAttribute("data-ref")) : null; };
  const startPinch = () => {
    const [a, b] = [...pts.values()], c = local((a.x + b.x) / 2, (a.y + b.y) / 2);
    releaseNode(false);
    gesture = {type: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: view.k, wx: (c.x - view.x) / view.k, wy: (c.y - view.y) / view.k};
    svg.classList.add("is-dragging");
  };
  listen(svg, "pointerdown", (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    lastMode = e.pointerType === "mouse" ? "mouse" : "touch";
    e.preventDefault(); cancelAnimationFrame(vraf); tween = false;
    (svg as any)._ptr = true; svg.classList.remove("kb-focus");
    try { svg.focus({preventScroll: true}); } catch { /* ignore */ }
    pts.set(e.pointerId, {x: e.clientX, y: e.clientY});
    try { svg.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (pts.size === 2) { startPinch(); return; }
    if (pts.size > 2) return;
    const n = nodeAt(e.target), w = toWorld(e.clientX, e.clientY);
    gesture = n
      ? {type: "node", id: e.pointerId, n, x: e.clientX, y: e.clientY, ox: n.x - w.x, oy: n.y - w.y, moved: false, pinned: n.pinned, touch: e.pointerType !== "mouse"}
      : {type: "pan", id: e.pointerId, x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false, touch: e.pointerType !== "mouse"};
  });
  listen(svg, "pointermove", (e: PointerEvent) => {
    const p = pts.get(e.pointerId); if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (gesture?.type === "pinch" && pts.size >= 2) {
      const [a, b] = [...pts.values()], c = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      const k = clampK(gesture.k0 * (Math.hypot(a.x - b.x, a.y - b.y) / gesture.d0));
      view.k = k; view.x = c.x - gesture.wx * k; view.y = c.y - gesture.wy * k; applyView(); return;
    }
    if (gesture && gesture.id === e.pointerId) {
      if (!gesture.moved && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) < (gesture.touch ? 8 : 4)) return;
      if (!gesture.moved) {
        gesture.moved = true; card.hidden = true; svg.classList.add("is-dragging");
        if (gesture.type === "node") { heat = 0.3; setHot(gesture.n, true); }
      }
      if (gesture.type === "node") {
        const n = gesture.n, w = toWorld(e.clientX, e.clientY);
        n.fx = w.x + gesture.ox; n.fy = w.y + gesture.oy; n.x = n.fx; n.y = n.fy; n.tx = n.fx; n.ty = n.fy;
        kick(0.3);
      } else { view.x = gesture.vx + (e.clientX - gesture.x); view.y = gesture.vy + (e.clientY - gesture.y); applyView(); }
      return;
    }
    // no button down: a mouse is hovering
    if (e.pointerType === "mouse" && !gesture) { const n = nodeAt(e.target); if (n !== hot) setHot(n); }
  });
  /** Let go of the node held, if any: it stays where it was dropped (pinned, if asked to). */
  function releaseNode(keep?: boolean) {
    if (gesture?.type !== "node") return;
    const n = gesture.n;
    if (gesture.moved && keep !== false) {
      if (gesture.shift) pin(n, true);
      else if (!n.pinned) { n.fx = null; n.fy = null; n.tx = n.x; n.ty = n.y; n.mass = 12; n.anchor = 8; }   // placed: heavy, so what it is linked to gathers round it
    } else if (!n.pinned) { n.fx = null; n.fy = null; }
    heat = 0; if (gesture.moved) { if (gesture.touch) setHot(null, true); kick(0.18); setTimeout(scheduleLabels, 300); }
  }
  function endPointer(e: PointerEvent, cancelled: boolean) {
    const was = pts.delete(e.pointerId);
    try { svg.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!was) return;
    if (gesture?.type === "pinch") { if (pts.size < 2) { gesture = null; svg.classList.remove("is-dragging"); scheduleLabels(); } return; }
    if (!gesture || gesture.id !== e.pointerId) return;
    const g = gesture; gesture = null; svg.classList.remove("is-dragging");
    if (g.type === "node") {
      g.shift = e.shiftKey;
      gesture = g; releaseNode(!cancelled); gesture = null;
      if (!g.moved && !cancelled) {
        if (e.shiftKey && g.n.pinned) { pin(g.n, false); return; }
        tap(g.n, e);
      }
    } else if (g.type === "pan") {
      if (!g.moved && !cancelled) select(null); else scheduleLabels();
    }
  }
  listen(svg, "pointerup", (e: PointerEvent) => endPointer(e, false));
  listen(svg, "pointercancel", (e: PointerEvent) => endPointer(e, true));
  listen(svg, "lostpointercapture", (e: PointerEvent) => { if (pts.has(e.pointerId)) endPointer(e, true); });
  listen(svg, "pointerleave", (e: PointerEvent) => { if (e.pointerType === "mouse" && !gesture && hot) setHot(null); });
  listen(svg, "dblclick", (e: Event) => e.preventDefault());
  // the focus ring is for the keyboard: a click that happens to focus the graph does not draw it
  listen(svg, "focus", () => svg.classList.toggle("kb-focus", !(svg as any)._ptr));
  listen(svg, "blur", () => { svg.classList.remove("kb-focus"); (svg as any)._ptr = false; });
  listen(svg, "keydown", () => { (svg as any)._ptr = false; svg.classList.add("kb-focus"); }, true);
  listen(svg, "contextmenu", (e: Event) => { if (lastMode === "touch") e.preventDefault(); });

  /** One tap or click selects; a second on the same node, soon after, opens it. */
  function tap(n: any, e: PointerEvent) {
    const now = performance.now();
    if (lastTap.n === n && now - lastTap.t < 420) {
      lastTap = {n: null, t: 0}; select(null);
      if (e.altKey || e.metaKey || e.ctrlKey) deps.openMain(n.ref); else deps.openTangent(n.ref);
    } else { lastTap = {n, t: now}; select(n); }
  }
  function pin(n: any, on: boolean) {
    n.pinned = on; n.el.classList.toggle("is-pinned", on); if (!on) { n.mass = 1; n.anchor = 1; }
    if (on) { n.fx = n.x; n.fy = n.y; n.tx = n.x; n.ty = n.y; if (!n.pinEl) { n.pinEl = el("circle", {class: "pinr", r: n.r + 2.6}); n.vis.append(n.pinEl); } }
    else { n.fx = null; n.fy = null; kick(0.15); }
    announce(`${node(n.ref).label} ${on ? "pinned" : "released"}`);
  }

  /* ----- hover, select: one place decides which classes the picture wears ----- */
  const nearSet = (n: any) => {
    const s = new Set<FieldRef>([n.ref, focusRef!]);
    for (const j of idx().neighbours(n.ref, deps.filter().hubs).all) if (byId.has(j)) s.add(j);
    return s;
  };
  function paintState() {
    const f = sel || hot, near = f ? nearSet(f) : null;
    svg.classList.toggle("has-sel", !!sel); svg.classList.toggle("has-hot", !sel && !!hot);
    for (const m of nodes) {
      const c = m.el.classList;
      c.toggle("is-sel", m === sel); c.toggle("is-hover", m === hot); c.toggle("is-near", !!near && near.has(m.ref));
    }
    for (const l of links) l.el.classList.toggle("g-edge--hot", !!f && (l.a === f || l.b === f));
  }
  function setHot(n: any, quiet = false) {
    if (n === hot && !quiet) return;
    hot = n; deps.hover(n ? n.ref : null);
    if (!quiet) { if (!sel) { if (n && lastMode === "mouse") showCard(n, false); else if (!n) card.hidden = true; } }
    paintState(); scheduleLabels();
  }
  /** A click selects: the encounter hears it first (the same `select` operation any other actor uses). */
  function select(n: any) {
    applySelection(n);
    deps.select(n ? n.ref : null);
    if (n) {
      const {cites, citedBy} = idx().counts(n.ref);
      announce(`${node(n.ref).label}. ${idx().degree(n.ref)} neighbours: cites ${cites}, cited by ${citedBy}. Press Enter to open.`);
    }
  }
  function applySelection(n: any) {
    sel = n || null;
    paintState();
    if (!sel) { card.hidden = true; scheduleLabels(); return; }
    showCard(sel, true); scheduleLabels();
  }
  /** Re-paint the picture for the selection the encounter holds (it may have been set by a key or an agent). */
  function paintSelection() { applySelection(selectedRef ? byId.get(selectedRef) ?? null : null); }
  function announce(t: string) { if (live) { live.textContent = ""; setTimeout(() => { if (!dead) live.textContent = t; }, 30); } }

  /* ----- the card ----- */
  const kindOf = (nd: any) => (nd.kind && nd.kind !== nd.group && !["root", "record", "register", "reading", "rooms-root"].includes(nd.kind) ? nd.kind : "");
  function showCard(n: any, sticky: boolean) {
    const nd = node(n.ref), {cites, citedBy} = idx().counts(n.ref), xs = deps.expressionsOf(n.ref);
    const kind = [idx().group(nd.group)?.label, kindOf(nd)].filter(Boolean).join(" · ");
    card.innerHTML = `<b>${esc(nd.label)}</b><span class="gcard__where" style="--rc:${tone(n.ref)}"><i></i>${esc(idx().whereOf(n.ref))}</span><span class="gcard__n gcard__k">${nd.coord ? esc(nd.coord) + " · " : ""}${esc(kind)}</span><span class="gcard__n">${idx().degree(n.ref)} neighbours · cites ${cites} · cited by ${citedBy}${n.pinned ? " · pinned" : ""}</span>${xs.length ? `<span class="gcard__x"><svg width="12" height="12" aria-hidden="true"><use href="#fi-expression"/></svg>${xs.length} Expression${xs.length > 1 ? "s" : ""}</span>` : ""}${sticky ? `<span class="gcard__act"><button type="button" data-open>Open page</button>${xs.length ? `<button type="button" data-open-x class="is-x">Open the Expression</button>` : "<i>or double-click</i>"}</span>` : ""}`;
    card.classList.toggle("is-sticky", sticky); card.classList.toggle("is-compact", H < 380 || W < 380); card.hidden = false;
    placeCard(n);
  }
  function placeCard(n: any) {
    const sx = n.x * view.k + view.x, sy = n.y * view.k + view.y, cw = card.offsetWidth, ch = card.offsetHeight, off = n.r * Math.sqrt(view.k) + 12;
    let x = sx + off, y = sy + off - 4;
    if (x + cw > W - 6) x = sx - cw - off;
    if (y + ch > H - 6) y = sy - ch - off + 4;
    card.style.transform = `translate(${Math.max(6, Math.min(x, W - cw - 6)).toFixed(0)}px, ${Math.max(6, y).toFixed(0)}px)`;
  }
  listen(card, "click", (e: Event) => {
    if (!sel) return;
    const t = e.target as Element;
    if (t.closest("[data-open-x]")) { const r = sel.ref; select(null); deps.openExpression(deps.expressionsOf(r)[0]); }
    else if (t.closest("[data-open]")) { const r = sel.ref; select(null); deps.openTangent(r); }
  });

  /* ----- keyboard: the graph is one tab stop; arrows walk between the nodes ----- */
  function walk(dx: number, dy: number) {
    const from = sel || byId.get(focusRef!); if (!from) return;
    let best: any = null, bs = Infinity;
    for (const m of nodes) {
      if (m === from) continue;
      const vx = m.x - from.x, vy = m.y - from.y, d = Math.hypot(vx, vy) || 1, ang = Math.acos(Math.max(-1, Math.min(1, (vx * dx + vy * dy) / d)));
      if (ang > 1.15) continue;
      const score = d * (1 + ang * 1.5); if (score < bs) { bs = score; best = m; }
    }
    if (!best) {          // nothing that way: go round the ring instead
      const ring = nodes.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx)), at = ring.indexOf(from);
      best = ring[(at + (dx + dy > 0 ? 1 : -1) + ring.length) % ring.length];
    }
    select(best); reveal(best);
  }
  function reveal(n: any) {
    const sx = n.x * view.k + view.x, sy = n.y * view.k + view.y, m = 34;
    if (sx > m && sx < W - m && sy > m && sy < H - m) return;
    goTo({k: view.k, x: view.x + (sx < m ? m - sx : sx > W - m ? W - m - sx : 0), y: view.y + (sy < m ? m - sy : sy > H - m ? H - m - sy : 0)});
  }
  listen(svg, "keydown", (e: KeyboardEvent) => {
    if (e.altKey) return;
    const k = e.key;
    if (k === "ArrowRight") walk(1, 0); else if (k === "ArrowLeft") walk(-1, 0); else if (k === "ArrowDown") walk(0, 1); else if (k === "ArrowUp") walk(0, -1);
    else if (k === "Enter" || k === " ") {
      const n = sel || byId.get(focusRef!); if (!n) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey) { select(null); deps.openMain(n.ref); } else { select(null); deps.openTangent(n.ref); }
    }
    else if (k === "Escape") { if (sel) select(null); else if (hot) setHot(null); else return; }
    else if (k === "0" && !e.metaKey && !e.ctrlKey) fit();
    else if (k === "+" || k === "=") zoomBy(1.4); else if (k === "-" || k === "_") zoomBy(1 / 1.4);
    else if (k === "Home") { const f = byId.get(focusRef!); if (f) { select(f); reveal(f); } }
    else if (k === "p" && sel) pin(sel, !sel.pinned);
    else return;
    e.preventDefault(); e.stopPropagation();
  });

  /* ----- on-graph controls: zoom in, out, fit; and a polite voice for screen readers ----- */
  box.querySelector(".gzoom")?.remove(); box.querySelector(".sr-only")?.remove();
  zoomBox = document.createElement("div"); zoomBox.className = "gzoom";
  zoomBox.innerHTML = `<button type="button" data-z="in" aria-label="Zoom in" title="Zoom in (+)">+</button><button type="button" data-z="out" aria-label="Zoom out" title="Zoom out (−)">−</button><button type="button" data-z="fit" aria-label="Fit the graph" title="Fit (0)"><svg width="13" height="13" aria-hidden="true"><use href="#fi-fit"/></svg></button>`;
  live = document.createElement("div"); live.className = "sr-only"; live.setAttribute("aria-live", "polite");
  box.append(zoomBox, live);
  svg.setAttribute("role", "application"); svg.setAttribute("aria-roledescription", "interactive graph"); svg.setAttribute("tabindex", "0");
  listen(zoomBox, "pointerdown", (e: Event) => e.stopPropagation());
  listen(zoomBox, "click", (e: Event) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-z]"); if (!b) return;
    if (b.dataset.z === "in") zoomBy(1.4); else if (b.dataset.z === "out") zoomBy(1 / 1.4); else fit();
  });
  disposers.push(() => { zoomBox.remove(); live.remove(); });

  function applyHits() {
    const lit = hits && nodes.some(n => hits!.has(n.ref));
    nodes.forEach(n => n.el.classList.toggle("is-dim", !!lit && !n.focus && !hits!.has(n.ref)));
  }

  const ro = new ResizeObserver(() => size());
  ro.observe(box); disposers.push(() => ro.disconnect());   // gated: a collapsed pane has nothing to draw
  function size() { const w = box.clientWidth, h = box.clientHeight; if (!w || !h) { W = 0; return; } if (w !== W || h !== H) { W = w; H = h; build(); } }

  const handle: GraphHandle = {
    setFocus(ref) { if (ref === focusRef) return; focusRef = ref; view = {k: 1, x: 0, y: 0}; override = null; build(); },
    setSelected(ref) { selectedRef = ref; paintSelection(); },
    setHits(h) { hits = h; applyHits(); },
    setHover(ref) { if (!svg.isConnected) return; nodes.forEach(n => n.el.classList.toggle("is-hot", ref != null && n.ref === ref)); },
    refresh() { view = {k: 1, x: 0, y: 0}; override = null; build(); },
    resize: size, fit,
    reset() { view = {k: 1, x: 0, y: 0}; override = null; build(); },
    destroy() { dead = true; cancelAnimationFrame(raf); cancelAnimationFrame(vraf); cancelAnimationFrame(lraf); for (const d of disposers) { try { d(); } catch { /* ignore */ } } },
    probe: {
      nodes: () => nodes, links: () => links, view: () => ({...view}), selected: () => sel?.ref ?? null, size: () => ({W, H}),
      moving: () => tween || heat > 0, drawn: () => nodes.map(n => n.ref), count: () => drawnCount,
    },
  };
  size();
  return handle;
}
