// @ts-nocheck
/* ───────── field: the local graph, as Quartz has it — plus drag, pan, zoom, select, double-click ─────────
   Click selects (card), drag moves a node, drag on the background pans, wheel zooms, double-click opens the node
   as a tangent. Nodes are held to their register's sector by a soft spring, so the picture stays legible but you
   can still arrange it. Centred on the reading position (movement 16's neighbourhood at M16), not on the 1.6 MB
   manuscript node. Connections (Quartz's backlinks, widened) honour the same filter.                              */
import { $, $$, D, S, REGS, REG_ORDER, act, counts, emit, esc, exprOf, listen, neighbours, observe, pad, setHover, shortTitle, sub, whereOf, loadExpressions } from './core'

export function mountGraph() {

  const box = $('#graph-container'), svg = $('#graph-svg'), card = $('#gcard'), connBody = $('#conn-body');
  const menu = $('#gmenu'), countEl = $('#graph-count'), filterBtn = $('#graph-filter');
  if (!box || !svg || !card || !connBody || !menu || !countEl || !filterBtn) return;
  const NS = 'http://www.w3.org/2000/svg';
  let W = 0, H = 0, focus = null, nodes = [], links = [], byId = new Map(), sectors = [], view = { k: 1, x: 0, y: 0 };
  let lastTap = { n: null, t: 0 }, alpha = 0, raf = 0, sel = null, hot = null, drag = null, pan = null, cx = 0, cy = 0;
  let gView, gSec, gEdge, gNode;

  const focusIndex = () => {
    const c = S.cur; if (c.i == null) return null;
    const n = D.nodes[c.i];
    return n.s === 'THE-RETURN-OF-ZERO' && c.m && D.moves[c.m] ? D.moves[c.m].i : c.i;
  };
  const filtersActive = () => S.hidden.size > 0 || S.hubs || S.depth > 1;

  /* ----- one filter, used by the graph AND the connections list ----- */
  const allowed = (j) => !S.hidden.has(D.nodes[j].r);
  function neighbourSet() {
    const nb = neighbours(focus, S.hubs);
    return { out: nb.out.filter(allowed), inn: nb.inn.filter(allowed), all: nb.all.filter(allowed), raw: nb.all };
  }

  /* ----- build ----- */
  function pick() {
    const nb = neighbourSet();
    const cap = Math.max(12, Math.min(36, Math.round((W * H) / 6000)));   // a compact sidebar draws fewer nodes than the field view
    const direct = nb.all.slice().sort((a, b) => D.deg[b] - D.deg[a]).slice(0, cap).sort((a, b) => a - b);
    const seen = new Set([focus, ...direct]), second = [];
    if (S.depth >= 2) {
      for (const j of direct.slice().sort((a, b) => D.deg[b] - D.deg[a]).slice(0, 16)) {
        for (const k of neighbours(j, S.hubs).all) if (!seen.has(k) && allowed(k) && second.length < 36) { seen.add(k); second.push({ i: k, parent: j }); }
      }
    }
    return { direct, second, nb };
  }
  const radius = (i) => Math.min(8, 3 + Math.sqrt(D.deg[i]) * 0.38);

  function build() {
    if (!W || !H || focus == null) { if (svg.firstChild) svg.innerHTML = ''; nodes = []; return; }
    const { direct, second, nb } = pick();
    cx = W / 2; cy = H / 2;
    const Rx = Math.max(60, W / 2 - 58), Ry = Math.max(60, H / 2 - 34);
    const out = new Set(nb.out), inn = new Set(nb.inn);
    const groups = REG_ORDER.map((r) => ({ r, ids: direct.filter((j) => D.nodes[j].r === r) })).filter((g) => g.ids.length);
    const GAP = 14, total = 360 - GAP * groups.length, wt = (g) => Math.pow(g.ids.length, 0.8), wsum = groups.reduce((s, g) => s + wt(g), 0);
    let a = -90 + GAP / 2;
    nodes = []; links = []; byId = new Map(); sectors = [];
    const fnode = { i: focus, x: cx, y: cy, tx: cx, ty: cy, fx: cx, fy: cy, vx: 0, vy: 0, r: 7, depth: 0, focus: true };
    nodes.push(fnode); byId.set(focus, fnode);
    for (const g of groups) {
      const span = Math.max(14, (total * wt(g)) / wsum);
      sectors.push({ r: g.r, a0: a, a1: a + span, n: g.ids.length });
      g.ids.forEach((j, k) => {
        const ang = a + (span * (k + 0.5)) / g.ids.length, rr = g.ids.length > 7 ? (k % 2 ? 0.82 : 0.5) : 0.66, t = (ang * Math.PI) / 180;
        const x = cx + Rx * rr * Math.cos(t), y = cy + Ry * rr * Math.sin(t);
        const nd = { i: j, x, y, tx: x, ty: y, vx: 0, vy: 0, r: radius(j), depth: 1, ang, dir: out.has(j) && inn.has(j) ? 'both' : out.has(j) ? 'out' : 'in', homeX: x, homeY: y };
        nodes.push(nd); byId.set(j, nd); links.push({ a: fnode, b: nd, depth: 1 });
      });
      a += span + GAP;
    }
    second.forEach((s, k) => {
      const p = byId.get(s.parent); if (!p) return;
      const t = ((p.ang + (k % 2 ? 6 : -6) * (1 + (k % 3))) * Math.PI) / 180;
      const x = cx + Rx * 1.0 * Math.cos(t), y = cy + Ry * 1.0 * Math.sin(t);
      const nd = { i: s.i, x, y, tx: x, ty: y, vx: 0, vy: 0, r: radius(s.i) * 0.75, depth: 2, ang: p.ang, dir: 'in', homeX: x, homeY: y };
      nodes.push(nd); byId.set(s.i, nd); links.push({ a: p, b: nd, depth: 2 });
    });
    // DOM, built once per layout; ticks only move attributes
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    gView = el('g', { id: 'g-view' }); gSec = el('g'); gEdge = el('g'); gNode = el('g');
    gView.append(gSec, gEdge, gNode); svg.append(gView);
    applyView();
    for (const sc of sectors) {
      if (sc.a1 - sc.a0 >= 300) continue;
      const pts = []; const steps = Math.max(2, Math.round((sc.a1 - sc.a0) / 4));
      for (let s = 0; s <= steps; s++) { const t = (((sc.a0 + 1) + ((sc.a1 - sc.a0 - 2) * s) / steps) * Math.PI) / 180; pts.push(`${(cx + Rx * 1.1 * Math.cos(t)).toFixed(1)},${(cy + Ry * 1.1 * Math.sin(t)).toFixed(1)}`); }
      gSec.append(el('polyline', { class: 'g-sector', points: pts.join(' '), style: `stroke:var(--c-${sc.r})` }));
      const mid = ((sc.a0 + sc.a1) / 2) * Math.PI / 180, cs = Math.cos(mid), sn = Math.sin(mid);
      const label = `${REGS[sc.r].toUpperCase()} ${sc.n}`, len = label.length * 6.8;
      let anchor = cs > 0.25 ? 'start' : cs < -0.25 ? 'end' : 'middle';
      let tx = cx + Rx * 1.1 * cs + (anchor === 'start' ? 7 : anchor === 'end' ? -7 : 0);
      // keep the register label inside the picture: a label that would run off the edge sits against it instead
      if (anchor === 'end' && tx - len < 4) { anchor = 'start'; tx = 4; }
      else if (anchor === 'start' && tx + len > W - 4) { anchor = 'end'; tx = W - 4; }
      const ty = cy + Ry * 1.1 * sn + (sn > 0.6 ? 12 : sn < -0.6 ? -7 : 0);
      const t = el('text', { class: 'g-sector-l', x: tx.toFixed(1), y: ty.toFixed(1), 'text-anchor': anchor, style: `fill:var(--c-${sc.r})` }); t.textContent = label; gSec.append(t);
    }
    for (const l of links) { l.el = el('line', { class: `g-edge${l.b.dir === 'in' || l.depth === 2 ? ' g-edge--in' : ''}${l.depth === 2 ? ' g-edge--2' : ''}` }); gEdge.append(l.el); }
    for (const n of nodes) {
      const nd = D.nodes[n.i];
      n.el = el('g', { class: `gn${n.focus ? ' gn--focus' : ''}${S.visited.has(n.i) ? ' is-visited' : ''}`, 'data-i': n.i, style: `--rc:var(--c-${nd.r})` });
      if (n.focus) n.el.append(el('circle', { class: 'pulse', r: 9 }), el('circle', { class: 'ring', r: 11 }));
      n.dot = el('circle', { class: 'n', r: n.r }); if (n.focus) n.dot.setAttribute('style', 'fill:var(--gold-hi);fill-opacity:1');
      n.txt = el('text', { 'dominant-baseline': 'central' }); n.txt.textContent = ((nd.coord ? nd.coord + ' · ' : '') + nd.lab).replace(/^(.{27}).+$/, '$1…');
      if (exprOf(n.i).length) { n.el.classList.add('has-x'); n.el.append(el('circle', { class: 'xr', r: n.r + 3.6 })); }
      n.el.append(n.dot, n.txt); gNode.append(n.el);
    }
    sel = null; card.hidden = true;
    for (let t = 0; t < 70; t++) step(0.6);      // settle before first paint
    paint(); labels();
    alpha = 0.02; kick();
    countEl.textContent = nb.all.length;
    filterBtn.classList.toggle('is-on', filtersActive());
    applyHits();
  }
  const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  /* ----- physics: sector spring + repulsion + the spoke to its parent ----- */
  function step(a) {
    const n = nodes.length;
    for (let p = 0; p < n; p++) {
      const A = nodes[p]; if (A.fx != null) { A.x = A.fx; A.y = A.fy; A.vx = A.vy = 0; continue; }
      A.vx += (A.tx - A.x) * 0.05 * a; A.vy += (A.ty - A.y) * 0.05 * a;
    }
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      const A = nodes[p], B = nodes[q]; let dx = B.x - A.x, dy = B.y - A.y, d2 = dx * dx + dy * dy;
      const min = A.r + B.r + 14;
      if (d2 < min * min && d2 > 0.01) { const d = Math.sqrt(d2), f = ((min - d) / d) * 0.5 * a; dx *= f; dy *= f; if (A.fx == null) { A.vx -= dx; A.vy -= dy; } if (B.fx == null) { B.vx += dx; B.vy += dy; } }
    }
    for (const A of nodes) { if (A.fx != null) continue; A.vx *= 0.7; A.vy *= 0.7; A.x += A.vx; A.y += A.vy; }
  }
  function paint() {
    for (const l of links) { l.el.setAttribute('x1', l.a.x.toFixed(1)); l.el.setAttribute('y1', l.a.y.toFixed(1)); l.el.setAttribute('x2', l.b.x.toFixed(1)); l.el.setAttribute('y2', l.b.y.toFixed(1)); }
    for (const n of nodes) n.el.setAttribute('transform', `translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`);
  }
  function kick(a = 0.2) { alpha = Math.max(alpha, a); if (!raf) raf = requestAnimationFrame(loop); }
  function loop() {
    raf = 0; step(Math.min(1, alpha * 4)); paint(); alpha *= 0.96;
    if (alpha > 0.003) raf = requestAnimationFrame(loop); else labels();
  }

  /* ----- labels: greedy, by degree; selected / hovered / focus always shown ----- */
  function labels() {
    const placed = [];
    // the register labels around the ring are obstacles too: a node label may not sit on them
    for (const t of $$('text.g-sector-l', gSec)) {
      const len = t.textContent.length * 6.6, x = +t.getAttribute('x') * view.k + view.x, y = +t.getAttribute('y') * view.k + view.y, a = t.getAttribute('text-anchor');
      const x0 = a === 'end' ? x - len : a === 'middle' ? x - len / 2 : x;
      placed.push([x0 - 2, y - 11, x0 + len + 2, y + 3]);
    }
    const order = nodes.slice().sort((a, b) => (!!b.focus - !!a.focus) || (D.deg[b.i] - D.deg[a.i]));
    let shownN = 0;
    for (const n of order) {
      const text = n.txt.textContent, w = text.length * 5.6 + 6, side = n.focus ? 'mid' : n.x > cx + 8 ? 'r' : n.x < cx - 8 ? 'l' : 'mid';
      const sx = n.x * view.k + view.x, sy = n.y * view.k + view.y, rr = (n.r + 4) * view.k;
      let x0, y0 = sy - 7, anchor = 'start', ox = 0, oy = 0;
      if (n.focus) { anchor = 'middle'; ox = 0; oy = 25; x0 = sx - w / 2; y0 = sy + oy * view.k - 7; }
      else if (side === 'r') { x0 = sx + rr; ox = n.r + 4; }
      else if (side === 'l') { anchor = 'end'; x0 = sx - rr - w; ox = -(n.r + 4); }
      else { anchor = 'middle'; x0 = sx - w / 2; oy = (n.y > cy ? 1 : -1) * (n.r + 11); y0 = sy + oy * view.k - 7; }
      const r = [x0, y0, x0 + w, y0 + 14];
      const force = n.focus || n === sel || n === hot;
      const ok = r[0] > 2 && r[2] < W - 2 && r[1] > 2 && r[3] < H - 2 && !placed.some((p) => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1]);
      const show = force || (ok && shownN < 28);
      n.txt.setAttribute('x', ox); n.txt.setAttribute('y', oy); n.txt.setAttribute('text-anchor', anchor);
      n.txt.style.display = show ? '' : 'none';
      if (show) { placed.push(r); shownN++; }
    }
  }

  /* ----- view: pan + zoom ----- */
  function applyView() { gView?.setAttribute('transform', `translate(${view.x.toFixed(1)} ${view.y.toFixed(1)}) scale(${view.k.toFixed(3)})`); }
  function toWorld(ev) { const r = svg.getBoundingClientRect(); return { x: (ev.clientX - r.left - view.x) / view.k, y: (ev.clientY - r.top - view.y) / view.k }; }
  listen(svg, 'wheel', (e) => {
    e.preventDefault();
    const r = svg.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const k = Math.min(3.5, Math.max(0.45, view.k * Math.exp(-e.deltaY * 0.0015)));
    view.x = mx - ((mx - view.x) / view.k) * k; view.y = my - ((my - view.y) / view.k) * k; view.k = k;
    applyView(); clearTimeout(svg._lt); svg._lt = setTimeout(labels, 120);
  }, { passive: false });

  /* ----- pointer: node drag, background pan, click = select ----- */
  listen(svg, 'pointerdown', (e) => {
    if (e.button) return;
    const g = e.target.closest('.gn');
    svg.setPointerCapture(e.pointerId);
    if (g && !g.classList.contains('gn--focus')) { drag = { n: byId.get(+g.dataset.i), x: e.clientX, y: e.clientY, moved: false }; }
    else pan = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false, onFocus: !!g };
  });
  listen(svg, 'pointermove', (e) => {
    if (drag) {
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
      drag.moved = true; card.hidden = true;
      const w = toWorld(e); drag.n.fx = w.x; drag.n.fy = w.y; drag.n.tx = w.x; drag.n.ty = w.y;   // where you drop it is where it stays
      kick(0.3); svg.classList.add('is-dragging');
    } else if (pan) {
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      if (!pan.moved && Math.hypot(dx, dy) < 4) return;
      pan.moved = true; card.hidden = true; view.x = pan.vx + dx; view.y = pan.vy + dy; applyView(); svg.classList.add('is-dragging');
    }
  });
  const endPointer = (e) => {
    svg.classList.remove('is-dragging');
    if (drag) {
      const n = drag.n; n.fx = null; n.fy = null;
      if (!drag.moved) {
        // pointer capture retargets the click to the svg, so a double-click is timed by hand
        const now = performance.now();
        if (lastTap.n === n && now - lastTap.t < 380) { lastTap = { n: null, t: 0 }; select(null); act.openTangent(n.i); }
        else { lastTap = { n, t: now }; select(n, e); }
      } else { kick(0.15); setTimeout(labels, 400); }
      drag = null;
    } else if (pan) {
      if (!pan.moved) { if (pan.onFocus) select(byId.get(focus), e); else select(null); } else labels();
      pan = null;
    }
  };
  listen(svg, 'pointerup', endPointer);
  listen(svg, 'pointercancel', () => { drag = pan = null; svg.classList.remove('is-dragging'); });
  listen(svg, 'pointerover', (e) => {
    if (drag || pan) return;
    const g = e.target.closest('.gn'); if (!g) return;
    const n = byId.get(+g.dataset.i); if (!n || n.focus) return;
    hot = n; setHover(n.i, 'graph'); if (!sel) showCard(n, e); labels();
  });
  listen(svg, 'pointerout', (e) => {
    if (!e.target.closest('.gn')) return;
    hot = null; setHover(null, 'graph'); if (!sel) card.hidden = true; labels();
  });

  /* ----- select + card ----- */
  function select(n, e) {
    sel = n && n !== sel ? n : null;
    $$('.gn.is-sel', svg).forEach((g) => g.classList.remove('is-sel'));
    $$('.g-edge--hot', svg).forEach((l) => l.classList.remove('g-edge--hot'));
    svg.classList.toggle('has-sel', !!sel);
    if (!sel) { card.hidden = true; $$('.gn.is-near', svg).forEach((g) => g.classList.remove('is-near')); labels(); return; }
    sel.el.classList.add('is-sel');
    const near = new Set([sel.i, focus, ...neighbours(sel.i, S.hubs).all]);
    nodes.forEach((m) => m.el.classList.toggle('is-near', near.has(m.i)));
    links.forEach((l) => l.el.classList.toggle('g-edge--hot', l.a === sel || l.b === sel));
    showCard(sel, e, true); labels();
  }
  function showCard(n, e, sticky = false) {
    const nd = D.nodes[n.i], { cites, citedBy } = counts(n.i);
    card.innerHTML = `<b>${esc(nd.lab)}</b><span class="gcard__where" style="--rc:var(--c-${nd.r})"><i></i>${esc(whereOf(n.i))}</span><span class="gcard__n">${nd.coord ? esc(nd.coord) + ' · ' : ''}cites ${cites} · cited by ${citedBy}</span>${exprOf(n.i).length ? `<span class="gcard__x"><svg width="12" height="12" aria-hidden="true"><use href="#i-expression"/></svg>${exprOf(n.i).length} Expression${exprOf(n.i).length > 1 ? 's' : ''}</span>` : ''}${sticky ? `<span class="gcard__act"><button data-open>Open as tangent ↗</button>${exprOf(n.i).length ? `<button data-open-x class="is-x">Open the Expression</button>` : '<i>or double-click</i>'}</span>` : ''}`;
    card.classList.toggle('is-sticky', sticky); card.hidden = false;
    const sx = n.x * view.k + view.x, sy = n.y * view.k + view.y, cw = card.offsetWidth, ch = card.offsetHeight;
    let x = sx + 16, y = sy + 14;
    if (x + cw > W - 6) x = sx - cw - 16;
    if (y + ch > H - 6) y = sy - ch - 14;
    card.style.transform = `translate(${Math.max(6, x)}px, ${Math.max(6, y)}px)`;
  }
  listen(card, 'click', (e) => { if (e.target.closest('[data-open-x]') && sel) { const i = sel.i; select(null); act.openExpression(exprOf(i)[0]); } else if (e.target.closest('[data-open]') && sel) { const i = sel.i; select(null); act.openTangent(i); } });

  /* ----- toolbar: one filter menu instead of persistent pills ----- */
  function drawMenu() {
    if (focus == null) return;
    const nb = neighbours(focus, S.hubs), c = {};
    for (const j of nb.all) c[D.nodes[j].r] = (c[D.nodes[j].r] || 0) + 1;
    const hubN = [...D.out[focus], ...D.in[focus]].filter((j) => D.nodes[j].hub).length;
    menu.innerHTML = `<div class="gm__sec"><span class="gm__h">Reach</span><div class="seg seg--sm"><button data-depth="1" aria-pressed="${S.depth === 1}">1 hop</button><button data-depth="2" aria-pressed="${S.depth === 2}">2 hops</button></div></div>
      <div class="gm__sec"><span class="gm__h">Show</span>${REG_ORDER.map((r) => `<label class="gm__row" style="--rc:var(--c-${r})"><input type="checkbox" data-reg="${r}" ${S.hidden.has(r) ? '' : 'checked'}><i></i><span>${REGS[r]}</span><b>${c[r] || 0}</b></label>`).join('')}
        <label class="gm__row gm__row--hub"><input type="checkbox" data-hubs ${S.hubs ? 'checked' : ''}><i></i><span>Index &amp; README pages</span><b>${hubN}</b></label></div>
      <div class="gm__foot"><button data-reset>Reset layout</button><button data-all>Show everything</button></div>`;
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
    else if ('reset' in b.dataset) { view = { k: 1, x: 0, y: 0 }; build(); }
    else if ('all' in b.dataset) { S.hidden.clear(); S.hubs = false; S.depth = 1; refresh(); drawMenu(); }
  });
  listen($('#graph-fit'), 'click', () => { view = { k: 1, x: 0, y: 0 }; applyView(); labels(); });

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
    const isM = S.cur.m && D.nodes[S.cur.i].s === 'THE-RETURN-OF-ZERO';
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

  function refresh() { focus = focusIndex(); view = { k: 1, x: 0, y: 0 }; build(); renderConn(); if (!menu.hidden) drawMenu(); }
  function size() { const w = box.clientWidth, h = box.clientHeight; if (!w || !h) { W = 0; return; } if (w !== W || h !== H) { W = w; H = h; build(); } }
  observe(box, size);   // gated: a collapsed pane has nothing to draw
  sub('locus', refresh);
  sub('position', () => { const f = focusIndex(); if (f !== focus) refresh(); });
  sub('hits', applyHits);
    sub('view', () => setTimeout(size, 60));
  refresh();
  size();
}
