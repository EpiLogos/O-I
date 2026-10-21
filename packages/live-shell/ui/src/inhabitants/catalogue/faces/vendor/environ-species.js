/* environ-species.js — the tree species of the growth engine (environ-growth.js), as DATA. A species is a table; the engine knows none of them by name.
   Each table has two halves: what the engine reads to grow (types, spawn, vars, crown, life, multiplier, lean, budget, pipe) and what the tree adapter and the
   figure builder read to draw (leaf, product, blossom, bark, flare, lobes, ground, evergreen). The engine's half is documented at the head of environ-growth.js,
   the drawn half at the head of environ-tree.js.

   Units: millimetres and degrees; z is up. A step is the length one tip moves in a turn. Every random quantity is a distribution (see compileVal in
   environ-growth.js: [lo, hi] uniform, {n:[mean, sd]} normal, {w:[[value, weight], ...]} a table, {tri:[lo, mode, hi]}, {bern:p}), so the table says how a
   thing varies, not what it is. Names usable in an expression: life, life0, f (life left as a fraction), u (life used), age, cooldown, cd2, cd3, m, L, z, z0,
   rho, len, gen, s, k, th, and the species' own vars.

   The drawn half (read by environ-tree.js; a species may leave out what it has none of):
     leaf     {shape:'ovate'|'round'|'lobed'|'needle', accent:'#rrggbb' (the leaf ink), autumn:0xRRGGBB, max:N (the most leaves it draws), along:{<type>:{arrangement,...}}}
              arrangements: alternate {start, gap, phyllo, size, grow, incl, end}, rosette {n, size, incl}, cluster {start, gap, n, size, incl, pet, end}, tuft {n, len, width, spread, droop}
     product  {kind:'apple'|'acorn'|'cone'|'berry', on:[types the places are on], n, r, stalk, zMin, zMax (fractions of the height), outer (mm from the axis), sep, perLimb,
              colors:{set, ripening, ripe, harvested, fallen}}
     blossom  {bud, open, n, extra, size, on:[types]}, or none
     bark {tone, plates}  flare {amount, h}  lobes {n, amp, h}  ground {r}  roots N  evergreen (no leaf fall: PHENOLOGY's flag)
   A type with branch:false is foliage only (no wood): its leaves ride the wood above it. A type's kind and order tell the figure what it is (trunk, scaffold, upper,
   secondary, shoot, spur); what grows off the trunk is a limb whatever its type.

   The four species (what each is, and where it is weakest, are in ENVIRON-NOTES-TREE.md, Round 4):
     apple   (Malus domestica)  an open vase on a central leader: a tier of scaffolds at the golden angle from about 600 up, a second tier, secondaries, leafy
             shoots, fruiting spurs. The research table of ENVIRON-NOTES-TREE.md is its data (crotch 46-58 degrees, secondaries 38-56, shoots 32-54, spurs 60-90).
     oak     (Quercus robur)    decurrent: a short bole that gives up its leader for a few heavy limbs which fork and kink irregularly and spread into a broad dome.
     pine    (Pinus sylvestris) excurrent: one leader, whorls of boughs at tiers, a conical crown, a bare lower bole; needles in tufts.
     bonsai  (after cbonsai)    cbonsai's rules in three dimensions: a trunk that wanders before it climbs, level shoots that fork, a fan of foliage in the last stretch. */
