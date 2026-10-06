// @ts-nocheck
/* ───────── field: the local graph — a live force layout you can handle ─────────
   One SVG, one simulation. Nodes keep their register's sector as a soft spring (so the picture stays legible),
   links are springs of their own (so a node you move drags what it is linked to), and nothing overlaps.

     click        select: the neighbourhood lights, the rest dims, the card offers the page and its Expression
     double-click open the page as a tangent (Enter does the same; Shift/Ctrl/Cmd+Enter turns the main page)
     drag a node  it follows the pointer, the layout re-settles live; it stays where you drop it
                  (shift-drag, or `p`, pins it for good; shift-click on a pinned node lets it go)
     drag nothing pan · wheel / trackpad pinch zoom at the cursor · two fingers pinch + pan · + − fit buttons
     keys         Tab into the graph, arrows walk between nodes, Enter opens, Esc lets go, 0 fits, + − zoom, p pins

   Pointer Events throughout (mouse, pen and touch alike), pointer capture on the svg so a drag never drops the node,
   a 4 px (touch: 8 px) threshold so a click never fires after a drag, a transparent hit disc around every node so a
   4 px dot is still a fair target. Everything is torn down by the page's mount cleanup, so Quartz's SPA navigation
   can rebuild it from scratch. Reduced motion: the layout settles at once instead of animating.                     */
import { $, $$, D, S, REGS, REG_ORDER, act, counts, esc, exprOf, listen, mountCleanup, neighbours, observe, pad, setHover, sub, whereOf } from './core'

const MIN_K = 0.3, MAX_K = 6;
const ZOOM_BOX = [4, 4, 48, 116];     // the zoom buttons, in the graph's own pixels: labels keep clear of it

