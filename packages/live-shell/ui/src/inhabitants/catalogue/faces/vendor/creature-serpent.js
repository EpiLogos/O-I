/* creature-serpent.js: the Serpent, defined on the continuous-body engine (creature-body.js). The engine gives it one surface from snout to
   tail, curvature placed by friction, height by contact, states reached by crawling, and springs under every posture value. This file says
   what the serpent is: its proportions, its three states, its actions and what it does with its life. CREATURE-NOTES-SERPENT.md (Rounds
   14-16) tells how it got here. Exports window.Serpent. */
(() => {
'use strict';
const BD = window.CreatureBody, F = BD.FILLS, HL = 46;
/* the definition is kept (window.SERPENT_DEF) so a stage can build the same serpent with states of its own (stage-serpent-tree.js adds the course
   it climbs on a tree) */
const DEF = window.SERPENT_DEF = {
  name:'Serpent', ink:'#3A7D5C',
  length:1080, width:16, columns:14, tailLength:270, neck:[50, 205],
  head:{length:HL, hinge:43, rigid:41, lip:1.72, eye:{s:21, psi:1.06, r:3.7}, fangs:true},
  /* half-width a and half-height b along the body: a wide, flat head, the jaw's angle at 43, a pinch at the neck, the trunk thickest near a
     third of the length, a long taper */
  profile:{
    a:[[0, 0], [1, 2.6], [3, 4.6], [8, 7.1], [16, 9.8], [26, 12.2], [35, 13.9], [41, 14.3], [47, 13.1], [55, 10.8], [66, 10.2], [100, 11.7], [180, 14.7], [320, 16], [560, 15.6], [740, 12.6], [860, 8.6], [960, 4.8], [1040, 1.9], [1080, .35]],
    b:[[0, 0], [1, 2.1], [3, 3.5], [8, 4.6], [16, 5.9], [26, 7.3], [35, 8.5], [41, 9.1], [47, 9.3], [55, 9.2], [66, 9.4], [100, 10.6], [180, 13.3], [320, 14.5], [560, 14.1], [740, 11.5], [860, 7.9], [960, 4.5], [1040, 1.8], [1080, .35]],
  },
  start:'heap',
  states:{
    heap:{label:'coiled heap', fill:F.coil, par:{sN:BD.riseRoot(HL, 128), R:44, dR:22, dir:-1}, rootAt:P => P.sN,
      neck:{H:128, sb:.14, pitch:.16}, gaze:'world', tail:{curl:.6}},
    nautilus:{label:'nautilus', fill:F.spiral, par:{r0:23, gap:.7, dir:-1}, tight:true,
      neck:{H:4, sb:0, pitch:.02}, gaze:'rel', tail:{curl:.35}},
    /* the two closed forms: the ring, and the figure of eight whose second loop turns the other way and crosses over the first. Each takes the
       true tip of its tail between its lips (S, the length already in, is 0) and swallows from there */
    ouroboros:{label:'ouroboros', fill:F.ring, par:{S:0, dir:-1}, ring:true,
      neck:{H:0, sb:0, pitch:0}, gaze:'rel', tail:{curl:0}},
    lemniscate:{label:'lemniscate', fill:F.eight, par:{S:0, dir:-1, cross:.7}, ring:true,
      neck:{H:0, sb:0, pitch:0}, gaze:'rel', tail:{curl:0}},
  },
  actions:{
    flick:{label:'tongue flick', not:['ouroboros', 'lemniscate'], run:x => x.tongue(1 + Math.floor(x.R(1, 4)))},
    look:{label:'look', run:x => { x.lookAt(x.f.rootFwd + x.R(-1.3, 1.3), x.R(700, 1300)); if(Math.random() < .7) x.packet(x.NECK1 + 20, x.R(.004, .008) * (Math.random() < .5 ? 1 : -1), 50, 70); }},
    peek:{label:'peek', in:['nautilus', 'heap'], ms:5400, run:x => { x.busy(5200); x.goal('H', Math.max(62, x.home('H') + 47), 1100); x.goal('pitch', -.05, 900); x.at(900, () => x.lookAt(x.f.rootFwd + x.R(-1, 1), 900)); x.at(1300, () => x.tongue(2)); x.at(2500, () => x.lookAt(x.f.rootFwd + x.R(-1.2, 1.2), 900)); x.at(3900, () => x.backTo(1300)); }},
    rear:{label:'rear', in:['heap', 'nautilus'], brisk:true, run:x => { x.busy(5000); x.goal('H', Math.max(210, Math.min(240, x.home('H') + 40)), 1500); x.goal('sb', Math.max(.5, x.home('sb')), 1300); x.goal('pitch', -.1, 1200); x.packet(x.NECK1 + 40, .006, 60, 60); x.at(900, () => x.tongue(3)); x.at(3200, () => x.backTo(1900)); }},
    /* the strike (engine verb): the neck draws back into a tall S, unfolds out and down onto the target with the jaws opening before contact, bites
       and holds, then draws back along the same shapes. Its numbers (def.strike) are the engine's defaults. */
    strike:{label:'strike', in:['heap'], brisk:true, ms:3200, run:x => x.strike()},
    strikeMiss:{label:'strike (miss)', in:['heap'], brisk:true, ms:3200, run:x => x.strike({miss:true})},
    yawn:{label:'yawn', not:['ouroboros', 'lemniscate'], ms:3400, run:x => { x.busy(3200); x.goal('H', x.home('H') + 22, 900); x.goal('pitch', Math.max(-.75, Math.min(-.32, x.home('pitch') - .25)), 900); x.goal('gape', 1, 1100); x.at(2000, () => { x.goal('gape', x.home('gape'), 700); x.backTo(1200); }); }},
    tailflick:{label:'tail flick', not:['ouroboros', 'lemniscate'], ms:1200, run:x => { const s = x.home('curl'); x.goal('curl', s + (s > 0 ? -1.6 : 1.6), 260); x.at(300, () => x.goal('curl', x.home('curl'), 700)); }},
    lure:{label:'lure', not:['ouroboros', 'lemniscate'], ms:4200, run:x => { x.goal('lure', 1, 500); x.goal('tailUp', Math.max(.25, x.home('tailUp')), 600); x.at(3400, () => { x.goal('lure', x.home('lure'), 700); x.goal('tailUp', x.home('tailUp'), 900); }); }},
    rattle:{label:'rattle', in:['heap', 'nautilus'], run:x => { x.goal('tailUp', 1, 600); x.goal('rattle', 1, 400); x.goal('H', Math.max(x.home('H'), 150), 800); x.goal('sb', Math.max(.6, x.home('sb')), 800); x.at(2600, () => { x.goal('rattle', 0, 500); x.goal('tailUp', x.home('tailUp'), 900); x.backTo(1200); }); }},
    /* the ring (creature-ring.js): swallow runs on to the smallest ring (about 48 s at tempo 1), hold stops it at any stage, release plays it back out */
    swallow:{label:'swallow the tail', in:['ouroboros', 'lemniscate'], run:x => x.swallow()},
    hold:{label:'hold the ring', in:['ouroboros', 'lemniscate'], ms:600, run:x => x.ringHold()},
    release:{label:'let it out', in:['ouroboros', 'lemniscate'], run:x => x.release()},
    shed:{label:'shed', run:x => x.shed(7000)},
    roam:{label:'roam', roam:true},
  },
  bouts:{
    heap:{look:5, tongue:3, lower:1, tail:1.4, tailflick:.5, lure:.3, yawn:.25, shift:.9, peek:.6, strike:.12},
    nautilus:{peek:3, tongue:1.6, tail:1.2, shift:1.2, look:1.2, yawn:.2},
    ouroboros:{swallow:3, release:3, regrip:1, shift:1.4},   // (the engine decides which of them fit the ring's stage: it swallows and lets go in parts)
    lemniscate:{swallow:3, release:3, regrip:1, shift:1.4},
  },
};
window.Serpent = BD.build(DEF);
})();