(() => {
'use strict';
const G = (typeof window !== 'undefined' ? window.EnvironGrowth : null) || (typeof module !== 'undefined' && module.exports ? require('./environ-growth.js') : null);
const S = {};
/* A tip's bend per step, as the accepted apple grew its limbs: up toward the light more and more toward the tip, sagging in the middle under its own weight
   (up * (.25 + u) - sag * sin(pi u) * (1 - u / 2)) * step / 100, a vector added to the heading each step (Runions 2007, eq. 3) */
const bend = (up, sag, step) => '(' + up + ' * (.25 + u) - ' + sag + ' * sin(3.1416 * u) * (1 - .5 * u)) * ' + (step / 100);

/* ---------- the apple: ENVIRON-NOTES-TREE.md's research table, as distributions ---------- */
S.apple = {
  name:'Apple', latin:'Malus domestica', evergreen:false, life:80, multiplier:5, budget:7000, lean:{sd:.05}, pipe:2,
  /* the leader's height H, the first tier's foot zS, the second tier's zU, the crown's top zT, sc the size relative to the default (limb lives scale with it),
     mm the spacing relative to the default (the multiplier) */
  vars:{habit:{n:[1, .14], min:.72, max:1.36}, grow:{n:[1, .04], min:.9, max:1.1}, H:'L * 22 * grow', zS:'L * 22 * grow * .34', zU:'L * 22 * grow * .70', zT:'L * 22 * grow * .92', sc:'L / 80', mm:'m / 5 / habit'},
  root:{type:'leader', life:'L * grow'},
  types:{
    leader:{kind:'trunk', order:0, step:22, lean:1, env:false, r:{end:3.4, taper:.004}, turn:{n:[0, 9]}, pitch:{n:[0, 1.3]}, tropism:[{dir:[0, 0, 1], k:.075}]},
    scaffold:{kind:'scaffold', order:1, step:22, lean:.25, r:{end:3.4, taper:.003}, turn:{n:[0, 3.2]}, pitch:{n:[0, 2.4]}, tropism:[{dir:[0, 0, 1], k:bend(.6, .75, 22)}]},
    upper:{kind:'upper', order:1, step:20, lean:.25, r:{end:3.4, taper:.003}, turn:{n:[0, 3.2]}, pitch:{n:[0, 2.4]}, tropism:[{dir:[0, 0, 1], k:bend(.8, .4, 20)}]},
    co:{kind:'upper', order:1, step:20, lean:.25, r:{end:3.4, taper:.003}, turn:{n:[0, 3]}, pitch:{n:[0, 2]}, tropism:[{dir:[0, 0, 1], k:.07}]},
    lateral:{kind:'secondary', order:2, step:16, lean:.2, r:{end:3.4, taper:.002}, turn:{n:[0, 3.2]}, pitch:{n:[0, 2.4]}, tropism:[{dir:[0, 0, 1], k:bend(1.05, .2, 16)}]},
    shoot:{kind:'shoot', order:3, step:12, leafy:true, lean:0, r:{end:2.4, taper:0}, turn:{n:[0, 3.4]}, pitch:{n:[0, 2]}, tropism:[{dir:[0, 0, 1], k:bend(1.5, .05, 12)}]},
    spur:{kind:'spur', order:3, step:6, leafy:true, lean:0, r:{end:4.6, taper:0}, turn:{n:[0, 4]}, pitch:{n:[0, 2]}, tropism:[{dir:[0, 0, 1], k:'.6 * (.25 + u) * .06'}]},
  },
  spawn:[
    /* the end of a limb carries a shoot of its own */
    {id:'limb-end', on:['scaffold', 'upper', 'co', 'lateral'], when:'life < 1', spawn:{type:'shoot', life:{u:['6 * sc', '12 * sc']}, angle:{u:[0, 22]}, roll:[0, 360], cd2:{u:[2, 4]}}},
    {id:'leader-end', on:'leader', when:'life < 3', spawn:{type:'shoot', life:{u:['6 * sc', '12 * sc']}, angle:{u:[18, 40]}, roll:[0, 360]}},
    /* the first tier: scaffolds at the golden angle, 8-10 steps (180-220) apart from about 600 up, 46-58 degrees from the vertical */
    {id:'scaffold', on:'leader', when:'z >= zS && z < zS + 540 && cooldown <= 0', chance:.92,
      spawn:{type:'scaffold', vig:{n:[1, .12], min:.78, max:1.28}, life:{u:['(35 - 3 * k) * sc', '(44 - 3 * k) * sc']}, angle:{u:[46, 58]}, roll:{phyllo:137.5, jit:[-6, 6]}, cooldown:[4, 6], cd2:[4, 6]}, set:{cooldown:{u:['8 * mm', '11 * mm']}}},
    /* the second tier and above: the leader's own limbs, shorter as they go up */
    {id:'upper', on:'leader', when:'z >= zU && z < zT && cooldown <= 0', chance:.8,
      spawn:{type:'upper', vig:{n:[1, .12], min:.78, max:1.28}, life:{u:['(26 - 3 * (k - 3)) * sc', '(31 - 3 * (k - 3)) * sc']}, angle:{u:[46, 56]}, roll:{phyllo:137.5, jit:[-6, 6]}, cooldown:[2, 4], cd2:[3, 5]}, set:{cooldown:{u:['8 * mm', '10 * mm']}}},
    /* a co-dominant second leader: a decision, now and then, in the upper half of the leader (the tree's architecture differs by it) */
    {id:'co-leader', on:'leader', when:'z > zS + 650 && z < zT - 250 && life > 8', chance:.012, spawn:{type:'co', life:{u:['16 * sc', '24 * sc']}, angle:{u:[16, 30]}, roll:[0, 360], cooldown:[3, 5]}},
    /* leafy shoots on the upper leader */
    {id:'leader-shoots', on:'leader', when:'z > zU && cd2 <= 0', chance:.55, spawn:{type:'shoot', life:{u:['5 * sc', '10 * sc']}, angle:{u:[30, 54]}, roll:[0, 360]}, set:{cd2:{u:[4, 7]}}},
    /* the limbs: secondaries along the outer three quarters, alternating sides; leafy shoots on the outer part; fruiting spurs on older wood */
    {id:'lateral', on:['scaffold', 'upper', 'co'], when:'age >= 5 && life >= 4 && cooldown <= 0', chance:.92,
      spawn:{type:'lateral', vig:{n:['vig', .08], min:.72, max:1.4}, life:{u:['(14 - 3 * (gen > 1)) * (1 - .45 * u) * sc * vig', '(23 - 6 * (gen > 1)) * (1 - .45 * u) * sc * vig']}, angle:{u:[38, 56]}, roll:{alt:92, jit:[-22, 22]}, cooldown:[2, 4], cd2:[3, 5]},
      set:{cooldown:{u:['4 * mm / vig', '6 * mm / vig']}}},
    {id:'limb-shoots', on:['scaffold', 'upper', 'co'], when:'u >= .36 && life >= 2 && cd2 <= 0', chance:.94, spawn:{type:'shoot', life:{u:['6 * sc * vig', '16 * sc * vig']}, angle:{u:[32, 54]}, roll:{alt:90, jit:[-50, 50]}}, set:{cd2:{u:['3 * mm / vig', '5 * mm / vig']}}},
    {id:'limb-spurs', on:['scaffold', 'upper', 'co'], when:'u >= .26 && life >= 1 && cd3 <= 0', chance:.92, spawn:{type:'spur', life:{u:[3, 5]}, angle:{u:[60, 90]}, roll:[-110, 110]}, set:{cd3:{u:['2.5 * mm / vig', '4.5 * mm / vig']}}},
    {id:'lat-shoots', on:'lateral', when:'u >= .1 && life >= 2 && cd2 <= 0', chance:.92, spawn:{type:'shoot', life:{u:['5 * sc * vig', '14 * sc * vig']}, angle:{u:[32, 54]}, roll:{alt:90, jit:[-50, 50]}}, set:{cd2:{u:['3.5 * mm / vig', '5.5 * mm / vig']}}},
    {id:'lat-spurs', on:'lateral', when:'u >= .1 && life >= 1 && cd3 <= 0', chance:.92, spawn:{type:'spur', life:{u:[3, 5]}, angle:{u:[60, 90]}, roll:[-110, 110]}, set:{cd3:{u:['3.5 * mm / vig', '5.5 * mm / vig']}}},
    /* a shoot now and then forks (a second leader on the shoot) */
    {id:'shoot-fork', on:'shoot', when:'age >= 3 && life >= 4', chance:.02, spawn:{type:'shoot', life:'max(3, life * .8)', angle:{u:[30, 50]}, roll:[0, 360]}},
  ],
  leaf:{shape:'ovate', accent:'#3A7D5C', autumn:0xC08A2E, max:1500,
    along:{shoot:{arrangement:'alternate', start:14, gap:[26, 36], phyllo:144, size:64, grow:18, incl:30, end:58, aspect:.56}, spur:{arrangement:'rosette', n:[5, 8], size:[66, 80], incl:45, aspect:.56}}},
  product:{kind:'apple', on:['spur'], n:10, r:[34, 40], stalk:[22, 28], zMin:.34, outer:220, sep:200, perLimb:3,
    colors:{set:0x9DB860, ripening:0xB8963E, ripe:0xC44536, harvested:0xD4A03C, fallen:0x6B5B4F}},
  blossom:{bud:0xD98FA6, open:0xFBF3F0, n:3, extra:12, on:['spur']},
  bark:{tone:1, plates:1}, flare:{amount:.6, h:110}, lobes:{n:5, amp:.34, h:115}, ground:{r:520},
};

/* ---------- the oak: decurrent, broad, heavy limbs, irregular ---------- */
S.oak = {
  name:'Oak', latin:'Quercus robur', evergreen:false, life:70, multiplier:5, budget:9000, lean:{sd:.05}, pipe:2,
  vars:{habit:{n:[1, .15], min:.7, max:1.4}, grow:{n:[1, .05], min:.88, max:1.12}, H:'L * 28 * .42 * grow', zL:'L * 28 * .42 * grow * .36', sc:'L / 70', mm:'m / 5 / habit'},
  root:{type:'bole', life:'L * .42 * grow'},
  /* the dome: a limb that goes past it is turned in (a soft pull, not a wall) */
  crown:{out:[[0, 1000], [600, 1500], [1000, 2300], [1500, 2600], [2000, 2000], [2500, 1000], [2900, 200]], k:.05},
  types:{
    bole:{kind:'trunk', order:0, step:28, lean:1, env:false, r:{end:7, taper:.006}, turn:{n:[0, 12]}, pitch:{n:[0, 2.2]}, tropism:[{dir:[0, 0, 1], k:.05}]},
    limb:{kind:'scaffold', order:1, step:30, lean:.3, r:{end:7, taper:.004}, turn:{n:[0, 7]}, pitch:{n:[0, 4]}, tropism:[{dir:[0, 0, 1], k:bend(.3, .3, 30)}]},
    arm:{kind:'secondary', order:2, step:26, lean:.2, r:{end:6.2, taper:.003}, turn:{n:[0, 7]}, pitch:{n:[0, 4]}, tropism:[{dir:[0, 0, 1], k:bend(.45, .25, 26)}]},
    branch:{kind:'secondary', order:2, step:20, lean:.2, r:{end:5, taper:.002}, turn:{n:[0, 6]}, pitch:{n:[0, 4]}, tropism:[{dir:[0, 0, 1], k:bend(.8, .3, 20)}]},
    twig:{kind:'shoot', order:3, step:14, leafy:true, lean:0, r:{end:5.4, taper:0}, turn:{n:[0, 7]}, pitch:{n:[0, 4]}, tropism:[{dir:[0, 0, 1], k:'.05 + .05 * u'}]},
  },
  spawn:[
    {id:'end-twigs', on:['limb', 'arm', 'branch'], when:'life < 1', spawn:{type:'twig', n:{w:[[2, .5], [3, .5]]}, life:{u:[4, 8]}, angle:{u:[10, 45]}, roll:[0, 360]}},
    {id:'bole-end', on:'bole', when:'life < 2', spawn:{type:'limb', vig:{n:[1, .14], min:.72, max:1.38}, n:{w:[[2, .3], [3, .45], [4, .25]]}, life:{u:['36 * sc', '50 * sc']}, angle:{u:[48, 70]}, roll:{phyllo:137.5, whorl:true, jit:[-15, 15]}}},
    {id:'bole-limbs', on:'bole', when:'z >= zL && cooldown <= 0', chance:.5, spawn:{type:'limb', vig:{n:[1, .14], min:.72, max:1.38}, life:{u:['(26 - 2 * k) * sc', '(38 - 2 * k) * sc']}, angle:{u:[64, 82]}, roll:{phyllo:137.5, jit:[-20, 20]}}, set:{cooldown:{u:[4, 8]}}},
    {id:'bole-sprout', on:'bole', when:'z > 300 && life > 3', chance:.06, spawn:{type:'twig', life:{u:[4, 7]}, angle:{u:[40, 70]}, roll:[0, 360]}},
    /* the decisions that make an oak irregular: a limb's end is replaced by a child that turns away (a kink), or a limb forks */
    {id:'kink', on:['limb', 'arm'], when:'age >= 4 && life >= 5 && gen < 6', chance:'.05 * vig', spawn:{type:'arm', life:'life', angle:{u:[18, 40]}, roll:[0, 360]}, set:{life:0}},
    {id:'fork', on:['limb', 'arm'], when:'age >= 4 && life >= 7 && gen < 7 && cooldown <= 0', chance:'.1 * vig', spawn:{type:'arm', life:'life * .75', angle:{u:[26, 46]}, roll:[0, 360]}, set:{cooldown:{u:[3, 6]}}},
    {id:'branches', on:['limb', 'arm'], when:'age >= 3 && life >= 3 && cd2 <= 0', chance:.85, spawn:{type:'branch', life:{u:['10 * (1 - .4 * u) * sc * vig', '18 * (1 - .4 * u) * sc * vig']}, angle:{u:[36, 62]}, roll:{alt:85, jit:[-30, 30]}}, set:{cd2:{u:['6 * mm / vig', '10 * mm / vig']}}},
    {id:'limb-twigs', on:['limb', 'arm'], when:'u >= .5 && life >= 1 && cd3 <= 0', chance:.9, spawn:{type:'twig', life:{u:[5, 9]}, angle:{u:[30, 60]}, roll:{alt:90, jit:[-60, 60]}}, set:{cd3:{u:['6 * mm', '10 * mm']}}},
    {id:'branch-twigs', on:'branch', when:'age >= 2 && life >= 1 && cd3 <= 0', chance:.9, spawn:{type:'twig', life:{u:[5, 9]}, angle:{u:[30, 60]}, roll:{alt:90, jit:[-60, 60]}}, set:{cd3:{u:['5 * mm', '9 * mm']}}},
  ],
  leaf:{shape:'lobed', accent:'#4d7d3a', autumn:0xB5702A, max:1100,
    along:{twig:{arrangement:'cluster', start:12, gap:[50, 68], n:1, size:[92, 124], incl:35, pet:[8, 14], aspect:.58, end:2}}},
  product:{kind:'acorn', on:['twig'], n:10, r:[19, 23], stalk:[10, 16], zMin:.3, zMax:.95, outer:450, sep:230, perLimb:3,
    colors:{set:0x9DB860, ripening:0xA08A3E, ripe:0x8A6234, harvested:0xD4A03C, fallen:0x6B5B4F}},
  blossom:{bud:0xC9C86A, open:0xE4E29A, n:2, extra:10, size:.8, on:['twig']},
  bark:{tone:1.12, plates:1.5}, flare:{amount:.7, h:150}, lobes:{n:6, amp:.26, h:150}, ground:{r:900}, roots:6,
};

/* ---------- the pine: excurrent, whorled, conical ---------- */
S.pine = {
  name:'Pine', latin:'Pinus sylvestris', evergreen:true, life:70, multiplier:5, budget:9000, lean:{sd:.05}, pipe:2,
  vars:{habit:{n:[1, .14], min:.72, max:1.36}, grow:{n:[1, .05], min:.9, max:1.1}, H:'L * 30 * grow', zB:'L * 30 * grow * .27', zTop:'L * 30 * grow * .95', sc:'L / 70', mm:'m / 5 / habit'},
  root:{type:'leader', life:'L * grow'},
  /* the cone: boughs are drawn in toward it */
  crown:{out:[[0, 0], [700, 750], [1500, 560], [2200, 140], [2600, 30]], k:.06},
  types:{
    leader:{kind:'trunk', order:0, step:30, lean:1, env:false, r:{end:3.4, taper:.004}, turn:{n:[0, 5]}, pitch:{n:[0, 1]}, tropism:[{dir:[0, 0, 1], k:.12}]},
    co:{kind:'upper', order:1, step:26, lean:.3, r:{end:3.4, taper:.003}, turn:{n:[0, 4]}, pitch:{n:[0, 1.5]}, tropism:[{dir:[0, 0, 1], k:.1}]},
    bough:{kind:'scaffold', order:1, step:24, lean:.25, r:{end:3.4, taper:.003}, turn:{n:[0, 5]}, pitch:{n:[0, 2.5]}, tropism:[{dir:[0, 0, 1], k:bend(.5, .45, 24)}]},
    branchlet:{kind:'secondary', order:2, step:16, lean:.2, r:{end:3.2, taper:.002}, turn:{n:[0, 4]}, pitch:{n:[0, 2.5]}, tropism:[{dir:[0, 0, 1], k:'.03 + .03 * u'}]},
    tuft:{kind:'shoot', order:3, step:12, leafy:true, lean:0, r:{end:3, taper:0}, turn:{n:[0, 4]}, pitch:{n:[0, 2]}, tropism:[{dir:[0, 0, 1], k:.04}]},
  },
  spawn:[
    {id:'top', on:'leader', when:'life < 3', spawn:{type:'tuft', n:3, life:{u:[3, 4]}, angle:{u:[0, 25]}, roll:[0, 360]}},
    {id:'end-tufts', on:['bough', 'branchlet', 'co'], when:'life < 1', spawn:{type:'tuft', n:2, life:{u:[3, 4]}, angle:{u:[0, 25]}, roll:[0, 360]}},
    /* the whorl: four to six boughs round the leader at once, every 7-10 steps from the clear bole up; each reaches less as it goes up (the cone) */
    {id:'whorl', on:'leader', when:'z >= zB && z < zTop - 120 && cooldown <= 0', chance:.92,
      spawn:{type:'bough', vig:{n:[1, .12], min:.78, max:1.28}, n:{w:[[3, .12], [4, .25], [5, .38], [6, .25]]}, life:{u:['max(4, (zTop - z) / 30 * .30 * sc * 1.43)', 'max(5, (zTop - z) / 30 * .40 * sc * 1.43)']}, angle:{u:[76, 100]}, roll:{phyllo:137.5, whorl:true, jit:[-14, 14]}, cooldown:[3, 5], cd2:[2, 4]},
      set:{cooldown:{u:['7 * mm', '10 * mm']}}},
    {id:'co-leader', on:'leader', when:'z > zB + 500 && z < zTop - 500 && life > 8', chance:.004, spawn:{type:'co', life:'life * .5', angle:{u:[12, 24]}, roll:[0, 360]}},
    {id:'branchlets', on:'bough', when:'age >= 3 && life >= 3 && cooldown <= 0', chance:.9,
      spawn:{type:'branchlet', vig:{n:['vig', .08], min:.72, max:1.4}, life:{u:['7 * (1 - .5 * u) * sc * vig', '13 * (1 - .5 * u) * sc * vig']}, angle:{u:[40, 70]}, roll:{alt:80, jit:[-35, 35]}, cd2:[1, 3]}, set:{cooldown:{u:['3 * mm / vig', '5 * mm / vig']}}},
    {id:'tufts', on:['bough', 'branchlet'], when:'u >= .3 && life >= 2 && cd2 <= 0', chance:.8, spawn:{type:'tuft', life:{u:[2, 4]}, angle:{u:[25, 60]}, roll:[0, 360]}, set:{cd2:{u:['4 * mm', '6 * mm']}}},
  ],
  leaf:{shape:'needle', accent:'#3f8a6c', autumn:0x3a5a3c, max:3200,
    along:{tuft:{arrangement:'tuft', n:[7, 9], len:[80, 110], width:6, spread:40, droop:.1}}},
  product:{kind:'cone', on:['branchlet'], n:8, r:[44, 52], stalk:[8, 12], zMin:.34, zMax:.92, outer:260, sep:260, perLimb:2,
    colors:{set:0x7C9A4E, ripening:0x8D7A3A, ripe:0x8A5A32, harvested:0xB8963E, fallen:0x6B5B4F}},
  bark:{tone:1.15, plates:1.4}, flare:{amount:.8, h:150}, lobes:{n:5, amp:.3, h:140}, ground:{r:640},
};

/* ---------- the bonsai: cbonsai's recipe ---------- */
S.bonsai = {
  name:'Bonsai', latin:'after cbonsai', evergreen:false, life:32, multiplier:5, budget:4500, lean:{sd:.10}, pipe:2,
  root:{type:'trunk', life:'L'},
  types:{
    trunk:{kind:'trunk', order:0, step:36, lean:1, env:false, r:{end:11, taper:.012},
      turn:{n:[0, 'age < m * 3 ? 24 : 8']}, pitch:{n:[0, 3]}, tropism:[{dir:[0, 0, 1], k:'age < m * 3 ? .035 : .10'}]},
    limb:{kind:'scaffold', order:1, step:34, lean:.5, env:false, r:{end:9, taper:.012},
      turn:{n:[0, 'age < m * 3 ? 24 : 8']}, pitch:{n:[0, 3]}, tropism:[{dir:[0, 0, 1], k:'age < m * 3 ? .035 : .10'}]},
    shoot:{kind:'secondary', order:2, step:26, lean:.3, r:{end:7, taper:.01}, env:false,
      turn:{n:[0, 10]}, pitch:{w:[[10, .2], [0, .6], [-10, .2]]}, tropism:[{dir:[0, 0, 1], k:.036}]},
    dying:{kind:'shoot', order:3, step:20, leafy:true, r:{end:4.2}, env:false, turn:{n:[0, 26]}, pitch:{w:[[12, .2], [0, .6], [-12, .2]]}, tropism:[{dir:[0, 0, 1], k:.04}]},
    dead:{kind:'shoot', order:3, step:15, leafy:true, branch:false, r:{end:2.4}, env:false, turn:{n:[0, 14]}, pitch:{w:[[16, .3], [0, .4], [-16, .3]]}, tropism:[{dir:[0, 0, 1], k:.02}]},
  },
  spawn:[
    {id:'dead-fan', on:['trunk', 'limb', 'shoot', 'dying'], when:'life < 3', spawn:{type:'dead', life:'life + 1', angle:{n:[35, 12]}, roll:[0, 360]}},
    {id:'dying-fan', on:['trunk', 'limb', 'shoot'], when:'life < m + 2', spawn:{type:'dying', life:'life', angle:{n:[40, 14]}, roll:[0, 360]}},
    {id:'trunk-limbs', on:['trunk', 'limb'], chance:'life % m == 0 ? 1 : .3333',
      out:[{chance:.125, when:'life > 7 && age >= 3', spawn:{type:'limb', life:['life - 2', 'life + 3'], angle:{n:[34, 10]}, roll:[0, 360]}},
           {when:'cooldown <= 0', spawn:{type:'shoot', life:'life + m', angle:{n:[72, 10]}, roll:{alt:80, jit:[-35, 35]}}, set:{cooldown:'m * 2'}}]},
  ],
  leaf:{shape:'round', accent:'#4f8f55', autumn:0xC9A23A, aspect:.82, max:1500,
    along:{dying:{arrangement:'cluster', start:0, gap:[18, 26], n:[1, 2], size:[54, 70], incl:40, pet:[8, 14], end:2}, dead:{arrangement:'cluster', start:0, gap:[16, 22], n:[1, 2], size:[48, 62], incl:40, pet:[8, 12], end:1}}},
  product:{kind:'berry', on:['dying'], n:7, r:[16, 20], stalk:[14, 18], zMin:.2, outer:80, sep:120, perLimb:3,
    colors:{set:0x9DB860, ripening:0xB8963E, ripe:0xB03A48, harvested:0xD4A03C, fallen:0x6B5B4F}},
  blossom:{bud:0xE6B0C0, open:0xFBF3F0, n:2, extra:8, size:.8, on:['dying']},
  bark:{tone:1, plates:1}, flare:{amount:.7, h:110}, lobes:{n:5, amp:.4, h:120}, ground:{r:440},
};

if(G) for(const [k, t] of Object.entries(S)) G.register(k, t);
const API = {species:S};
if(typeof window !== 'undefined') window.EnvironSpecies = API;
if(typeof module !== 'undefined' && module.exports) module.exports = API;
})();