export function mountGraph() {

  const box = $('#graph-container'), svg = $('#graph-svg'), card = $('#gcard'), connBody = $('#conn-body');
  const menu = $('#gmenu'), countEl = $('#graph-count'), filterBtn = $('#graph-filter');
  if (!box || !svg || !card || !connBody || !menu || !countEl || !filterBtn) return;
  const NS = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let W = 0, H = 0, focus = null, nodes = [], links = [], byId = new Map(), sectors = [], view = { k: 1, x: 0, y: 0 };
  let lastTap = { n: null, t: 0 }, alpha = 0, heat = 0, raf = 0, vraf = 0, lraf = 0, sel = null, hot = null, cx = 0, cy = 0, dead = false;
  let gView, gSec, gEdge, gNode, springs = false, override = null, lastMode = 'mouse', tween = false;
  const pts = new Map();               // active pointers: id → { x, y }
  let gesture = null;                  // { type: 'node' | 'pan' | 'pinch', … }
  let live, zoomBox;
  mountCleanup(() => { dead = true; cancelAnimationFrame(raf); cancelAnimationFrame(vraf); cancelAnimationFrame(lraf); clearTimeout(svg._lt); });

  const focusIndex = () => {
    const c = S.cur; if (c.i == null) return null;
    const n = D.nodes[c.i];
    return n.k === 'manuscript' && c.m && D.moves[c.m] ? D.moves[c.m].i : c.i;
  };
  const filtersActive = () => S.hidden.size > 0 || S.hubs || S.depth > 1;

  /* ----- one filter, used by the graph AND the connections list ----- */
  const allowed = (j) => !S.hidden.has(D.nodes[j].r);
  function neighbourSet() {
    const nb = neighbours(focus, S.hubs);
    return { out: nb.out.filter(allowed), inn: nb.inn.filter(allowed), all: nb.all.filter(allowed), raw: nb.all };
  }

  /* ----- what to draw: the page, its neighbours, and (by reach) theirs ----- */
  function pick() {
    const nb = neighbourSet();
    if (override) return { direct: override.slice(1), second: [], nb: { ...nb, out: [], inn: [], all: override.slice(1) } };
    const cap = Math.max(12, Math.min(36, Math.round((W * H) / 6000)));   // a compact sidebar draws fewer nodes than the field view
    const direct = nb.all.slice().sort((a, b) => D.deg[b] - D.deg[a]).slice(0, cap).sort((a, b) => a - b);
    const seen = new Set([focus, ...direct]), second = [];
    let frontier = direct;
    for (let lvl = 2; lvl <= Math.min(3, S.depth); lvl++) {
      const next = [], room = lvl === 2 ? 36 : 28;
      for (const j of frontier.slice().sort((a, b) => D.deg[b] - D.deg[a]).slice(0, lvl === 2 ? 16 : 10)) {
        for (const k of neighbours(j, S.hubs).all) if (!seen.has(k) && allowed(k) && next.length < room) { seen.add(k); next.push({ i: k, parent: j, depth: lvl }); }
      }
      second.push(...next); frontier = next.map((s) => s.i);
    }
    return { direct, second, nb };
  }
  const radius = (i) => Math.min(8, 3 + Math.sqrt(D.deg[i]) * 0.38);
  const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const shortLabel = (nd) => ((nd.coord ? nd.coord + ' · ' : '') + nd.lab).replace(/^(.{27}).+$/, '$1…');

  /* ----- build ----- */
  function build() {
    gesture = null; pts.clear(); sel = null; hot = null; lastTap = { n: null, t: 0 }; card.hidden = true; svg.classList.remove('is-dragging', 'has-sel', 'has-hot');
    if (!W || !H || focus == null) { if (svg.firstChild) svg.innerHTML = ''; nodes = []; links = []; return; }
    const { direct, second, nb } = pick();
    cx = W / 2; cy = H / 2;
    const Rx = Math.max(60, W / 2 - 58), Ry = Math.max(60, H / 2 - 34);
    const out = new Set(nb.out), inn = new Set(nb.inn);
    const groups = REG_ORDER.map((r) => ({ r, ids: direct.filter((j) => D.nodes[j].r === r) })).filter((g) => g.ids.length);
    const GAP = 14, total = 360 - GAP * groups.length, wt = (g) => Math.pow(g.ids.length, 0.8), wsum = groups.reduce((s, g) => s + wt(g), 0);
    let a = -90 + GAP / 2;
    nodes = []; links = []; byId = new Map(); sectors = []; springs = false;
    const fnode = { i: focus, x: cx, y: cy, tx: cx, ty: cy, fx: null, fy: null, vx: 0, vy: 0, r: 7, depth: 0, focus: true, homeX: cx, homeY: cy, mass: 1, anchor: 1 };
    nodes.push(fnode); byId.set(focus, fnode);
    const have = new Set();
    const link = (p, q, depth, kind, strength) => { const key = p.i < q.i ? p.i + ':' + q.i : q.i + ':' + p.i; if (have.has(key)) return; have.add(key); links.push({ a: p, b: q, depth, kind, k: strength, len: 0 }); };
    for (const g of groups) {
      const span = Math.max(14, (total * wt(g)) / wsum);
      sectors.push({ r: g.r, a0: a, a1: a + span, n: g.ids.length });
      g.ids.forEach((j, k) => {
        const ang = a + (span * (k + 0.5)) / g.ids.length, rr = g.ids.length > 7 ? (k % 2 ? 0.82 : 0.5) : 0.66, t = (ang * Math.PI) / 180;
        const x = cx + Rx * rr * Math.cos(t), y = cy + Ry * rr * Math.sin(t);
        const nd = { i: j, x, y, tx: x, ty: y, fx: null, fy: null, vx: 0, vy: 0, r: radius(j), depth: 1, ang, dir: out.has(j) && inn.has(j) ? 'both' : out.has(j) ? 'out' : 'in', homeX: x, homeY: y, mass: 1, anchor: 1 };
        nodes.push(nd); byId.set(j, nd); link(fnode, nd, 1, 'spoke', 0.1);
      });
      a += span + GAP;
    }
    // a node's own neighbours fan out around it, on staggered radii, instead of piling up at one angle
    const kids = new Map(); for (const s of second) kids.set(s.parent, (kids.get(s.parent) || 0) + 1);
    const seen_ = new Map();
    second.forEach((s) => {
      const p = byId.get(s.parent); if (!p) return;
      const c = seen_.get(s.parent) || 0; seen_.set(s.parent, c + 1);
      const m = kids.get(s.parent), step_ = Math.min(11, 44 / m), off = (c - (m - 1) / 2) * step_;
      const t = ((p.ang + off) * Math.PI) / 180, rr = (s.depth === 2 ? 0.98 : 1.1) + 0.07 * (c % 3);
      const x = cx + Rx * rr * Math.cos(t), y = cy + Ry * rr * Math.sin(t);
      const nd = { i: s.i, x, y, tx: x, ty: y, fx: null, fy: null, vx: 0, vy: 0, r: radius(s.i) * (s.depth === 2 ? 0.75 : 0.6), depth: s.depth, ang: p.ang, dir: 'in', homeX: x, homeY: y, mass: 1, anchor: 1 };
      nodes.push(nd); byId.set(s.i, nd); link(p, nd, s.depth, 'spoke', 0.1);
    });
    // the pages that are linked to one another, not only to the centre: a faint web that moves with its nodes
    let web = 0;
    for (const p of nodes) for (const j of D.out[p.i]) { const q = byId.get(j); if (q && q !== p && web < 160) { const n0 = links.length; link(p, q, 0, 'web', 0.012); if (links.length > n0) web++; } }
    // DOM, built once per layout; ticks only move attributes
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('aria-label', `Interactive graph: ${nodes.length - 1} pages around “${D.nodes[focus].lab}”. Arrow keys move between pages, Enter opens one, Escape lets go, 0 fits, plus and minus zoom.`);
    gView = el('g', { id: 'g-view' }); gSec = el('g'); gEdge = el('g'); gNode = el('g');
    gView.append(gSec, gEdge, gNode); svg.append(gView);
    for (const sc of sectors) {
      if (sc.a1 - sc.a0 >= 300) continue;
      const pts_ = []; const steps = Math.max(2, Math.round((sc.a1 - sc.a0) / 4));
      for (let s = 0; s <= steps; s++) { const t = (((sc.a0 + 1) + ((sc.a1 - sc.a0 - 2) * s) / steps) * Math.PI) / 180; pts_.push(`${(cx + Rx * 1.1 * Math.cos(t)).toFixed(1)},${(cy + Ry * 1.1 * Math.sin(t)).toFixed(1)}`); }
      gSec.append(el('polyline', { class: 'g-sector', points: pts_.join(' '), style: `stroke:var(--c-${sc.r})` }));
      const mid = ((sc.a0 + sc.a1) / 2) * Math.PI / 180, cs = Math.cos(mid), sn = Math.sin(mid);
      const label = `${REGS[sc.r].toUpperCase()} ${sc.n}`, len = label.length * 6.8;
      let anchor = cs > 0.25 ? 'start' : cs < -0.25 ? 'end' : 'middle';
      let tx = cx + Rx * 1.1 * cs + (anchor === 'start' ? 7 : anchor === 'end' ? -7 : 0);
      // keep the register label inside the picture: a label that would run off the edge sits against it instead
      if (anchor === 'end' && tx - len < 4) { anchor = 'start'; tx = 4; }
      else if (anchor === 'start' && tx + len > W - 4) { anchor = 'end'; tx = W - 4; }
      const ty = cy + Ry * 1.1 * sn + (sn > 0.6 ? 12 : sn < -0.6 ? -7 : 0);
      // …and clear of the zoom buttons in the top-left corner
      if (ty > ZOOM_BOX[1] && ty < ZOOM_BOX[3] + 8 && (anchor === 'end' ? tx - len : anchor === 'middle' ? tx - len / 2 : tx) < ZOOM_BOX[2] + 2) { anchor = 'start'; tx = ZOOM_BOX[2] + 6; }
      const t = el('text', { class: 'g-sector-l', x: 0, y: 0, 'text-anchor': anchor, style: `fill:var(--c-${sc.r})` }); t.textContent = label; t._wx = tx; t._wy = ty; gSec.append(t);
    }
    for (const l of links) { l.el = el('line', { class: `g-edge${l.kind === 'web' ? ' g-edge--x' : ''}${l.kind === 'spoke' && (l.b.dir === 'in' || l.depth >= 2) ? ' g-edge--in' : ''}${l.depth >= 2 ? ' g-edge--2' : ''}` }); gEdge.append(l.el); }
    for (const n of nodes) {
      const nd = D.nodes[n.i];
      n.el = el('g', { class: `gn${n.focus ? ' gn--focus' : ''}${S.visited.has(n.i) ? ' is-visited' : ''}`, 'data-i': n.i, style: `--rc:var(--c-${nd.r})`, role: 'button', 'aria-label': nd.lab });
      n.vis = el('g', { class: 'vis' });
      if (n.focus) n.vis.append(el('circle', { class: 'pulse', r: 9 }), el('circle', { class: 'ring', r: 11 }));
      n.vis.append(el('circle', { class: 'hit', r: Math.max(n.r + 6, 11) }));
      n.dot = el('circle', { class: 'n', r: n.r }); if (n.focus) n.dot.setAttribute('style', 'fill:var(--gold-hi);fill-opacity:1');
      n.txt = el('text', { 'dominant-baseline': 'central' }); n.txt.textContent = shortLabel(nd);
      if (exprOf(n.i).length) { n.el.classList.add('has-x'); n.vis.append(el('circle', { class: 'xr', r: n.r + 3.6 })); }
      n.vis.append(n.dot); n.el.append(n.vis, n.txt); gNode.append(n.el);
    }
    applyView(true);
    for (let t = 0; t < 70; t++) step(0.6);      // settle before first paint
    // from here the layout is at rest: each link's rest length is the length it was laid out at, so the picture is unchanged
    for (const l of links) l.len = Math.hypot(l.a.x - l.b.x, l.a.y - l.b.y);
    springs = true;
    if (S.depth > 1 || override) view = fitTarget();      // a wider reach is framed; the plain neighbourhood keeps its familiar picture
    applyView(true);
    paint(); labels();
    alpha = 0.02; kick();
    countEl.textContent = override ? nodes.length - 1 : nb.all.length;
    filterBtn.classList.toggle('is-on', filtersActive());
    applyHits();
  }

  /* ----- physics: sector spring + links + no overlap ----- */
  function step(a) {
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
      const A = nodes[p], B = nodes[q]; let dx = B.x - A.x, dy = B.y - A.y, d2 = dx * dx + dy * dy;
      const min = A.r + B.r + 14 + (A.depth > 1 || B.depth > 1 ? 14 : 0);      // the wider reach gets room to spread
      if (d2 < min * min && d2 > 0.01) { const d = Math.sqrt(d2), f = ((min - d) / d) * 0.5 * a; dx *= f; dy *= f; if (A.fx == null) { A.vx -= dx / A.mass; A.vy -= dy / A.mass; } if (B.fx == null) { B.vx += dx / B.mass; B.vy += dy / B.mass; } }
    }
    for (const A of nodes) { if (A.fx != null) continue; A.vx *= 0.7; A.vy *= 0.7; const sp = Math.hypot(A.vx, A.vy); if (sp > 30) { A.vx *= 30 / sp; A.vy *= 30 / sp; } A.x += A.vx; A.y += A.vy; }
  }
  function paint() {
    for (const l of links) { l.el.setAttribute('x1', l.a.x.toFixed(1)); l.el.setAttribute('y1', l.a.y.toFixed(1)); l.el.setAttribute('x2', l.b.x.toFixed(1)); l.el.setAttribute('y2', l.b.y.toFixed(1)); }
    for (const n of nodes) n.el.setAttribute('transform', `translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`);
    if (sel && !card.hidden) placeCard(sel);
  }
  /** Run the simulation: from rest, a little; while something is held (`heat`), for as long as it is held. */
  function kick(a = 0.2) {
    alpha = Math.max(alpha, a);
    if (reduced.matches) { settle(heat ? 4 : 50); return; }
    if (!raf && !dead) raf = requestAnimationFrame(loop);
  }
  function settle(steps) { for (let t = 0; t < steps; t++) { step(Math.min(1, Math.max(alpha, heat) * 4)); alpha *= 0.9; } paint(); if (!heat) { alpha = 0; scheduleLabels(); } }
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
    const k = view.k, vs = Math.pow(k, -0.5), placed = [];
    // the register labels around the ring are obstacles too: a node label may not sit on them
    for (const t of $$('text.g-sector-l', gSec)) {
      const len = t.textContent.length * 6.6, x = t._wx * k + view.x, y = t._wy * k + view.y, a = t.getAttribute('text-anchor');
      const x0 = a === 'end' ? x - len : a === 'middle' ? x - len / 2 : x;
      placed.push([x0 - 2, y - 11, x0 + len + 2, y + 3]);
    }
    placed.push(ZOOM_BOX);
    const lit = sel || hot, near = lit ? nearSet(lit) : null;
    const rank = (n) => (n.focus ? 4 : 0) + (n === sel ? 8 : 0) + (n === hot ? 6 : 0) + (near && near.has(n.i) ? 2 : 0);
    const order = nodes.slice().sort((a, b) => (rank(b) - rank(a)) || (D.deg[b.i] - D.deg[a.i]));
    let shownN = 0;
    for (const n of order) {
      const text = n.txt.textContent, w = text.length * 5.6 + 6, side = n.focus ? 'mid' : n.x > cx + 8 ? 'r' : n.x < cx - 8 ? 'l' : 'mid';
      const sx = n.x * k + view.x, sy = n.y * k + view.y, rr = n.r * k * vs + 5;      // the dot is drawn at r·√k: see applyView
      let x0, y0 = sy - 7, anchor = 'start', ox = 0, oy = 0;
      if (n.focus) { anchor = 'middle'; oy = rr + 14; x0 = sx - w / 2; y0 = sy + oy - 7; }
      else if (side === 'r') { x0 = sx + rr; ox = rr; }
      else if (side === 'l') { anchor = 'end'; x0 = sx - rr - w; ox = -rr; }
      else { anchor = 'middle'; x0 = sx - w / 2; oy = (n.y > cy ? 1 : -1) * (rr + 7); y0 = sy + oy - 7; }
      const r = [x0, y0, x0 + w, y0 + 14];
      const force = n.focus || n === sel || n === hot;
      const inside = r[0] > 2 && r[2] < W - 2 && r[1] > 2 && r[3] < H - 2;
      const ok = inside && !placed.some((p) => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1]);
      const show = force || (ok && shownN < 28);
      n.txt.setAttribute('x', ox.toFixed(1)); n.txt.setAttribute('y', oy.toFixed(1)); n.txt.setAttribute('text-anchor', anchor);
      n.txt.setAttribute('transform', `scale(${(1 / k).toFixed(4)})`);    // text keeps its size at every zoom
      n.txt.style.display = show ? '' : 'none';
      if (show) { placed.push(r); shownN++; }
    }
  }

  /* ----- view: pan + zoom ----- */
  function applyView(force) {
    gView?.setAttribute('transform', `translate(${view.x.toFixed(1)} ${view.y.toFixed(1)}) scale(${view.k.toFixed(4)})`);
    if (!gView) return;
    // nodes grow with the square root of the zoom and register labels keep their size: zoomed far in, a dot is not a moon
    const vs = Math.pow(view.k, -0.5).toFixed(4), inv = (1 / view.k).toFixed(4);
    for (const n of nodes) n.vis.setAttribute('transform', `scale(${vs})`);
    for (const t of $$('text.g-sector-l', gSec)) t.setAttribute('transform', `translate(${t._wx.toFixed(1)} ${t._wy.toFixed(1)}) scale(${inv})`);
    if (sel && !card.hidden) placeCard(sel);
    if (!force) scheduleLabels();
  }
  const clampK = (k) => Math.min(MAX_K, Math.max(MIN_K, k));
  const local = (x, y) => { const r = svg.getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; };
  const toWorld = (cxp, cyp) => { const p = local(cxp, cyp); return { x: (p.x - view.x) / view.k, y: (p.y - view.y) / view.k }; };
  function zoomAt(mx, my, factor, to = view) {
    const k = clampK(to.k * factor);
    to.x = mx - ((mx - to.x) / to.k) * k; to.y = my - ((my - to.y) / to.k) * k; to.k = k; return to;
  }
  /** Move the view to `t`, eased unless the reader asked for less motion. */
  function goTo(t) {
    cancelAnimationFrame(vraf); tween = false;
    if (reduced.matches) { view = { ...t }; applyView(); return; }
    const from = { ...view }, t0 = performance.now(), D_ = 260;
    tween = true;
    const tick = (now) => {
      if (dead) return;
      const u = Math.min(1, (now - t0) / D_), e = 1 - Math.pow(1 - u, 3);
      view = { k: from.k + (t.k - from.k) * e, x: from.x + (t.x - from.x) * e, y: from.y + (t.y - from.y) * e }; applyView();
      if (u < 1) vraf = requestAnimationFrame(tick); else tween = false;
    };
    vraf = requestAnimationFrame(tick);
  }
  const zoomBy = (f) => goTo(zoomAt(W / 2, H / 2, f, { ...view }));
  /** The view that frames everything that is drawn. */
  function fitTarget() {
    if (!nodes.length) return { k: 1, x: 0, y: 0 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodes) { x0 = Math.min(x0, n.x - n.r); y0 = Math.min(y0, n.y - n.r); x1 = Math.max(x1, n.x + n.r); y1 = Math.max(y1, n.y + n.r); }
    const padX = 64, padY = 46, bw = Math.max(40, x1 - x0), bh = Math.max(40, y1 - y0);
    const k = clampK(Math.min((W - 2 * padX) / bw, (H - 2 * padY) / bh, 1.8));
    return { k, x: W / 2 - ((x0 + x1) / 2) * k, y: H / 2 - ((y0 + y1) / 2) * k };
  }
  const fit = () => goTo(fitTarget());
  listen(svg, 'wheel', (e) => {
    e.preventDefault(); cancelAnimationFrame(vraf); tween = false;
    const p = local(e.clientX, e.clientY), dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    zoomAt(p.x, p.y, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)));     // a trackpad pinch arrives as ctrl+wheel, with finer steps
    applyView();
  }, { passive: false });

  /* ----- pointer: node drag, background pan, pinch, click = select, double-click = open ----- */
  const nodeAt = (t) => { const g = t?.closest?.('.gn'); return g ? byId.get(+g.dataset.i) : null; };
  const startPinch = () => {
    const [a, b] = [...pts.values()], c = local((a.x + b.x) / 2, (a.y + b.y) / 2);
    releaseNode(false);
    gesture = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: view.k, wx: (c.x - view.x) / view.k, wy: (c.y - view.y) / view.k };
    svg.classList.add('is-dragging');
  };
  listen(svg, 'pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    lastMode = e.pointerType === 'mouse' ? 'mouse' : 'touch';
    e.preventDefault(); cancelAnimationFrame(vraf); tween = false;
    svg._ptr = true; svg.classList.remove('kb-focus');
    try { svg.focus({ preventScroll: true }); } catch { /* ignore */ }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { svg.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (pts.size === 2) { startPinch(); return; }
    if (pts.size > 2) return;
    const n = nodeAt(e.target), w = toWorld(e.clientX, e.clientY);
    gesture = n
      ? { type: 'node', id: e.pointerId, n, x: e.clientX, y: e.clientY, ox: n.x - w.x, oy: n.y - w.y, moved: false, pinned: n.pinned, touch: e.pointerType !== 'mouse' }
      : { type: 'pan', id: e.pointerId, x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false, touch: e.pointerType !== 'mouse' };
  });
  listen(svg, 'pointermove', (e) => {
    const p = pts.get(e.pointerId); if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (gesture?.type === 'pinch' && pts.size >= 2) {
      const [a, b] = [...pts.values()], c = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      const k = clampK(gesture.k0 * (Math.hypot(a.x - b.x, a.y - b.y) / gesture.d0));
      view.k = k; view.x = c.x - gesture.wx * k; view.y = c.y - gesture.wy * k; applyView(); return;
    }
    if (gesture && gesture.id === e.pointerId) {
      if (!gesture.moved && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) < (gesture.touch ? 8 : 4)) return;
      if (!gesture.moved) {
        gesture.moved = true; card.hidden = true; svg.classList.add('is-dragging');
        if (gesture.type === 'node') { heat = 0.3; setHot(gesture.n, true); }
      }
      if (gesture.type === 'node') {
        const n = gesture.n, w = toWorld(e.clientX, e.clientY);
        n.fx = w.x + gesture.ox; n.fy = w.y + gesture.oy; n.x = n.fx; n.y = n.fy; n.tx = n.fx; n.ty = n.fy;
        kick(0.3);
      } else { view.x = gesture.vx + (e.clientX - gesture.x); view.y = gesture.vy + (e.clientY - gesture.y); applyView(); }
      return;
    }
    // no button down: a mouse is hovering
    if (e.pointerType === 'mouse' && !gesture) { const n = nodeAt(e.target); if (n !== hot) setHot(n); }
  });
  /** Let go of the node held, if any: it stays where it was dropped (pinned, if asked to). */
  function releaseNode(keep) {
    if (gesture?.type !== 'node') return;
    const n = gesture.n;
    if (gesture.moved && keep !== false) {
      if (gesture.shift) pin(n, true);
      else if (!n.pinned) { n.fx = null; n.fy = null; n.tx = n.x; n.ty = n.y; n.mass = 12; n.anchor = 8; }   // placed: heavy, so what it is linked to gathers round it
    } else if (!n.pinned) { n.fx = null; n.fy = null; }
    heat = 0; if (gesture.moved) { if (gesture.touch) setHot(null, true); kick(0.18); setTimeout(scheduleLabels, 300); }
  }
  function endPointer(e, cancelled) {
    const was = pts.delete(e.pointerId);
    try { svg.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!was) return;
    if (gesture?.type === 'pinch') { if (pts.size < 2) { gesture = null; svg.classList.remove('is-dragging'); scheduleLabels(); } return; }
    if (!gesture || gesture.id !== e.pointerId) return;
    const g = gesture; gesture = null; svg.classList.remove('is-dragging');
    if (g.type === 'node') {
      g.shift = e.shiftKey;
      gesture = g; releaseNode(!cancelled); gesture = null;
      if (!g.moved && !cancelled) {
        if (e.shiftKey && g.n.pinned) { pin(g.n, false); return; }
        tap(g.n, e);
      }
    } else if (g.type === 'pan') {
      if (!g.moved && !cancelled) select(null); else scheduleLabels();
    }
  }
  listen(svg, 'pointerup', (e) => endPointer(e, false));
  listen(svg, 'pointercancel', (e) => endPointer(e, true));
  listen(svg, 'lostpointercapture', (e) => { if (pts.has(e.pointerId)) endPointer(e, true); });
  listen(svg, 'pointerleave', (e) => { if (e.pointerType === 'mouse' && !gesture && hot) setHot(null); });
  listen(svg, 'dblclick', (e) => e.preventDefault());
  // the focus ring is for the keyboard: a click that happens to focus the graph does not draw it
  listen(svg, 'focus', () => svg.classList.toggle('kb-focus', !svg._ptr));
  listen(svg, 'blur', () => { svg.classList.remove('kb-focus'); svg._ptr = false; });
  listen(svg, 'keydown', () => { svg._ptr = false; svg.classList.add('kb-focus'); }, true);
  listen(svg, 'contextmenu', (e) => { if (lastMode === 'touch') e.preventDefault(); });

  /** One tap or click selects; a second on the same node, soon after, opens it. */
  function tap(n, e) {
    const now = performance.now();
    if (lastTap.n === n && now - lastTap.t < 420) {
      lastTap = { n: null, t: 0 }; select(null);
      if (e.altKey || e.metaKey || e.ctrlKey) act.openMain(n.i); else act.openTangent(n.i);
    } else { lastTap = { n, t: now }; select(n); }
  }
  function pin(n, on) {
    n.pinned = on; n.el.classList.toggle('is-pinned', on); if (!on) { n.mass = 1; n.anchor = 1; }
    if (on) { n.fx = n.x; n.fy = n.y; n.tx = n.x; n.ty = n.y; if (!n.pinEl) { n.pinEl = el('circle', { class: 'pinr', r: n.r + 2.6 }); n.vis.append(n.pinEl); } }
    else { n.fx = null; n.fy = null; kick(0.15); }
    announce(`${D.nodes[n.i].lab} ${on ? 'pinned' : 'released'}`);
  }

  /* ----- hover, select: one place decides which classes the picture wears ----- */
  const nearSet = (n) => {
    const s = new Set([n.i, focus]);
    for (const j of neighbours(n.i, S.hubs).all) if (byId.has(j)) s.add(j);
    return s;
  };
  function paintState() {
    const f = sel || hot, near = f ? nearSet(f) : null;
    svg.classList.toggle('has-sel', !!sel); svg.classList.toggle('has-hot', !sel && !!hot);
    for (const m of nodes) {
      const c = m.el.classList;
      c.toggle('is-sel', m === sel); c.toggle('is-hover', m === hot); c.toggle('is-near', !!near && near.has(m.i));
    }
    for (const l of links) l.el.classList.toggle('g-edge--hot', !!f && (l.a === f || l.b === f));
  }
  function setHot(n, quiet) {
    if (n === hot && !quiet) return;
    hot = n; setHover(n ? n.i : null, 'graph');
    if (!quiet) { if (!sel) { if (n && lastMode === 'mouse') showCard(n, false); else if (!n) card.hidden = true; } }
    paintState(); scheduleLabels();
  }
  function select(n) {
    sel = n || null;
    paintState();
    if (!sel) { card.hidden = true; scheduleLabels(); return; }
    showCard(sel, true); scheduleLabels();
    const { cites, citedBy } = counts(sel.i);
    announce(`${D.nodes[sel.i].lab}. ${D.deg[sel.i]} neighbours: cites ${cites}, cited by ${citedBy}. Press Enter to open.`);
  }
  function announce(t) { if (live) { live.textContent = ''; setTimeout(() => { if (!dead) live.textContent = t; }, 30); } }

  /* ----- the card ----- */
  const kindOf = (nd) => (nd.k && nd.k !== nd.r && !['root', 'record', 'register', 'reading', 'rooms-root'].includes(nd.k) ? nd.k : '');
  function showCard(n, sticky) {
    const nd = D.nodes[n.i], { cites, citedBy } = counts(n.i), xs = exprOf(n.i);
    const kind = [REGS[nd.r], kindOf(nd)].filter(Boolean).join(' · ');
    card.innerHTML = `<b>${esc(nd.lab)}</b><span class="gcard__where" style="--rc:var(--c-${nd.r})"><i></i>${esc(whereOf(n.i))}</span><span class="gcard__n gcard__k">${nd.coord ? esc(nd.coord) + ' · ' : ''}${esc(kind)}</span><span class="gcard__n">${D.deg[n.i]} neighbours · cites ${cites} · cited by ${citedBy}${n.pinned ? ' · pinned' : ''}</span>${xs.length ? `<span class="gcard__x"><svg width="12" height="12" aria-hidden="true"><use href="#i-expression"/></svg>${xs.length} Expression${xs.length > 1 ? 's' : ''}</span>` : ''}${sticky ? `<span class="gcard__act"><button type="button" data-open>Open page</button>${xs.length ? `<button type="button" data-open-x class="is-x">Open the Expression</button>` : '<i>or double-click</i>'}</span>` : ''}`;
    card.classList.toggle('is-sticky', sticky); card.classList.toggle('is-compact', H < 380 || W < 380); card.hidden = false;
    placeCard(n);
  }
  function placeCard(n) {
    const sx = n.x * view.k + view.x, sy = n.y * view.k + view.y, cw = card.offsetWidth, ch = card.offsetHeight, off = n.r * Math.sqrt(view.k) + 12;
    let x = sx + off, y = sy + off - 4;
    if (x + cw > W - 6) x = sx - cw - off;
    if (y + ch > H - 6) y = sy - ch - off + 4;
    card.style.transform = `translate(${Math.max(6, Math.min(x, W - cw - 6)).toFixed(0)}px, ${Math.max(6, y).toFixed(0)}px)`;
  }
  listen(card, 'click', (e) => {
    if (!sel) return;
    if (e.target.closest('[data-open-x]')) { const i = sel.i; select(null); act.openExpression(exprOf(i)[0]); }
    else if (e.target.closest('[data-open]')) { const i = sel.i; select(null); act.openTangent(i); }
  });

  /* ----- keyboard: the graph is one tab stop; arrows walk between the nodes ----- */
  function walk(dx, dy) {
    const from = sel || byId.get(focus); if (!from) return;
    let best = null, bs = Infinity;
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
  function reveal(n) {
    const sx = n.x * view.k + view.x, sy = n.y * view.k + view.y, m = 34;
    if (sx > m && sx < W - m && sy > m && sy < H - m) return;
    goTo({ k: view.k, x: view.x + (sx < m ? m - sx : sx > W - m ? W - m - sx : 0), y: view.y + (sy < m ? m - sy : sy > H - m ? H - m - sy : 0) });
  }
  listen(svg, 'keydown', (e) => {
    if (e.altKey) return;
    const k = e.key;
    if (k === 'ArrowRight') walk(1, 0); else if (k === 'ArrowLeft') walk(-1, 0); else if (k === 'ArrowDown') walk(0, 1); else if (k === 'ArrowUp') walk(0, -1);
    else if (k === 'Enter' || k === ' ') {
      const n = sel || byId.get(focus); if (!n) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey) { select(null); act.openMain(n.i); } else { select(null); act.openTangent(n.i); }
    }
    else if (k === 'Escape') { if (sel) select(null); else if (hot) setHot(null); else return; }
    else if (k === '0' && !e.metaKey && !e.ctrlKey) fit();
    else if (k === '+' || k === '=') zoomBy(1.4); else if (k === '-' || k === '_') zoomBy(1 / 1.4);
    else if (k === 'Home') { const f = byId.get(focus); if (f) { select(f); reveal(f); } }
    else if (k === 'p' && sel) pin(sel, !sel.pinned);
    else return;
    e.preventDefault(); e.stopPropagation();
  });

  /* ----- on-graph controls: zoom in, out, fit; and a polite voice for screen readers ----- */
  $('.gzoom', box)?.remove(); $('.sr-only', box)?.remove();
  zoomBox = document.createElement('div'); zoomBox.className = 'gzoom';
  zoomBox.innerHTML = `<button type="button" data-z="in" aria-label="Zoom in" title="Zoom in (+)">+</button><button type="button" data-z="out" aria-label="Zoom out" title="Zoom out (−)">−</button><button type="button" data-z="fit" aria-label="Fit the graph" title="Fit (0)"><svg width="13" height="13" aria-hidden="true"><use href="#i-fit"/></svg></button>`;
  live = document.createElement('div'); live.className = 'sr-only'; live.setAttribute('aria-live', 'polite');
  box.append(zoomBox, live);
  svg.setAttribute('role', 'application'); svg.setAttribute('aria-roledescription', 'interactive graph'); svg.setAttribute('tabindex', '0');
  listen(zoomBox, 'pointerdown', (e) => e.stopPropagation());
  listen(zoomBox, 'click', (e) => {
    const b = e.target.closest('[data-z]'); if (!b) return;
    if (b.dataset.z === 'in') zoomBy(1.4); else if (b.dataset.z === 'out') zoomBy(1 / 1.4); else fit();
  });

  /* ----- toolbar: one filter menu instead of persistent pills ----- */
  function drawMenu() {
    if (focus == null) return;
    const nb = neighbours(focus, S.hubs), c = {};
    for (const j of nb.all) c[D.nodes[j].r] = (c[D.nodes[j].r] || 0) + 1;
    const hubN = [...D.out[focus], ...D.in[focus]].filter((j) => D.nodes[j].hub).length;
    menu.innerHTML = `<div class="gm__sec"><span class="gm__h">Reach</span><div class="seg seg--sm"><button data-depth="1" aria-pressed="${S.depth === 1}">1 hop</button><button data-depth="2" aria-pressed="${S.depth === 2}">2 hops</button><button data-depth="3" aria-pressed="${S.depth === 3}">3 hops</button></div></div>
      <div class="gm__sec"><span class="gm__h">Show</span>${REG_ORDER.map((r) => `<label class="gm__row" style="--rc:var(--c-${r})"><input type="checkbox" data-reg="${r}" ${S.hidden.has(r) ? '' : 'checked'}><i></i><span>${REGS[r]}</span><b>${c[r] || 0}</b></label>`).join('')}
        <label class="gm__row gm__row--hub"><input type="checkbox" data-hubs ${S.hubs ? 'checked' : ''}><i></i><span>Index &amp; README pages</span><b>${hubN}</b></label></div>
      <div class="gm__foot"><button data-reset title="Lay the graph out again">Reset layout</button><button data-all>Show everything</button></div>`;
  }
  listen(filterBtn, 'click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; filterBtn.setAttribute('aria-expanded', String(!menu.hidden)); if (!menu.hidden) drawMenu(); });
  listen(document, 'pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target) && !filterBtn.contains(e.target)) { menu.hidden = true; filterBtn.setAttribute('aria-expanded', 'false'); } });
  listen(menu, 'change', (e) => {
    const t = e.target;
    if (t.dataset.reg) { t.checked ? S.hidden.delete(t.dataset.reg) : S.hidden.add(t.dataset.reg); }
    else if (t.hasAttribute('data-hubs')) S.hubs = t.checked;
    refresh(); drawMenu();
  });
  listen(menu, 'click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.depth) { S.depth = +b.dataset.depth; refresh(); drawMenu(); }
    else if ('reset' in b.dataset) { view = { k: 1, x: 0, y: 0 }; override = null; build(); }
    else if ('all' in b.dataset) { S.hidden.clear(); S.hubs = false; S.depth = 1; refresh(); drawMenu(); }
  });
  listen($('#graph-fit'), 'click', () => fit());

  /* ----- search hits dim the rest ----- */
  function applyHits() {
    const lit = S.hits && nodes.some((n) => S.hits.has(n.i));
    nodes.forEach((n) => n.el.classList.toggle('is-dim', !!lit && !n.focus && !S.hits.has(n.i)));
  }

  /* ----- connections (Quartz's backlinks, widened) — honours the same filter ----- */
  function renderConn() {
    if (focus == null) { connBody.innerHTML = ''; return; }
    const n = D.nodes[focus], nb = neighbourSet(), outS = new Set(nb.out), inS = new Set(nb.inn), groups = {};
    for (const j of nb.all) (groups[D.nodes[j].r] = groups[D.nodes[j].r] || []).push(j);
    const hubHidden = !S.hubs && !n.hub ? [...D.out[focus], ...D.in[focus]].filter((j) => D.nodes[j].hub).length : 0;
    const filtered = nb.raw.length - nb.all.length;
    const isM = S.cur.m && D.nodes[S.cur.i].k === 'manuscript';
    const rows = REG_ORDER.filter((r) => groups[r]).map((r) => {
      const js = groups[r].sort((a, b) => a - b), arrow = (j) => (outS.has(j) && inS.has(j) ? '⇄' : outS.has(j) ? '→' : '←');
      return `<section class="conn__g" style="--rc:var(--c-${r})"><h4><i></i>${REGS[r]}<span>${js.length}</span></h4><ul>${js.slice(0, 40).map((j) => {
        const x = D.nodes[j];
        return `<li data-i="${j}"><a href="#" data-router-ignore="true" title="${esc(x.t)}"><span class="conn__a" title="${outS.has(j) && inS.has(j) ? 'mutual' : outS.has(j) ? 'cited here' : 'cites this'}">${arrow(j)}</span>${x.coord ? `<em>${esc(x.coord)}</em>` : ''}<span class="conn__t">${esc(x.lab)}</span>${exprOf(j).length ? `<span class="conn__x" title="Has an Expression"><svg width="11" height="11" aria-hidden="true"><use href="#i-expression"/></svg></span>` : ""}<span class="conn__w">${esc(whereOf(j).split(' › ').slice(-1)[0])}</span></a></li>`;
      }).join('')}</ul>${js.length > 40 ? `<p class="conn__more">+${js.length - 40} more</p>` : ''}</section>`;
    }).join('');
    connBody.innerHTML = `<div class="conn__head"><h3>${isM ? 'Connections at M' + pad(S.cur.m) : 'Connections'}</h3><b class="conn__title">${esc(n.lab)}</b>
      <span class="conn__counts">${REG_ORDER.filter((r) => groups[r]).map((r) => `<span style="--rc:var(--c-${r})"><i></i>${groups[r].length}</span>`).join('')}<em>${nb.out.length} cites · ${nb.inn.length} cited by${filtered ? ` · ${filtered} filtered` : ''}</em></span></div>
      ${rows || `<p class="conn__none">${filtered ? 'Everything here is filtered out. <button class="linkbtn" data-allf>Show all</button>' : 'No links in or out of this page.'}</p>`}
      ${hubHidden ? `<p class="conn__hubs">${hubHidden} index &amp; README page${hubHidden === 1 ? '' : 's'} left out. <button class="linkbtn" data-hubs>Include</button></p>` : ''}`;
  }
  listen(connBody, 'click', (e) => {
    if (e.target.closest('[data-hubs]')) { S.hubs = true; refresh(); return; }
    if (e.target.closest('[data-allf]')) { S.hidden.clear(); refresh(); return; }
    const li = e.target.closest('li[data-i]'); if (!li) return; e.preventDefault(); act.openTangent(+li.dataset.i);
  });
  listen(connBody, 'pointerover', (e) => { const li = e.target.closest('li[data-i]'); if (li) setHover(+li.dataset.i, 'list'); });
  listen(connBody, 'pointerleave', () => setHover(null, 'list'));

  sub('hover', ({ i, from }) => {
    if (from === 'graph') return;
    $$('.gn.is-hot', svg).forEach((g) => g.classList.remove('is-hot'));
    if (i != null) byId.get(i)?.el.classList.add('is-hot');
  });

  function refresh() { focus = focusIndex(); view = { k: 1, x: 0, y: 0 }; override = null; build(); renderConn(); if (!menu.hidden) drawMenu(); }
  function size() { const w = box.clientWidth, h = box.clientHeight; if (!w || !h) { W = 0; return; } if (w !== W || h !== H) { W = w; H = h; build(); } }
  observe(box, size);   // gated: a collapsed pane has nothing to draw
  sub('locus', refresh);
  sub('position', () => { const f = focusIndex(); if (f !== focus) refresh(); });
  sub('hits', applyHits);
  { const t = (fn) => { let id = 0; sub('view', () => { clearTimeout(id); id = setTimeout(fn, 60); }); mountCleanup(() => clearTimeout(id)); }; t(size); }
  refresh();
  size();
  // a handle for tests and for measuring: not part of the page's behaviour
  window.OI = Object.assign(window.OI ?? {}, { graph: {
    nodes: () => nodes, links: () => links, view: () => ({ ...view }), selected: () => sel?.i ?? null, size: () => ({ W, H }),
    fit, select: (i) => select(byId.get(i) ?? null), step, moving: () => tween || heat > 0,
    /** Lay out an arbitrary set of pages (first is the centre) with the same engine: for measuring only. */
    stress: (ids) => { override = ids; build(); },
  } });
}
