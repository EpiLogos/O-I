/* crew-monarch.js — the monarch crews (CREW-NOTES-MONARCH-FLIGHT.md). A scene for creature-crew.js: whole monarchs in profile (creature-monarch-flight.js, kind:'fly').
   RELAY: four generations along one migration route, each a whole monarch that flies its leg (flap and glide), lands on milkweed, nectars, lays eggs and ends; the next (an egg, a larva that eats and crawls to the bough, the figure's own
   chrysalis, then the emerged adult, pumped open) takes the bearing on from where the last left off. The bearing is the sun-compass heading: a dashed line from whoever holds it, and the baton you can see pass from adult to egg to larva to case to adult.
   RELAY BREAK: a storm takes the second generation; a sibling from the same clutch carries the bearing on, so the route goes on with fewer.
   METAMORPH: Count One: the chrysalis hangs and beats, the adult comes out, the wings are pumped open, the first flight.
   The world is in the creature's canvas units at the crew's scale (KS): every patch is the creature page's own scene (the milkweed, its leaf, the bough the case hangs from) stood on the ground at the crew's scale, so a figure that lands on it lands
   where it lands on its own page. Every figure of a pattern is built once; the unborn and the spent are hidden and wait where the camera is, so the crew is whole and never leaves the pane. */
(() => {
'use strict';
const K = window.CreatureKit, CC = window.CreatureCrew, NS = 'http://www.w3.org/2000/svg';
const MF = K.get('monarch-flight').mf, PIV = MF.pivot, KS = 1.6, GYC = MF.ground, SY = -(GYC - PIV[1]) * KS;      // KS: the crew's scale on the creature's canvas; SY: the sheet's height when the feet stand on the ground
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v, sm = (dt, k) => 1 - Math.exp(-dt / k), lerp = (a, b, u) => a + (b - a) * u, hypot = Math.hypot;
const el = (tag, a = {}, par) => { const e = document.createElementNS(NS, tag); for(const k in a) e.setAttribute(k, a[k]); if(par) par.appendChild(e); return e; };
const GAP = 1560, ROUTE = [0, 1, 2, 3, 4].map(j => ({x:j * GAP, name:['the oyamel firs · Mexico', 'Texas · the first milkweed', 'the Midwest · farmland', 'the northern plains', 'the north · Canada'][j]}));
const S_ = j => [ROUTE[j].x, j === 0 ? SY - 760 : SY];                                    // the sheet's place over patch j when a figure stands on its plant
const W_ = (S, p) => [S[0] + (p[0] - PIV[0]) * KS, S[1] + (p[1] - PIV[1]) * KS];             // a canvas point of the creature's scene, in the world, at patch S
const ALT = -1150;                                                   // the cruise height of a sheet
const BEARING = 28;                                                  // degrees the heading makes with the sun: the inherited number the relay carries
const cw = (m, p) => { const f = m.fl, dx = p[0] - PIV[0], dy = p[1] - PIV[1], cp = Math.cos(f.pitch), sp = Math.sin(f.pitch); return [f.x + f.face * KS * (dx * cp + dy * sp), f.y + KS * (-dx * sp + dy * cp)]; };   // a canvas point of a figure, in the world (the host's sheet: mirrored by face, pitched, scaled)

CC.page({title:'MONARCH', sign:'', sub:'the relay: four generations on one bearing', view:{x:-1700, y:-2300, w:3400, h:3400},
  setup(crew){
    const add = (name, role, start, seed) => crew.add({def:'monarch-flight', name, role, kind:'fly', scale:KS, at:[0, SY - 760], h:0, radius:KS * 150, seed, speed:280, start});
    const G = [add('G1', 'first generation', 'roost', 5), add('G2', 'second generation', 'chrysalis', 18), add('G3', 'third generation', 'chrysalis', 31), add('G4', 'fourth generation', 'chrysalis', 44), add('G2b', 'sibling of the second', 'chrysalis', 57)];
    for(const m of G){ m.allow(...G.filter(o => o !== m)); m.parked = true; m.wrap.style.display = 'none'; m.fade = 0; if(!crew.virtual) m.c.pause(true); }
    const C = G[0].c.C, hx = K.intHex, mix = K.mixInt, MAL = K.hexInt(K.ROSTER.malachite), GOLDI = K.hexInt(K.ROSTER.gold), AMB = K.hexInt(K.ROSTER.amber);
    const lineC = (t = .7, tone = C.bone, k = .3) => hx(mix(C.skin, mix(C.ink, tone, k), t)), fillC = (t, tone = C.ink) => hx(mix(C.skin, tone, t));
    const plantLine = t => hx(mix(C.skin, mix(MAL, C.bone, .25), t)), plantFill = t => hx(mix(C.skin, MAL, t));
    crew.limits = {frame:125, step48:310, jerk48:340, reason:'the wingbeat: a monarch beats 3.5 a second here (about 17 frames a cycle), so the wing chain moves up to 110 units a frame on the figure\'s 1000-unit canvas against the lion\'s 40 (CREW-NOTES-MONARCH-FLIGHT.md, "The beat" and "Limits")'};

    /* ---------- the world ---------- */
    const U = crew.habitat.under, O = crew.habitat.over, gW = el('g', {}, U);
    crew.sand({rect:[-2800, 0, 8800, 2600], crest:0, seed:9});
    const path = (d, a, par = gW) => el('path', {d, fill:'none', 'stroke-linecap':'round', 'stroke-linejoin':'round', ...a}, par);
    const poly = (pts, a, par = gW) => el('path', {d:'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z', 'stroke-linejoin':'round', ...a}, par);
    const line = pts => 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
    /* the horizon (two ranges of hills) and the ground line */
    { const hills = (amp, base, f, ph, tone, w) => { const pts = []; for(let x = -2800; x <= 8800; x += 160) pts.push([x, base - amp * Math.sin(x * f + ph) - amp * .5 * Math.sin(x * f * 2.6 + 1)]); path(line(pts), {stroke:lineC(tone, C.bone, .2), 'stroke-width':w}); };
      hills(70, -120, .0011, 0, .28, 6); hills(36, -50, .0017, 2, .45, 8); }
    path('M-2800 0H8800', {stroke:lineC(.95, C.bone, .4), 'stroke-width':14});
    /* the farmland: furrows through the middle of the route, and the names of the places */
    for(const [y, w] of [[90, 6], [190, 6], [320, 7], [480, 8], [680, 9]]) path(`M${ROUTE[1].x + 500} ${y}H${ROUTE[3].x + 700}`, {stroke:lineC(.32, C.bone, .1), 'stroke-width':w, 'stroke-dasharray':'260 120'});
    ROUTE.forEach(r => { const t = el('text', {x:r.x, y:900, 'text-anchor':'middle', 'font-family':'ui-monospace,Menlo,monospace', 'font-size':64, 'letter-spacing':6, fill:lineC(.5, C.bone, .2)}, gW); t.textContent = r.name.toUpperCase(); });
    /* the firs of the overwintering forest, and the long bough one of them gives the first generation to roost on, at the height its feet stand */
    const fir = (x, h, w, dim = 1) => { const n = 8, tiers = []; for(let i = 0; i < n; i++){ const y0 = -h + h * .08 + i * h * .105, y1 = y0 + h * .19, ww = w * (.28 + .72 * (i + 1) / n); tiers.push(`M${x} ${y0}L${x - ww} ${y1}H${x + ww}Z`); }
      path(tiers.join(''), {stroke:plantLine(.55 * dim), 'stroke-width':7, fill:plantFill(.13 * dim)}); path(`M${x} ${-h * .1}V0`, {stroke:plantLine(.5 * dim), 'stroke-width':12}); };
    const A0 = W_(S_(0), MF.anchor.roost);
    { [[-1500, 2300, 360, .45], [-1050, 2500, 400, .55], [-620, 3400, 520, .85], [560, 2100, 330, .5], [1000, 2400, 380, .42], [1420, 1950, 300, .35]].forEach(([dx, h, w, dim]) => fir(A0[0] + dx, h, w, dim));
      path(`M${A0[0] - 620} 0V${A0[1] + 60}`, {stroke:lineC(.9, C.bone, .3), 'stroke-width':44}); path(`M${A0[0] - 620} 0V${A0[1] + 60}`, {stroke:fillC(.4, C.umber), 'stroke-width':28});
      const tx = A0[0] - 620, by = A0[1] + 18, bo = []; for(let i = 0; i <= 20; i++){ const u = i / 20; bo.push([lerp(tx, A0[0] + 260, u), by + 16 * (1 - u) - 4 * Math.sin(u * 6)]); }
      path(line(bo), {stroke:lineC(.9, C.bone, .3), 'stroke-width':36}); path(line(bo), {stroke:fillC(.4, C.umber), 'stroke-width':22});
      for(let i = 0; i < 46; i++){ const u = i / 45, x = lerp(tx + 90, A0[0] + 250, u), up = i % 2 ? -1 : 1, y = by + 5 * up, L = 70 + 40 * Math.sin(i * 2.1) ** 2; path(`M${x.toFixed(1)} ${y.toFixed(1)}l${-40 - 20 * ((i * 7) % 3)} ${up * L}`, {stroke:plantLine(.7), 'stroke-width':5}); } }
    /* a patch: the creature page's own scene (milkweed with its umbel, its leaf, a shrub with the bough the case hangs from) at the crew's scale, standing on the ground at sheet S */
    const patches = [];
    const lp = (c, a, L, w, n = 18) => { const ca = Math.cos(a), sa = Math.sin(a), side = k => Array.from({length:n + 1}, (_, i) => { const u = i / n, v = k * w * Math.pow(Math.sin(Math.PI * Math.pow(u, .8)), .85); return [c[0] + ca * L * u - sa * v, c[1] + sa * L * u + ca * v]; }); return side(1).concat(side(-1).reverse().slice(1, -1)); };
    const drawPatch = (j, shrub) => {
      const S = S_(j), P = p => W_(S, p), g = el('g', {}, gW), pt = (pts, a) => poly(pts.map(P), a, g);
      path(line([[MF.stem, GYC], [MF.stem - 2, 700], [MF.stem + 2, 620], [MF.stem, 580]].map(P)), {stroke:plantLine(.8), 'stroke-width':9 * KS}, g);
      const L0 = MF.leaf[0], L1 = MF.leaf[1], ang = Math.atan2(L1[1] - L0[1], L1[0] - L0[0]), LL = hypot(L1[0] - L0[0], L1[1] - L0[1]);
      pt(lp(L0, ang, LL, MF.leafW), {stroke:plantLine(.85), 'stroke-width':5, fill:plantFill(.3)}); path(line([L0, L1].map(P)), {stroke:plantLine(.5), 'stroke-width':4}, g);
      pt(lp([MF.stem + 4, 640], .12, LL * .72, MF.leafW * 1.1), {stroke:plantLine(.55), 'stroke-width':4, fill:plantFill(.16)});          // the opposite leaf, the other way
      const cen = MF.umbel, flo = [cen, ...Array.from({length:7}, (_, i) => [cen[0] + Math.cos(i * 6.2832 / 7 + .3) * 26, cen[1] + Math.sin(i * 6.2832 / 7 + .3) * 20]), ...Array.from({length:11}, (_, i) => [cen[0] + Math.cos(i * 6.2832 / 11) * 45, cen[1] + Math.sin(i * 6.2832 / 11) * 30])];
      for(const f of flo){ const q = P(f); el('circle', {cx:q[0], cy:q[1], r:8.6 * KS, fill:fillC(.28), stroke:lineC(.8, C.bone, .4), 'stroke-width':4}, g); el('circle', {cx:q[0], cy:q[1], r:3 * KS, fill:lineC(.7, C.bone, .5)}, g); }
      if(shrub){
        const tr = [[124, GYC], [118, 600], [122, 330], [114, 128]].map(P); path(line(tr), {stroke:lineC(.85, C.bone, .3), 'stroke-width':20 * KS}, g); path(line(tr), {stroke:fillC(.4, C.umber), 'stroke-width':12 * KS}, g);
        MF.bough.forEach((b, i, a) => { if(!i) return; const q = line([P([a[i - 1][0], a[i - 1][1]]), P([b[0], b[1]])]); path(q, {stroke:lineC(.85, C.bone, .3), 'stroke-width':2 * b[2] * KS}, g); path(q, {stroke:fillC(.4, C.umber), 'stroke-width':1.4 * b[2] * KS}, g); });
        [[330, 106, -1.62, 66, 17], [440, 100, -1.5, 70, 18], [160, 124, 1.75, 62, 16], [330, 108, 1.55, 76, 18], [500, 100, 1.5, 70, 17], [90, 122, 2.2, 60, 14]].forEach(([x, y, a, l, w]) => pt(lp([x, y], a, l, w, 9), {stroke:plantLine(.7), 'stroke-width':4, fill:plantFill(.3)}));
        for(let k = 0; k < 18; k++){ const u = k / 17, x = lerp(100, 580, u), y = lerp(122, 98, u), a = -1.3 - 1.6 * Math.sin(k * 2.7) , l = 52 + 26 * Math.sin(k * 1.9) ** 2; pt(lp([x, y + 4], k % 2 ? a : -a - 3.1, l, 14, 8), {stroke:plantLine(.55), 'stroke-width':4, fill:plantFill(.2)}); }
        for(let k = 0; k < 7; k++){ const y = lerp(180, 580, k / 6), x = 120 + 4 * Math.sin(k); pt(lp([x, y], k % 2 ? .5 : Math.PI - .5, 54, 12, 8), {stroke:plantLine(.5), 'stroke-width':4, fill:plantFill(.16)}); }
      }
      patches[j] = {S, P, g, eggs:MF.eggs.map(x => { const q = P([x, MF.leafTop(x) - 3.4]); return el('ellipse', {cx:q[0], cy:q[1], rx:4.4 * KS * 1.2, ry:5.6 * KS * 1.2, fill:hx(mix(C.skin, C.bone, .55)), stroke:lineC(.9, C.bone, .4), 'stroke-width':3, opacity:0}, g); })};
    };
    for(let j = 1; j <= 4; j++) drawPatch(j, j <= 3);
    /* the farmland (a barn and a silo, a fence) behind the Midwest patch, and the north (spruce and a lake) behind the last */
    { const bx = ROUTE[2].x + 760, st = (c = .5) => ({stroke:lineC(c, C.bone, .25), 'stroke-width':7, fill:fillC(.1, C.umber)});
      poly([[bx - 380, 0], [bx - 380, -330], [bx - 190, -470], [bx, -330], [bx, 0]], st(.55)); path(`M${bx - 380} -330H${bx}M${bx - 280} 0V-250H${bx - 100}V0`, {stroke:lineC(.4, C.bone, .2), 'stroke-width':6});
      poly([[bx + 60, 0], [bx + 60, -520], [bx + 150, -580], [bx + 240, -520], [bx + 240, 0]], st(.5)); path(`M${bx + 60} -420H${bx + 240}M${bx + 60} -300H${bx + 240}`, {stroke:lineC(.35, C.bone, .2), 'stroke-width':5});
      for(let i = 0; i < 14; i++){ const x = ROUTE[2].x - 900 + i * 78; path(`M${x} 0V-120M${x - 6} -100H${x + 84}M${x - 6} -60H${x + 84}`, {stroke:lineC(.32, C.bone, .15), 'stroke-width':5}); }
      const nx = ROUTE[4].x; [[-900, 1200, 220, .4], [-560, 1500, 260, .5], [640, 1300, 240, .42], [980, 1600, 270, .36], [1300, 1100, 200, .3]].forEach(([dx, h, w, dim]) => fir(nx + dx, h, w, dim));
      const lake = []; for(let i = 0; i <= 30; i++) lake.push([nx - 560 + i * 36, 40 + 8 * Math.sin(i * .9)]); path(line(lake), {stroke:hx(mix(C.skin, mix(C.lapis, C.bone, .4), .75)), 'stroke-width':8});
      for(const [dx, y, w] of [[-380, 100, 500], [-120, 170, 760], [-460, 250, 380], [160, 300, 560], [-200, 420, 440]]) path(`M${nx + dx} ${y}h${w}`, {stroke:hx(mix(C.skin, mix(C.lapis, C.bone, .35), .5)), 'stroke-width':6, 'stroke-dasharray':'120 70'}); }
    /* weeds between the patches: the milkweed is everywhere along the route */
    for(let j = 0; j < 4; j++) for(const u of [.3, .5, .7]){ const x = ROUTE[j].x + GAP * u + 70 * Math.sin(j * 9 + u * 7), h = 200 + 80 * Math.sin(j * 5 + u * 11); path(`M${x.toFixed(0)} 0V${-h.toFixed(0)}`, {stroke:plantLine(.45), 'stroke-width':8});
      for(let i = 0; i < 6; i++){ const a = i * 1.05; el('circle', {cx:(x + 22 * Math.cos(a)).toFixed(0), cy:(-h - 22 + 14 * Math.sin(a)).toFixed(0), r:12, fill:fillC(.2), stroke:lineC(.5, C.bone, .3), 'stroke-width':4}, gW); } }

    /* ---------- the larva: a habitat object that eats, grows, crawls from the leaf to the bough and hangs there (two for the sibling) ---------- */
    const mkLarva = () => { const L = {g:el('g', {opacity:0}, gW), segs:[], s:0, r:4, path:null, len:[0], speed:0, gr:0, on:false};
      for(let i = 0; i < 10; i++) L.segs.push(el('ellipse', {rx:1, ry:1, 'stroke-width':3}, L.g));
      L.fil = [0, 1].map(() => el('path', {fill:'none', stroke:lineC(.9, C.bone, .4), 'stroke-width':3, 'stroke-linecap':'round'}, L.g));
      L.setPath = pts => { L.path = pts; L.len = [0]; for(let i = 1; i < pts.length; i++) L.len.push(L.len[i - 1] + hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); };
      L.at = s => { const Pp = L.path, Ln = L.len; s = clamp(s, 0, Ln[Ln.length - 1]); let k = 1; while(k < Pp.length - 1 && Ln[k] < s) k++; const u = (s - Ln[k - 1]) / ((Ln[k] - Ln[k - 1]) || 1); return [lerp(Pp[k - 1][0], Pp[k][0], u), lerp(Pp[k - 1][1], Pp[k][1], u), Math.atan2(Pp[k][1] - Pp[k - 1][1], Pp[k][0] - Pp[k - 1][0])]; };
      L.end = () => L.len[L.len.length - 1];
      L.draw = now => { const r = L.r, sp = r * 1.45, dark = hx(mix(C.skin, C.ink, .55)), pale = hx(mix(C.skin, C.bone, .55)), yel = hx(mix(C.skin, GOLDI, .7)), edge = lineC(.9, C.bone, .4);
        L.segs.forEach((e, i) => { const q = L.at(L.s - i * sp), wig = Math.sin(now * .012 - i * .9) * .12 * r * L.gr, k = i === 0 ? 1.08 : 1 - .03 * i, a = q[2] * 180 / Math.PI, cx = q[0] - wig * Math.sin(q[2]), cy = q[1] + wig * Math.cos(q[2]);
          e.setAttribute('cx', cx.toFixed(1)); e.setAttribute('cy', cy.toFixed(1)); e.setAttribute('rx', (r * .92 * k).toFixed(1)); e.setAttribute('ry', (r * 1.05 * k * (1 + .06 * L.gr * Math.sin(now * .012 - i * .9))).toFixed(1));
          e.setAttribute('transform', `rotate(${a.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})`); e.setAttribute('fill', i === 0 ? dark : i % 3 === 1 ? pale : i % 3 === 2 ? yel : dark); e.setAttribute('stroke', edge); });
        const h = L.at(L.s), hs = Math.sin(h[2]), hc = Math.cos(h[2]);
        L.fil[0].setAttribute('d', `M${(h[0] + hc * r).toFixed(1)} ${(h[1] + hs * r - r * .6).toFixed(1)}q${(r * .8).toFixed(1)} ${(-r * 1.4).toFixed(1)} ${(r * 1.8).toFixed(1)} ${(-r * 1.1).toFixed(1)}`);
        L.fil[1].setAttribute('d', `M${(h[0] - hc * r * .1).toFixed(1)} ${(h[1] - r * .9).toFixed(1)}q${(-r * .4).toFixed(1)} ${(-r * 1.4).toFixed(1)} ${(r * .9).toFixed(1)} ${(-r * 1.6).toFixed(1)}`); };
      return L; };
    const larvae = [mkLarva(), mkLarva()];

    /* ---------- the bearing (the baton): a dashed heading from whoever holds it, the sun-compass ring at its tail ---------- */
    const GOLDL = hx(mix(C.skin, mix(C.bone, GOLDI, .5), .9));
    const mkBaton = () => { const b = {g:el('g', {opacity:0}, O), o:[0, 0], len:0, tlen:0, fn:null, holder:'', hist:[], bearing:BEARING, fade:1, dash:0, pulse:0, has:false};
      b.line = el('path', {fill:'none', stroke:GOLDL, 'stroke-width':12, 'stroke-linecap':'round', 'stroke-dasharray':'46 38'}, b.g);
      b.head = el('path', {fill:'none', stroke:GOLDL, 'stroke-width':12, 'stroke-linecap':'round', 'stroke-linejoin':'round'}, b.g);
      b.ring = el('circle', {r:62, fill:'none', stroke:hx(mix(C.skin, GOLDI, .9)), 'stroke-width':7}, b.g);
      b.dot = el('circle', {r:13, fill:hx(mix(C.skin, AMB, .95))}, b.g);
      b.arc = el('path', {fill:'none', stroke:hx(mix(C.skin, GOLDI, .7)), 'stroke-width':5}, b.g);
      b.txt = el('text', {'text-anchor':'middle', 'font-family':'ui-monospace,Menlo,monospace', 'font-size':50, 'letter-spacing':4, fill:hx(mix(C.skin, C.bone, .7))}, b.g); b.txt.textContent = 'SUN COMPASS ' + BEARING + '°';
      b.pass = (name, fn, tlen) => { b.holder = name; b.fn = fn; b.tlen = tlen; b.hist.push({t:Math.round(crew.t), holder:name, bearing:b.bearing}); b.pulse = 1; };
      b.tick = dt => { const ok = !!b.fn && b.fade > 0; let p = null; if(b.fn) p = b.fn();
        if(p){ if(!b.has){ b.o = [p[0], p[1]]; b.has = true; } const k = sm(dt, 260); b.o[0] += (p[0] - b.o[0]) * k; b.o[1] += (p[1] - b.o[1]) * k; }
        b.g.setAttribute('opacity', (ok && p ? clamp(b.fade) * .92 : 0).toFixed(3));
        b.len += (b.tlen - b.len) * sm(dt, 520); b.pulse = Math.max(0, b.pulse - dt / 900); b.dash = (b.dash + dt * .09 * (b.tlen > 500 ? 1 : .1)) % 84;
        const [x, y] = b.o, Lh = b.len, rs = 62 * (1 + .25 * b.pulse), x0 = x + rs + 14;
        b.line.setAttribute('d', `M${x0.toFixed(1)} ${y.toFixed(1)}H${(x0 + Math.max(0, Lh)).toFixed(1)}`); b.line.setAttribute('stroke-dashoffset', (-b.dash).toFixed(1)); b.line.setAttribute('opacity', clamp(Lh / 160).toFixed(2));
        const hxx = x0 + Lh; b.head.setAttribute('d', `M${(hxx - 34).toFixed(1)} ${(y - 26).toFixed(1)}L${hxx.toFixed(1)} ${y.toFixed(1)}L${(hxx - 34).toFixed(1)} ${(y + 26).toFixed(1)}`); b.head.setAttribute('opacity', clamp((Lh - 140) / 120).toFixed(2));
        b.ring.setAttribute('cx', x.toFixed(1)); b.ring.setAttribute('cy', y.toFixed(1)); b.ring.setAttribute('r', rs.toFixed(1)); const a = -.7; b.dot.setAttribute('cx', (x + Math.cos(a) * rs).toFixed(1)); b.dot.setAttribute('cy', (y + Math.sin(a) * rs).toFixed(1));
        b.arc.setAttribute('d', `M${(x + rs * .55).toFixed(1)} ${y.toFixed(1)}A${(rs * .55).toFixed(1)} ${(rs * .55).toFixed(1)} 0 0 0 ${(x + Math.cos(a) * rs * .55).toFixed(1)} ${(y + Math.sin(a) * rs * .55).toFixed(1)}`);
        b.txt.setAttribute('x', x.toFixed(1)); b.txt.setAttribute('y', (y - rs - 24).toFixed(1)); b.txt.setAttribute('opacity', clamp(Lh / 400).toFixed(2)); };
      return b; };
    const batons = [mkBaton(), mkBaton()], baton = batons[0];
    /* the sun, far away: it keeps its place on the pane, and rises a little over the run */
    const sun = el('g', {}, O); el('circle', {r:92, fill:hx(mix(C.skin, AMB, .12)), stroke:hx(mix(C.skin, AMB, .85)), 'stroke-width':10}, sun);
    for(let i = 0; i < 12; i++){ const a = i * Math.PI / 6; el('path', {d:`M${(Math.cos(a) * 128).toFixed(0)} ${(Math.sin(a) * 128).toFixed(0)}L${(Math.cos(a) * 190).toFixed(0)} ${(Math.sin(a) * 190).toFixed(0)}`, stroke:hx(mix(C.skin, AMB, .8)), 'stroke-width':10, 'stroke-linecap':'round'}, sun); }
    /* the storm (the break): a dark mass of cloud over the route and rain slanting through the pane */
    const storm = {g:el('g', {opacity:0}, O), t:0, on:0, cx:0};
    { const cl = []; for(let i = 0; i < 9; i++) cl.push([-900 + i * 225, -90 * Math.sin(i / 8 * Math.PI) - 30]); for(let i = 8; i >= 0; i--) cl.push([-940 + i * 225, 80 + 40 * Math.sin(i * 2.3)]);
      poly(cl, {stroke:lineC(.8, C.bone, .25), 'stroke-width':10, fill:fillC(.42, C.lapis)}, storm.g); poly(cl.map(p => [p[0] * .7 + 120, p[1] * .7 - 150]), {stroke:lineC(.7, C.bone, .25), 'stroke-width':8, fill:fillC(.5, C.lapis)}, storm.g);
      storm.rain = Array.from({length:70}, (_, i) => [el('path', {d:'M0 0l-34 90', stroke:hx(mix(C.skin, mix(C.lapis, C.bone, .5), .8)), 'stroke-width':6, 'stroke-linecap':'round'}, storm.g), (i * 137) % 1800 - 900, (i * 73) % 1300]); }

    /* ---------- the camera and the world's own motion ---------- */
    const cam = {x:0, y:-780, s:.24, fn:null, lead:0, mode:'route', zoom:1.45, parkY:SY - 760, closeY:-560};
    crew.follow(() => ({x:cam.x, y:cam.y, s:cam.s}));
    const E_ = m => m.c.mon || {};
    crew.tickHook = dt => {
      const now = crew.t;
      if(cam.fn){ const t = cam.fn(); cam.x += (t[0] + cam.lead - cam.x) * sm(dt, 500); if(cam.mode === 'close') cam.y += (cam.closeY - cam.y) * sm(dt, 600); }
      cam.s = Math.min(crew.W / 3300, crew.H / 2600) * cam.zoom; if(cam.mode === 'route'){ const fy = cam.fn ? cam.fn()[1] : SY; cam.y = Math.min(-.23 * crew.H / cam.s, fy + .3 * crew.H / cam.s); }   // the ground a little under three quarters down; a figure high on a fir bough keeps its place in a short pane
      for(const m of crew.members){
        if(m.fade){ const o = clamp(parseFloat(m.wrap.style.opacity || '1') + m.fade * dt / 1300); m.wrap.style.opacity = String(o); if(o <= 0){ m.fade = 0; m.parked = true; m.wrap.style.display = 'none'; m.flying = false; if(!crew.virtual) m.c.pause(true); } else if(o >= 1) m.fade = 0; }
        if(m.dead && !m.parked && !m.fade && Math.abs(m.fl.x - cam.x) > 600) m.fade = -1;           // a spent figure leaves before the camera does
        if(m.parked){ const dx = cam.x + (m.parkDx || 0) - m.fl.x, dy = cam.parkY - m.fl.y, d = hypot(dx, dy), k = d > 52 ? 52 / d : 1; m.fl.x += dx * k; m.fl.y += dy * k; m.fl.vx = m.fl.vy = 0; m.sync(); }   // (at most 52 units a frame, under the host's jump of 90)
        if(m.storm){ const s = m.storm; s.t += dt; s.vy = Math.min(520, s.vy + dt * .22); m.fl.y = Math.min(SY, m.fl.y + s.vy * dt / 1000); m.fl.x += s.vx * dt / 1000; m.fl.pitch = .22 * Math.sin(now * .004) + .3; m.fl.tx = m.fl.ty = null; m.flying = false; m.sync(); if(m.fl.y >= SY - 1 && s.vy > 200){ m.fl.y = SY; s.landed = true; m.storm = null; } } }
      for(const b of batons) b.tick(dt);
      { const vw = crew.W / cam.s, vh = crew.H / cam.s, t = clamp(now / 150000); sun.setAttribute('transform', `translate(${(cam.x + vw * (.32 - .04 * t)).toFixed(1)} ${(cam.y - vh * (.36 + .03 * t)).toFixed(1)}) scale(${(.055 * Math.min(crew.W, crew.H) / (92 * cam.s)).toFixed(3)})`); }
      for(const L of larvae) if(L.on){ if(L.speed > 0) L.s = Math.min(L.end(), L.s + L.speed * dt / 1000); L.draw(now); }
      if(storm.on !== storm.t){ storm.t += clamp(storm.on - storm.t, -dt / 2500, dt / 2500); storm.g.setAttribute('opacity', (storm.t * .95).toFixed(3)); }
      if(storm.t > .01){ const vh = crew.H / cam.s, y = cam.y - vh * .3 + 150; storm.rain.forEach(([r, ox, oy]) => { const yy = (oy + now * .9) % 1700; r.setAttribute('transform', `translate(${(storm.cx + ox - yy * .35).toFixed(0)} ${(y + yy).toFixed(0)})`); }); storm.g.firstChild.setAttribute('transform', `translate(${storm.cx.toFixed(0)} ${(y - 80).toFixed(0)})`); storm.g.children[1].setAttribute('transform', `translate(${storm.cx.toFixed(0)} ${(y - 80).toFixed(0)})`); }
    };

    /* ---------- verbs ---------- */
    const cond = v => typeof v === 'number' ? crew.wait(v) : typeof v === 'function' ? v : Array.isArray(v) ? (() => { const L = v.map(cond); return () => L.every(f => f()); })() : null;
    function* par(...gens){ const st = gens.map(g => ({g, w:null, done:false}));
      while(st.some(s => !s.done)){ for(const s of st){ if(s.done || (s.w && !s.w())) continue; s.w = null; for(let n = 0; n < 40; n++){ const r = s.g.next(); if(r.done){ s.done = true; break; } const w = cond(r.value); if(!w) break; if(!w()){ s.w = w; break; } } } yield; } }
    const tempo = (m, k) => { m.c.pad.dynamics.L[0] = m.c.pad.dynamics.R[0] = Math.log2(k); };
    const track = (m, d = 420) => { cam.fn = () => [m.fl.x, m.fl.y]; cam.lead = d; }, trackPt = (x, d = 0) => { cam.fn = () => [x, SY]; cam.lead = d; };
    const head = m => cw(m, [PIV[0] + 140, PIV[1] - 190]);
    const place = (m, S, post) => { if(!crew.virtual) m.c.pause(false); m.place(S[0], S[1], 0); MF.fresh(m.c); MF.snapTo(m.c, post); m.parked = false; m.dead = false; m.fade = 0; m.storm = null; m.wrap.style.display = ''; m.wrap.style.opacity = '1'; m.fl.face = 1; m.fl.pitch = 0; m.sync(); };
    const spend = m => { m.dead = true; m.wrap.style.opacity = '.55'; };
    const reset = () => {
      for(const m of G){ m.parked = true; m.parkDx = 0; m.dead = false; m.storm = null; m.fade = 0; m.wrap.style.display = 'none'; m.wrap.style.opacity = '1'; m.flying = false; m.fl.tx = m.fl.ty = null; m.fl.face = 1; m.fl.pitch = 0; m.arrived = true; m.stop(); tempo(m, 1); MF.fresh(m.c); if(!crew.virtual) m.c.pause(true); }
      for(const P of patches) if(P) for(const e of P.eggs) e.setAttribute('opacity', 0);
      for(const L of larvae){ L.on = false; L.g.setAttribute('opacity', 0); L.speed = 0; }
      for(const b of batons){ b.fn = null; b.has = false; b.hist.length = 0; b.len = b.tlen = 0; b.fade = 1; b.g.setAttribute('opacity', 0); b.holder = ''; }
      storm.on = 0; storm.t = 0; storm.g.setAttribute('opacity', 0); R.gens.length = 0; R.events.length = 0; cam.mode = 'route'; cam.zoom = 1.45; cam.parkY = S_(0)[1];
    };
    const R = crew.relay = {bearing0:BEARING, gens:[], events:[]};
    const note = (what, o = {}) => R.events.push({t:Math.round(crew.t), what, ...o});
    const gen = (m, o = {}) => { const g = {m, name:m.name, bearingIn:null, bearingOut:null, eggs:0, eggsAt:null, endAt:null, bornAt:crew.t, launchAt:null, landedAt:null, ...o}; R.gens.push(g); return g; };
    /* the flight leg: climb from patch a, cruise, come down to hover over patch b; the flapping and the glides are the figure's own bouts */
    function* leg(m, a, b){ const A = S_(a), B = S_(b);
      yield m.flyTo(A[0] + 420, ALT, {r:150, speed:320}); yield m.flyTo(B[0] - 580, ALT, {r:160, speed:370}); yield m.flyTo(B[0], B[1], {r:24, speed:290}); }
    /* the generation's dinner and its eggs: feed on the umbel, then to the leaf and lay */
    function* lay(m, G_, j){ const n0 = E_(m).laid || 0, done = m.do('layEgg'); yield () => (E_(m).laid || 0) > n0; const i = G_.eggs; if(i < 3){ patches[j].eggs[i].setAttribute('opacity', 1); G_.eggs++; G_.eggsAt = crew.t; note('egg', {by:m.name, n:G_.eggs}); } yield done; }
    function* feedAndLay(m, G_, j, n = 2){ tempo(m, 1.5); yield m.go('feed'); yield 200; yield m.do('nectar'); note('nectar', {by:m.name}); yield m.go('bask'); yield 100; tempo(m, 1.7); for(let i = 0; i < n; i++) yield* lay(m, G_, j); tempo(m, 1); }
    /* from the egg to the chrysalis at patch j: a larva eats, grows, crawls to the bough; the child figure, hung as a chrysalis, takes the baton */
    function* grow(j, kid, L, b, o = {}){
      const P = patches[j].P, egg = MF.eggs[o.egg ?? 0], e0 = P([egg, MF.leafTop(egg) - 16]), tip = P([MF.leaf[1][0] + 10, MF.leaf[1][1] - 14]), pup = P([MF.caseTop[0] + (o.dx || 0), 150]);
      L.setPath([e0, [lerp(e0[0], tip[0], .4), lerp(e0[1], tip[1], .4)], tip, P([MF.leaf[1][0] - 8, GYC - 14]), P([128, GYC - 14]), P([122, 640]), P([118, 190]), P([170 + (o.dx || 0) * .3, 152]), pup]);
      yield o.delay ?? 1400;
      L.on = true; L.s = 3; L.r = 4; L.gr = 1; L.speed = 0; L.g.setAttribute('opacity', 1);
      b.pass('larva', () => { const h = L.at(L.s); return [h[0], h[1] - L.r * 3 - 90]; }, 200);
      for(let t = 0; t < 2600; t += 16){ L.r = lerp(4, 19, clamp(t / 2600) ** .8); L.s = 3 + L.r * 3 * clamp(t / 1800); yield 1; }
      L.speed = 760; yield () => L.s >= L.end() - 2;
      L.speed = 0; L.gr = 0; yield 600;
      if(!crew.virtual) kid.c.pause(false); kid.wrap.style.display = ''; kid.wrap.style.opacity = '1'; kid.parked = false; L.on = false; L.g.setAttribute('opacity', 0);
      b.pass(kid.name + ' chrysalis', () => cw(kid, [MF.caseTop[0] + 130, 270]), 200);
    }
    function* hatch(kid, b){ tempo(kid, 1.8); yield 3000; yield kid.go('emerge'); yield kid.do('pump'); yield 400; tempo(kid, 1); b.pass(kid.name, () => head(kid), 1200); }

    /* ====================================== the patterns ====================================== */
    function* relayRun(run){
      reset(); const [g1, g2, g3, g4] = G, gens = [g1, g2, g3, g4];
      cam.fn = () => [S_(0)[0], S_(0)[1]]; cam.lead = 0; place(g1, S_(0), 'roost'); baton.bearing = BEARING; baton.pass('G1', () => head(g1), 1200);
      run.set('thinking'); yield 2200;
      for(let i = 0; i < 4; i++){
        const m = gens[i], rec = gen(m); rec.bearingIn = baton.bearing; run.set('acting');
        if(i === 0){ yield g1.go('bask'); yield g1.do('antFlick'); baton.pulse = 1; note('bearing read', {by:'G1'}); yield 900; }
        rec.launchAt = crew.t; track(m, 420); m.go('fly'); cam.parkY = SY; baton.pass(m.name, () => head(m), 1200);
        yield* leg(m, i, i + 1); rec.landedAt = crew.t; note('landed', {by:m.name, at:i + 1}); trackPt(ROUTE[i + 1].x, 0);
        run.set('producing'); yield* feedAndLay(m, rec, i + 1, 2); rec.bearingOut = baton.bearing;
        if(i < 3){
          const kid = gens[i + 1]; place(kid, S_(i + 1), 'chrysalis'); kid.wrap.style.display = 'none'; kid.parked = true; kid.fl.x = S_(i + 1)[0]; kid.fl.y = SY;
          baton.pass('egg', () => patches[i + 1].P([MF.eggs[0], MF.leafTop(MF.eggs[0]) - 150]), 200); run.set('waiting');
          yield* par(grow(i + 1, kid, larvae[0], baton), (function*(){ yield 2600; yield m.go('down'); spend(m); rec.endAt = crew.t; note('ended', {by:m.name}); })());
          run.set('producing'); yield* hatch(kid, baton);
        } else { yield m.go('down'); spend(m); rec.endAt = crew.t; note('ended', {by:m.name}); yield 1500; }
      }
      run.set('done');
    }
    const relayCheck = (crew_, run) => { const g = R.gens, bh = batons[0].hist.map(h => h.holder), want = ['G1', 'egg', 'larva', 'G2 chrysalis', 'G2', 'egg', 'larva', 'G3 chrysalis', 'G3', 'egg', 'larva', 'G4 chrysalis', 'G4'], seq = want.every(n => bh.includes(n)) && bh.indexOf('G4') > bh.indexOf('G3') && bh.indexOf('G3') > bh.indexOf('G2') && bh.indexOf('G2') > bh.indexOf('G1');
      const carried = g.length === 4 && g.every(x => x.bearingIn === BEARING && x.bearingOut === BEARING) && batons[0].hist.every(h => h.bearing === BEARING), laid = g.every(x => x.eggs >= 2 && x.endAt !== null && x.eggsAt < x.endAt), reached = g.length === 4 && g[3].m.fl.x > S_(4)[0] - 300;
      return {ok:carried && laid && reached && seq, notes:`${g.length} generations; bearing ${BEARING} carried by all (${carried}); baton ${bh.length} hand-overs in order (${seq}); eggs before the end: ${g.map(x => x.name + ' ' + x.eggs + (x.endAt !== null && x.eggsAt < x.endAt ? '<end' : ' !')).join(', ')}; the last at x ${Math.round(g[3] ? g[3].m.fl.x : 0)} of ${S_(4)[0]}`}; };

    function* breakRun(run){
      reset(); const [g1, g2, g3, , g2b] = G; g2b.parkDx = 170 * KS;   // the sibling waits a little to the side of the camera: its case hangs a little to the side of its sibling's
      cam.fn = () => [S_(0)[0], S_(0)[1]]; cam.lead = 0; place(g1, S_(0), 'roost'); baton.bearing = BEARING; baton.pass('G1', () => head(g1), 1200); batons[1].bearing = BEARING;
      run.set('thinking'); yield 2200;
      /* G1 flies to the first milkweed and lays: a clutch for two */
      let rec = gen(g1); rec.bearingIn = baton.bearing; run.set('acting'); yield g1.go('bask'); yield g1.do('antFlick'); baton.pulse = 1; note('bearing read', {by:'G1'}); yield 900;
      rec.launchAt = crew.t; track(g1, 420); g1.go('fly'); cam.parkY = SY; baton.pass('G1', () => head(g1), 1200); yield* leg(g1, 0, 1); rec.landedAt = crew.t; trackPt(ROUTE[1].x, 0);
      run.set('producing'); yield* feedAndLay(g1, rec, 1, 2); rec.bearingOut = baton.bearing;
      /* two children grow at the patch; the baton goes to both */
      place(g2, S_(1), 'chrysalis'); g2.wrap.style.display = 'none'; g2.parked = true; g2.fl.x = S_(1)[0]; g2.fl.y = SY;
      const SB = [S_(1)[0] + 170 * KS, SY]; place(g2b, SB, 'chrysalis'); g2b.wrap.style.display = 'none'; g2b.parked = true; g2b.fl.x = SB[0]; g2b.fl.y = SY;
      baton.pass('egg', () => patches[1].P([MF.eggs[0], MF.leafTop(MF.eggs[0]) - 150]), 200); batons[1].pass('egg B', () => patches[1].P([MF.eggs[1], MF.leafTop(MF.eggs[1]) - 150]), 200); run.set('waiting');
      yield* par(grow(1, g2, larvae[0], baton), grow(1, g2b, larvae[1], batons[1], {dx:170, egg:1, delay:1900}), (function*(){ yield 2600; yield g1.go('down'); spend(g1); rec.endAt = crew.t; note('ended', {by:'G1'}); })());
      /* the elder child hatches and takes the bearing north; the storm meets it on the way */
      run.set('producing'); rec = gen(g2); rec.bearingIn = baton.bearing; yield* hatch(g2, baton); rec.launchAt = crew.t; track(g2, 420); g2.go('fly'); baton.pass('G2', () => head(g2), 1200);
      run.set('acting'); yield g2.flyTo(S_(1)[0] + 420, ALT, {r:150, speed:320}); yield g2.flyTo(S_(1)[0] + 1000, ALT, {r:160, speed:360});
      note('storm', {by:'G2'}); storm.cx = g2.fl.x + 700; storm.on = 1; run.set('stalled');
      g2.go('down'); g2.storm = {t:0, vy:0, vx:-90, landed:false}; yield 1200; baton.fade = 1; baton.tlen = 0; yield () => g2.storm === null; spend(g2); rec.endAt = crew.t; rec.lost = true; note('lost', {by:'G2'}); baton.fn = null; baton.holder = 'lost';
      /* the sibling, hatching while the storm passed, carries the bearing on from the patch, with fewer generations in the relay */
      track(g2b, 420); storm.on = 0; run.set('producing'); rec = gen(g2b); rec.bearingIn = batons[1].bearing; yield* hatch(g2b, batons[1]); rec.launchAt = crew.t; g2b.go('fly'); run.set('acting');
      const A = S_(1), B = S_(2); yield g2b.flyTo(A[0] + 720, ALT, {r:150, speed:320}); yield g2b.flyTo(B[0] - 580, ALT, {r:160, speed:370}); yield g2b.flyTo(B[0], B[1], {r:24, speed:290}); rec.landedAt = crew.t; trackPt(ROUTE[2].x, 0);
      run.set('producing'); yield* feedAndLay(g2b, rec, 2, 2); rec.bearingOut = batons[1].bearing;
      place(g3, S_(2), 'chrysalis'); g3.wrap.style.display = 'none'; g3.parked = true; g3.fl.x = S_(2)[0]; g3.fl.y = SY;
      batons[1].pass('egg', () => patches[2].P([MF.eggs[0], MF.leafTop(MF.eggs[0]) - 150]), 200); run.set('waiting');
      yield* par(grow(2, g3, larvae[0], batons[1]), (function*(){ yield 2600; yield g2b.go('down'); spend(g2b); rec.endAt = crew.t; note('ended', {by:'G2b'}); })());
      run.set('producing'); rec = gen(g3); rec.bearingIn = batons[1].bearing; yield* hatch(g3, batons[1]); rec.launchAt = crew.t; track(g3, 420); g3.go('fly'); run.set('acting'); yield* leg(g3, 2, 3); rec.landedAt = crew.t; trackPt(ROUTE[3].x, 0);
      run.set('producing'); yield* feedAndLay(g3, rec, 3, 2); rec.bearingOut = batons[1].bearing; yield g3.go('down'); spend(g3); rec.endAt = crew.t; note('ended', {by:'G3'}); yield 1500;
      run.set('done');
    }
    const breakCheck = () => { const g = R.gens, names = g.map(x => x.name), lost = g.find(x => x.lost), ok_ = g.filter(x => !x.lost), bh = [...batons[0].hist, ...batons[1].hist].map(h => h.bearing);
      const carried = ok_.length === 3 && ok_.every(x => x.bearingIn === BEARING && x.bearingOut === BEARING) && lost && lost.bearingIn === BEARING && bh.every(b => b === BEARING), laid = ok_.every(x => x.eggs >= 2 && x.eggsAt < x.endAt) && lost && lost.eggs === 0, reached = ok_.length === 3 && ok_[2].m.fl.x > S_(3)[0] - 300, gone = lost && lost.m.fl.y >= SY - 2;
      return {ok:!!(carried && laid && reached && gone), notes:`generations ${names.join(' ')}; the lost one (${lost ? lost.name : '-'}) laid ${lost ? lost.eggs : '-'} and is down (${!!gone}); the bearing ${BEARING} reached the last by the sibling (${carried}); each surviving generation laid before it ended (${laid}); the last at x ${Math.round(ok_[2] ? ok_[2].m.fl.x : 0)} of ${S_(3)[0]}`}; };

    /* RELAY: LOST. The same road to the storm, but with one child: the one generation that is lost is the whole relay. The bearing is in it when it falls and in nothing else; nothing hatches, nothing flies on, and the run ends `failed`
       (the spec's break: state lost at the hand-off). The pane does not say `done` while a body is still at it, and does not say it at all. */
    function* lostRun(run){
      reset(); const [g1, g2] = G;
      cam.fn = () => [S_(0)[0], S_(0)[1]]; cam.lead = 0; place(g1, S_(0), 'roost'); baton.bearing = BEARING; baton.pass('G1', () => head(g1), 1200);
      run.set('thinking'); yield 2200;
      let rec = gen(g1); rec.bearingIn = baton.bearing; run.set('acting'); yield g1.go('bask'); yield g1.do('antFlick'); baton.pulse = 1; note('bearing read', {by:'G1'}); yield 900;
      rec.launchAt = crew.t; track(g1, 420); g1.go('fly'); cam.parkY = SY; baton.pass('G1', () => head(g1), 1200); yield* leg(g1, 0, 1); rec.landedAt = crew.t; trackPt(ROUTE[1].x, 0);
      run.set('producing'); yield* feedAndLay(g1, rec, 1, 2); rec.bearingOut = baton.bearing;
      place(g2, S_(1), 'chrysalis'); g2.wrap.style.display = 'none'; g2.parked = true; g2.fl.x = S_(1)[0]; g2.fl.y = SY;
      baton.pass('egg', () => patches[1].P([MF.eggs[0], MF.leafTop(MF.eggs[0]) - 150]), 200); run.set('waiting');
      yield* par(grow(1, g2, larvae[0], baton), (function*(){ yield 2600; yield g1.go('down'); spend(g1); rec.endAt = crew.t; note('ended', {by:'G1'}); })());
      run.set('producing'); rec = gen(g2); rec.bearingIn = baton.bearing; yield* hatch(g2, baton); rec.launchAt = crew.t; track(g2, 420); g2.go('fly'); baton.pass('G2', () => head(g2), 1200);
      run.set('acting'); yield g2.flyTo(S_(1)[0] + 420, ALT, {r:150, speed:320}); yield g2.flyTo(S_(1)[0] + 1000, ALT, {r:160, speed:360});
      note('storm', {by:'G2'}); storm.cx = g2.fl.x + 700; storm.on = 1; run.set('stalled');
      g2.go('down'); g2.storm = {t:0, vy:0, vx:-90, landed:false}; yield 1200; baton.tlen = 0; yield () => g2.storm === null; spend(g2); rec.endAt = crew.t; rec.lost = true; note('lost', {by:'G2'}); run.set('stalled');
      /* the bearing goes out with the one that carried it: the ring stays where it fell and dims, nothing takes it up */
      baton.pass('lost', () => cw(g2, [PIV[0] + 140, PIV[1] - 190]), 0); const t0 = crew.t; yield () => { baton.fade = 1 - clamp((crew.t - t0) / 5000); return crew.t - t0 > 5000; };
      baton.fn = null; storm.on = 0; R.lostAt = crew.t; run.set('stalled'); yield 4000;       // the storm clears on an empty road: no figure is born, the camera stays where the relay ended
      return 'failed';
    }
    const lostCheck = () => { const g = R.gens, lost = g.find(x => x.lost), bh = batons[0].hist.map(h => h.holder), last = bh[bh.length - 1], run = crew.run_;
      const carried = g.length === 2 && g[0].bearingIn === BEARING && g[0].bearingOut === BEARING && lost && lost.bearingIn === BEARING, none = G.slice(2).every(m => m.parked) && lost && lost.eggs === 0 && !lost.bearingOut, down = lost && lost.m.fl.y >= SY - 2;
      return {ok:!!(carried && none && down && last === 'lost' && g[0].eggs >= 2 && g[0].eggsAt < g[0].endAt), notes:`generations ${g.map(x => x.name).join(' ')}; the first laid ${g[0] ? g[0].eggs : '-'} and handed the bearing (${BEARING}) to its egg, larva and chrysalis; the second carried it and fell in the storm having laid ${lost ? lost.eggs : '-'} (down: ${!!down}); the baton's last holder is '${last}'; no third generation was born (${G.slice(2).every(m => m.parked)}); the run ends '${run ? run.state : '-'}'`}; };

    function* metaRun(run){
      reset(); const m = G[1]; cam.mode = 'close'; cam.zoom = 2; cam.parkY = SY; m.parkDx = 250; run.set('thinking');   // the camera pans to the first patch (the case, the adult's hang, the plant) while the figure waits a little ahead of it
      cam.fn = () => [S_(1)[0] - 250, SY]; cam.lead = 0; yield () => Math.abs(cam.x - S_(1)[0] + 250) < 24 && Math.abs(m.fl.x - S_(1)[0]) < 24 && Math.abs(m.fl.y - SY) < 24;
      place(m, S_(1), 'chrysalis'); baton.fade = 0; const heart0 = E_(m).beats || 0; run.set('waiting'); note('chrysalis', {at:'hangs'});
      yield 7200; R.beats = (E_(m).beats || 0) - heart0;
      run.set('acting'); tempo(m, 1.1); yield m.go('emerge'); note('emerged');
      run.set('producing'); yield m.do('pump'); R.exp = E_(m).exp; note('pumped', {exp:+R.exp.toFixed(2)}); yield 1800;
      run.set('acting'); tempo(m, 1); const x0 = m.fl.x; m.go('fly'); cam.mode = 'route'; cam.zoom = 1.45; track(m, 420); yield m.flyTo(S_(1)[0] + 500, ALT + 300, {r:120, speed:230}); yield m.flyTo(S_(1)[0] + 1500, ALT, {r:140, speed:280}); R.flown = m.fl.x - x0; note('first flight', {x:Math.round(R.flown)});
      yield 1200; run.set('done');
    }
    const metaCheck = () => { const m = G[1], E = E_(m); const ok = R.beats >= 3 && R.exp >= .99 && m.c.pm.node === 'fly' && R.flown > 1200 && (E.k || 0) > .05;
      return {ok, notes:`the heart beat ${R.beats} times in the chrysalis; the wings were pumped to ${(R.exp ?? 0).toFixed(2)}; the first flight went ${Math.round(R.flown || 0)} units and the figure ends in ${m.c.pm.node} beating (${(E.k || 0).toFixed(2)})`}; };

    return {patterns:[
      {id:'relay', label:'Relay', note:'four generations on one bearing: each flies its leg, lands on milkweed, nectars, lays and ends; the egg, the larva and the chrysalis carry the bearing to the next', run:relayRun, maxMs:260000, check:relayCheck},
      {id:'relay-break', label:'Relay: a break', note:'a storm takes the second generation; a sibling from the same clutch carries the bearing on, and the route goes on with fewer', run:breakRun, maxMs:260000, check:breakCheck},
      {id:'relay-lost', label:'Relay: lost', note:'the same storm with one child: the generation that falls is the whole relay, the bearing goes out with it, nothing hatches and the run ends failed (state lost at the hand-off)', run:lostRun, maxMs:200000, expect:'failed', check:lostCheck},
      {id:'metamorph', label:'Metamorph', note:'Count One: the chrysalis beats, the adult comes out, the wings are pumped open, the first flight', run:metaRun, maxMs:90000, check:metaCheck}]};
  }});
})();
