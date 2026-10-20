/* Speech is articulatory POSITIONS on the current face, not amounts added to it. faceMuscles still does
   musTargets(f.speechTargets) and jaw += f.speechJaw, but the mouth state (faceMouthState) also cancels the
   base face's own contribution to every articulator a phone claims, in proportion to the claim computed here
   (speechClaims, from the same dominance weights the blend uses). A /m/ on a laugh closes, a /f/ on a shock
   reaches the teeth; the expression still shows in what a phone does not claim (the corners, a smile's
   width). SPEECH.p.claim 0 is the old additive behaviour exactly. This file never replaces that face, never
   ducks f.expr.w, and never sets f.talking (that plays the random viseme bag).

   The rest of the face speaks too, and it speaks as the face under it feels. speechAffect reads that face (the base's
   muscles, f.bActs: a smile, a sadness, anger, wide eyes, tired lids, the plane's arousal) and the pieces below read the
   reading: upperAt (the accents: brows, lids, nostrils, head), cheekAt (the cheek pads follow the lips and the jaw, and the
   lower lids the cheeks), breathAt (the nostrils before a phrase), shapePlayed (how large the speaker articulates, and the
   smile's spread, the angry speaker's teeth), speechLife (the blink rate). Every reading is 0 on a face at rest, so the
   neutral speech the mouth lab holds is untouched; SPEECH.p.cheek and SPEECH.p.affect (0 is off) are the panel's bars.

   Research, and what was taken from each:

   Fisher 1968, as tabled by Bear & Harvey 2017 (arXiv:1710.01093): five consonant
   viseme groups from lipreading confusions — {k g ŋ m} {p b} {f v} {ʃ ʒ tʃ dʒ}
   {t d n θ ð s z r l}. The {k g ŋ m} merger is a confusion of poorly visible places,
   not a shared mouth shape, so /m/ does not get a velar target.

   Jeffers & Barley 1971, as tabled by Cappelletta & Harte 2012 (ICPRAM): 11 visemes
   under ordinary viewing. Taken as the production grouping: {p b m} bilabial,
   {f v} labiodental, {θ ð} dental, {tʃ dʒ ʃ ʒ} postalveolar, {s z} sibilant,
   {t d n l} alveolar, {k g ŋ} velar, rounded {w r uw uh ow}. /h/ has no viseme —
   the lips are already on the next vowel — so /hh/ is a weak, nearly empty delta
   with a low dominance peak.

   Neti et al. 2000 (12–16 classes) and the MPEG-4 / Oculus 15 (sil PP FF TH DD kk
   CH SS nn RR aa E I O U): vowels kept off the consonant list. Recognition maps
   collapse features (Neti V7 puts /aa/ with /ow/). Here jaw opening and lip rounding
   stay independent, so /aa/ is open and unrounded while /ow/ is rounded and less open.
   Phonemes that share a viseme still share a family of deltas; they are not one pose.

   Cohen & Massaro 1993, "Modeling Coarticulation in Synthetic Visual Speech"
   (Models and Techniques in Computer Animation, 139–156), implementing Löfqvist 1990:
   each segment has a target and a dominance about its temporal centre τ,
     D(t) = α exp(-θ |t-τ|^c)  before τ,   D(t) = α exp(-φ |t-τ|^c)  after τ.
   The mouth at t is the normalised blend Σ D_i T_i / Σ D_i (Beskow & Nordenberg 2006),
   not a splice and not a boolean open. c = 1, the original unit exponent. θ is
   anticipation (smaller = the vowel reaches further back), φ is carryover. α, θ, φ
   are hand-set for this rig, not fit to motion capture — Cohen & Massaro hand-tuned
   the same way. Vowel θ/φ are steep enough that a consonant centre stays on the
   consonant: /h/ in "who" is not already the rounded vowel, and /s/ in "see" is not
   already the spread vowel. The vowel still climbs through the consonant's second
   half, so the boundary anticipates. Rounding carryover is a little steeper than
   the other vowel classes, so a coda is not left in a kiss. Dominance is per
   channel, as in that model: a segment that does not claim a muscle keeps a quarter
   of its α on that channel (UNCLAIMED). A vowel therefore cannot veto lip closure,
   and /h/ cannot veto rounding. Bilabials and labiodentals use a high α and a
   steeper θ/φ than the vowels, so the closure is present at the consonant centre
   and has let go by the vowel centre. A single shared denominator under-shoots
   closure (Beskow; Cosi 2002 adds an explicit resistance term — the quarter-weight
   unclaimed channel is the stand-in here).

   Visible features, as deltas from the current face, not absolute smiles.
   Tang, Hannah, Jongman, Sereno & Wang 2015: the visible speech measures are jaw
   lowering, horizontal lip spread, and lip protrusion. Stavness, Nazari, Perrier,
   Demolin & Payan 2013: orbicularis oris protrusion wants a high jaw; bilabial
   closure does not. Mayer, Gick & Stavness 2021 and Gick et al. ICPhS 2019: spreading
   recruits buccinator and risorius; bilabial closure is lip compression; labiodental
   contact is mentalis plus upper-lip levator, not a grin. Mayer et al. also list
   zygomaticus as a possible spreader. It is not used. Zygomaticus major and minor
   are the smile, and the current expression already owns them. Ordinary spread is
   risorius plus a little buccinator. /iy/ is that spread, not a smile. No phone
   lists zyg or zygMin. dao, frontalis, corrugator, and levator anguli oris stay
   with the expression. Nasal flare is only on nasals, and only light.

   Holds are animation time, not acoustic time. The rig steps
     v += (k^2 (T - a) - 2 k 0.78 v) dt
   with k = muscle speed ≈ 8–14 and dt in seconds, capped at 50ms. The envelope
   time constant is about 1/(0.78 k): ~90ms at speed 14 (lip tuck, tongue).
   Playback multiplies that clock by SPEECH.rate. At rate 3 a 160ms phone is
   ~53ms of wall time, so a target of 0.9 on a short phone never arrives. The
   consonants the viewer can actually see — labiodental, dental, alveolar,
   rhotic — are held 480–540ms: at rate 3 that is about one speak-cycle viseme
   (roughly 160–180ms), long enough for the jaw follower (a 55ms low-pass, not
   the muscle spring) to reach a visible opening. What shows is the lips:
   opening, upper-lip rise, lower-lip drop, rounding, tucking the lower lip
   onto the upper teeth. The tongue sits inside the mouth, so tongue up and
   tongue out stay smaller than that lip cue. Lip tuck, tongue up, and tongue
   out already release faster than they close (rel 2 on those muscles), and
   labiodental phi stays steep so the tuck is gone by the vowel centre. Nasals
   stay long enough for a coda to leave a rounded vowel before its centre.
*/
const C = 1;
const UNCLAIMED = .25;   // the default of SPEECH.p.unclaimed
const DOM = {
  spread: {alpha:1.00, theta:9.0, phi:13.5, c:C},
  round:  {alpha:1.05, theta:9, phi:16, c:C},   // theta was 8.1: "so" was already a pucker at the start of its /s/
  open:   {alpha:1.00, theta:10.8, phi:14.4, c:C},
  mid:    {alpha:0.90, theta:11.7, phi:15.3, c:C},
  glideR: {alpha:0.90, theta:3.6, phi:12, c:C},   // Round 10: was 2.2 / 3.0, whose rounding reached a whole vowel each side; phi was 6.5 until 2026-10-14 ("we want one" stayed rounded through every sound)
  glideS: {alpha:0.80, theta:3.4, phi:5.5, c:C},
  bilab:  {alpha:1.30, theta:22, phi:28, c:C},
  labdent:{alpha:1.25, theta:8, phi:32, c:C},
  fricR:  {alpha:0.75, theta:7, phi:9, c:C},   // was 3.6 / 4.0, the widest reach in the table: "she" stayed rounded through its /iy/
  fricS:  {alpha:0.62, theta:3.4, phi:3.8, c:C},
  cons:   {alpha:0.50, theta:4.2, phi:4.6, c:C},
  stop:   {alpha:0.55, theta:5.5, phi:6.0, c:C},
  nasal:  {alpha:0.60, theta:4.5, phi:5.0, c:C},
  glottal:{alpha:0.20, theta:5.5, phi:5.5, c:C},
  pause:  {alpha:0.30, theta:3.5, phi:3.5, c:C},
  gap:    {alpha:0.12, theta:2.0, phi:2.2, c:C},
  clause: {alpha:0.24, theta:3.0, phi:3.0, c:C},
  dental: {alpha:1.00, theta:5, phi:14, c:C},
  tap:    {alpha:0.85, theta:5.5, phi:16, c:C},   // was 1.15: a quick t d was flattening the vowel beside it
  rhotic: {alpha:0.90, theta:3.8, phi:12, c:C},   // was 1.05, theta 2.2
  velar:  {alpha:0.85, theta:5.5, phi:12, c:C}    // /k g/ are stops like /t d/; they had the vowels' own class (mid) and read as a schwa
};
function phone(A, dur, dom, mus, pk){
  mus = mus || {};
  return {A, jaw:openFor(A, pk, mus), dur, dom, mus};
}
/* The opening the table names is the light between the lips, in face pixels — about 5 to the
   millimetre, so 45px is a 9mm opening, 80px the wide low vowel, 20px a sibilant's slit. The jaw
   that holds the mouth open by that much is the mouth model's own arithmetic, inverted: the jaw
   drops the lower lip 150px at 1 and carries it another 22·J, the depressor drops it 18·dli, the
   levator raises the upper lip 22·ulr, the mandible's own term adds 6px once it is open past a
   third, the pucker's gap adds 14·P², and a tucked lower lip is drawn up under the upper incisal
   edge instead — which is why a labiodental cannot be made with the jaw shut. Solved rather than
   approximated, so what the table names is what is seen. */
function mouthGap(J, pk, mus){
  mus = mus || {};
  const p = Math.max(0, Math.min(1, pk || 0)), P = p * p * (3 - 2 * p), tuck = Math.min(1, mus.lipTuck || 0);
  const ulr = mus.ulr || 0, dli = mus.dli || 0, ris = mus.ris || 0, ment = mus.ment || 0, dao = mus.dao || 0;
  /* the flare (face-core faceMouthState): rounded and lifted at once, the lips peel off the teeth by MOUTH_FLARE_LIFT */
  const fq = Math.max(0, Math.min(1, (Math.min(ulr, dli) - .08) / .22)), fl = P * fq * fq * (3 - 2 * fq);
  const lift = typeof MOUTH_FLARE_LIFT !== 'undefined' ? MOUTH_FLARE_LIFT : [10, 12];
  /* the peel (face-core MOUTH_PEEL): a near-full depressor turns the unrounded lower lip off the lower teeth */
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const peel = (typeof MOUTH_PEEL !== 'undefined' ? MOUTH_PEEL : 0) * (typeof mouthPeelOf !== 'undefined' ? mouthPeelOf(dli) : 0) * (1 - sm(.1, .3, mus.orbOris || 0));
  const up = 22 * ulr + 5 * ris + 6 * Math.min(1, J * 2.5) - 6 * ment + lift[0] * fl;
  /* the lower lip's own drop, and past 30 px its give as the mouth widens (face-core faceMouthState) */
  let rl = 18 * dli + peel + 7 * dao + lift[1] * fl;
  const w = 1 + .32 * ris + .08 * (mus.bucc || 0) - (typeof MOUTH_ROUND_W !== 'undefined' ? MOUTH_ROUND_W : .36) * P - .13 * J;
  if(rl > 30) rl = 30 + (rl - 30) * (1 - sm(1.04, 1.13, w));
  let low = 172 * J + rl;
  if(tuck > 0) low += (13 - low) * tuck;        // the tuck draws the lower lip up under the upper incisal edge
  return Math.max(0, low + up) + 14 * P * P;
}
function openFor(A, pk, mus){
  if(A <= mouthGap(0, pk, mus)) return 0;
  let lo = 0, hi = .62;
  for(let i = 0; i < 22; i++){ const m = (lo + hi) / 2; if(mouthGap(m, pk, mus) < A) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
/* Targets are in the mouth model's units: a muscle at 1 is its full pull. Jaw and lip are separate
   axes (JALI): /aa/ is jaw without lip, /uw/ is lip without jaw, /iy/ is spread with a modest jaw.
   lipTuck is the lower lip drawn up under the upper teeth, tongueUp the tip to the ridge, tongueOut
   the tip forward between the teeth. /f v/ tuck the lower lip up onto the upper teeth and lift the
   upper lip a little (ulr → Ru) — the teeth show over the tucked lip and no tongue does any of it.
   /th dh/ carry the tip forward until it is the thing in the gap; the upper teeth end where the tip
   begins. /t d n l/ are the tongue's own business behind the teeth, so the lips only part: no
   rounding, barely any opening, and the lower lip is drawn down (dli) so the edges of the teeth
   show the way they do on those sounds. /s z/ are a spread slit with the lower lip drawn down and
   the upper lip lifted a hair, which is what puts both rows of teeth near edge to edge around a
   line of dark. /sh zh ch jh/ are that slit carried into rounding. /r/ is roundness and a little
   jaw — the English rhotic's visible cue is the lips — with the tongue bunched where it cannot be
   seen. The tongue is inside the mouth; the gesture that has to be read is the lips.
   Round 6: the front vowels carry a tongueUp that grows with their height (/iy/ high, /eh/ low) so an
   open mouth shows a tongue body and not a lip line (an open /aa/ gets its mound from the mouth model's
   own aperture-scaled baseline); /iy ih ey eh/ and /s z/ draw the lower lip down (dli) so the lower row
   of teeth shows edge to edge under the upper edge; /d n/ raise the tongue pad (tongueUp .42, the
   ceiling is the lab's tngFill .35) and /n/ opens like /d/ with no spread; /r/ bunches (tongueUp .36).
   /t d n s z/ hold the tip behind the teeth (tongueOut 0, claimed): unclaimed, a /th/ after them drew the tip forward
   across them ("around the" showed the tongue on its /n d/). */
const PHONE = {
  pause: phone(0,   300, 'pause',  {}),
  gap:   phone(0,    40, 'gap',    {}),
  clause:phone(0,   170, 'clause', {}),
  p:  phone(0,    190, 'bilab',  {lipPress:.95, ment:.12, incSup:.1, incInf:.1}),
  b:  phone(2,    180, 'bilab',  {lipPress:.9, ment:.1, incSup:.08, incInf:.08}),
  m:  phone(0,    210, 'bilab',  {lipPress:.95, ment:.1, nasal:.26, nasTrans:.10, incSup:.08}),
  f:  phone(13,   520, 'labdent',{lipTuck:.98, ulr:.22, ment:.05, dli:.06}),
  v:  phone(12,   500, 'labdent',{lipTuck:.95, ulr:.2, ment:.04, dli:.05}),
  th: phone(50,   560, 'dental', {tongueOut:.85, dli:.57, ulr:.53}),   // the tip just past the upper teeth, which show over it; the upper lip lifts off them (was 24 px, the tongue over the teeth). 50 px (18, tongue 1, dli .5, ulr .24 until 2026-10-20: a slit with a red line in it): held .200 of the width open against Meta TH's .213 (.070), the rows .122 apart against .134 (.040); its tongue .116 is Meta TH emphasised's (.11), the mild photo's .047 is less than the tip past the teeth the dental rules ask
  dh: phone(50,   540, 'dental', {tongueOut:.85, dli:.57, ulr:.53}),   // the shape of /th/: voicing does not show
  t:  phone(46,   520, 'tap',    {dli:1, ulr:.27, tongueUp:.3, tongueOut:0}),   // the lips parted on both rows, the teeth close together, the tip on the ridge out of sight (Meta DD, Azure 19; 7 px with dli .4 ulr .22 until 2026-10-19: a closed slit). 46, ulr .27 (40, .4 until 2026-10-20): the lower lip peels off the lower row (MOUTH_PEEL), so the jaw is not what opens it; held, the rows stand .009 of the width apart against the photo's .013 (9 px before, 3 in the photo). 54 with a 26 px peel the same day showed the lower teeth "a little too much" (owner); 8 px less, with the peel, keeps the jaw
  d:  phone(46,   500, 'tap',    {dli:1, ulr:.27, tongueUp:.36, tongueOut:0}),   // the same shape as /t/: voicing does not show (13 px until 2026-10-19)
  n:  phone(48,   320, 'nasal',  {dli:1, ulr:.43, tongueUp:.32, tongueOut:0, nasal:.22, nasTrans:.08}),   // as /t d/ (Meta nn; 11 px until 2026-10-19; 38, ulr .38 until 2026-10-20, the lower row .05 of the width against the photo's .166; 56 that day, then 48 with the lighter peel: the owner found the lower teeth too much, and the photo rule for its opening stays broken)
  l:  phone(32,   400, 'cons',   {dli:.4, ulr:.14, tongueUp:.8, ris:.1}),
  s:  phone(26,   250, 'fricS',  {ris:.34, bucc:.08, ulr:.4, dli:.66, tongueOut:0}),   // the upper lip lifts off the teeth so both rows show in the slit, and stays off when "so" rounds it (a flare, not a pucker: ulr was .04, then .14). dli .66 is 13.5 px under the peel; opened to Meta SS (43 px, both rows bared) on 2026-10-20 it showed too much teeth and moved too much (owner), and is back
  z:  phone(26,   230, 'fricS',  {ris:.34, bucc:.08, ulr:.4, dli:.66, tongueOut:0}),   // as /s/ (voicing does not show)
  sh: phone(40,   270, 'fricR',  {orbOris:.52, ulr:.8, dli:1, ris:0}, .52),   // the lips forward and turned out, framing both rows close together in a squarer opening (Meta CH, Azure 16; 18 px with ulr .45 dli .55 until 2026-10-19: a closed /oo/)
  zh: phone(40,   240, 'fricR',  {orbOris:.52, ulr:.8, dli:1, ris:0}, .52),   // the shape of /sh/: voicing does not show
  ch: phone(40,   220, 'fricR',  {orbOris:.5, ulr:.8, dli:1, tongueUp:.2, ris:0}, .5),   // the shape of /sh/: its stop is the tongue, out of sight (16 px until 2026-10-19). The four round at .5-.52 (were .52-.6): rounding swells the lips, and at .58 the held /ch/ stood .726 of its width tall, a ball, against Meta CH's .629; at .5, .637
  jh: phone(40,   210, 'fricR',  {orbOris:.5, ulr:.8, dli:1, tongueUp:.2, ris:0}, .5),   // the shape of /ch/: voicing does not show
  r:  phone(15,   480, 'rhotic', {orbOris:.55, ulr:.2, dli:.1, ment:.05}, .55),   // its hold (ROUND_HOLD) keeps the spread off it after a spread vowel ("here")   // the protruded lips carry it; the bunched tongue is out of sight (was 24 px with a tongue mound, a small /ow/)
  y:  phone(23,   200, 'glideS', {ris:.42, bucc:.1, ulr:.14}),
  k:  phone(56,   200, 'velar',  {dli:1, ulr:.28, tongueBack:.85}),   // the lips parted on both rows, the teeth near together (Meta kk: a seam of .037 of the width, the opening mostly teeth), the back of the tongue out of sight; no lip shape of its own. 48 px with ulr .3 until 2026-10-19: the jaw as open as the vowels', the tongue in the gap, and "again" one opening from the a to the e. 56, ulr .28 (46, .56 until 2026-10-20; 62 with a 26 px peel the same day, the lower teeth "a little too much"): the lower lip peels off the lower row (MOUTH_PEEL); held, the opening .223 of the width (photo .26), the rows .040 apart (.037)
  g:  phone(56,   200, 'velar',  {dli:1, ulr:.28, tongueBack:.8}),
  ng: phone(15,   210, 'nasal',  {nasal:.20, nasTrans:.08, dli:.12, tongueBack:.7}),
  w:  phone(10,   260, 'glideR', {orbOris:.95, lipPress:.4, ment:.1, ris:0}, .95),   // a small round hole: the lips close in on the pucker (the press is fast, the rounding slow), not a pucker as open as /uw/
  hh: phone(17,   200, 'glottal',{dli:.12}),
  iy: phone(30,   400, 'spread', {ris:.62, bucc:.2, ulr:.2, dli:.54, tongueUp:.28}),
  ih: phone(34,   260, 'spread', {ris:.3, bucc:.08, ulr:.14, dli:.44, tongueUp:.38}),
  ey: phone(45,   360, 'spread', {ris:.34, bucc:.1, ulr:.16, dli:.4, tongueUp:.3}),   // under /eh/, as the vowels' order has it (52 on 2026-10-19 broke it); what shows the glide is the nucleus's time (GLIDE_AT) and its hold on the jaw (JAW_RESIST)
  eh: phone(46,   300, 'mid',    {ris:.3, bucc:.06, dli:.44, ulr:.14, tongueUp:.14}),   // mid and a little spread (was 52 px, nearly /ae/)
  ae: phone(66,   360, 'open',   {ris:.42, bucc:.14, dli:.42, ulr:.18}),   // wide and open, the corners back: not the tall /aa/ (was 66 px, spread .22)
  aa: phone(86,   440, 'open',   {dli:.38, ulr:.14}),   // 86 (was 78: .32 of the width held against Meta aa's .36, and in running speech it peaks near three quarters of the held opening; /ae ah/ opened with it, 66 and 52, so "cat" stands clear of "bet"). the lower lip pulls down off the lower teeth in the open vowels (dli was .16-.24: the lower row hardly showed in speech)
  ao: phone(56,   400, 'round',  {orbOris:.5, bucc:.08, dli:.14, ulr:0}, .5),
  ow: phone(36,   400, 'round',  {orbOris:.9, ment:.1, dli:.12, ulr:0}, .9),   // a rounded vowel names its upper lip at rest (ulr 0): unnamed, the lift of the /d z/ round it ("shadows") flowed in, and with the lower lip's drop the rounding drew as a /sh/'s flare, open on the teeth, not an o (owner, 2026-10-20: "no o'ing")
  ah: phone(52,   280, 'mid',    {dli:.32, ulr:.1}),
  ax: phone(30,   220, 'mid',    {dli:.2}),
  er: phone(27,   320, 'round',  {orbOris:.34, bucc:.06, dli:.12}, .34),
  uw: phone(22,   440, 'round',  {orbOris:1, ment:.12, bucc:.1, ulr:0}, 1),
  uh: phone(31,   280, 'round',  {orbOris:.55, bucc:.06, dli:.1, ulr:0}, .55),
  ay: phone(66,   240, 'open',   {dli:.34, ulr:.12}),
  ay2:phone(28,   220, 'spread', {ris:.5, bucc:.15, ulr:.14}),
  aw: phone(66,   240, 'open',   {dli:.34, ulr:.12}),
  aw2:phone(22,   220, 'round',  {orbOris:.9, ment:.1, dli:.06, ulr:0}, .9),   // as /oʊ/'s glide: the lower lip named, so the /n d/ after it ("around") do not pull it off the teeth into a flare
  oy: phone(50,   240, 'round',  {orbOris:.5, dli:.14, ulr:0}, .5),
  oy2:phone(29,   220, 'spread', {ris:.46, bucc:.14, ulr:.12}),
  ow2:phone(24,   200, 'round',  {orbOris:.92, ment:.1, dli:.06, ulr:0}, .92),   // the /oʊ/ glide: the rounding closes toward /u/
  ey2:phone(30,   200, 'spread', {ris:.46, bucc:.15, ulr:.18, dli:.48, tongueUp:.3})   // the /eɪ/ glide: "say" closes and spreads toward /iy/
};

const LEX = {
  a:['ax'], an:['ae','n'], the:['dh','ax'], of:['ah','v'], to:['t','uw'], too:['t','uw'], two:['t','uw'],
  you:['y','uw'], your:['y','ao','r'], i:['ay2'], me:['m','iy'], my:['m','ay2'], we:['w','iy'],
  he:['hh','iy'], she:['sh','iy'], be:['b','iy'], do:['d','uw'], go:['g','ow'], no:['n','ow'], so:['s','ow'],
  one:['w','ah','n'], three:['th','r','iy'], four:['f','ao','r'], five:['f','ay2','v'], six:['s','ih','k','s'],
  seven:['s','eh','v','ax','n'], eight:['ey','t'], nine:['n','ay2','n'], ten:['t','eh','n'],
  eleven:['ih','l','eh','v','ax','n'], twelve:['t','w','eh','l','v'], thirteen:['th','er','t','iy','n'],
  fourteen:['f','ao','r','t','iy','n'], fifteen:['f','ih','f','t','iy','n'], sixteen:['s','ih','k','s','t','iy','n'],
  seventeen:['s','eh','v','ax','n','t','iy','n'], eighteen:['ey','t','iy','n'], nineteen:['n','ay2','n','t','iy','n'],
  twenty:['t','w','eh','n','t','iy'], thirty:['th','er','t','iy'], forty:['f','ao','r','t','iy'],
  fifty:['f','ih','l','t','iy'], sixty:['s','ih','k','s','t','iy'], seventy:['s','eh','v','ax','n','t','iy'],
  eighty:['ey','t','iy'], ninety:['n','ay2','t','iy'], hundred:['hh','ah','n','d','r','ax','d'],
  thousand:['th','aw2','z','ax','n','d'], million:['m','ih','l','y','ax','n'],
  zero:['z','ih','r','ow'], and:['ae','n','d'], or:['ao','r'],
  hello:['hh','eh','l','ow'], world:['w','er','l','d'],
  baby:['b','ey','b','iy'], mama:['m','aa','m','ah'], papa:['p','aa','p','ah'], dada:['d','aa','d','ah'], maybe:['m','ey','b','iy'],
  okay:['ow','k','ey'], paper:['p','ey','p','er'], lady:['l','ey','d','iy'], later:['l','ey','t','er'], many:['m','eh','n','iy'], any:['eh','n','iy'],
  said:['s','eh','d'], says:['s','eh','z'], was:['w','ah','z'], were:['w','er'], are:['aa','r'],
  is:['ih','z'], his:['hh','ih','z'], her:['hh','er'], their:['dh','eh','r'], there:['dh','eh','r'],
  they:['dh','ey'], have:['hh','ae','v'], has:['hh','ae','z'], what:['w','ah','t'], who:['hh','uw'],
  know:['n','ow'], through:['th','r','uw'], thought:['th','ao','t'], people:['p','iy','p','ax','l'],
  little:['l','ih','t','ax','l'], about:['ax','b','aw2','t'], because:['b','ih','k','ao','z'],
  would:['w','uh','d'], could:['k','uh','d'], should:['sh','uh','d'],
  eye:['ay2'], eyes:['ay2','z'], see:['s','iy'], sea:['s','iy'], moon:['m','uw','n'],
  fish:['f','ih','sh'], cheese:['ch','iy','z'], yes:['y','eh','s'], please:['p','l','iy','z'],
  thanks:['th','ae','ng','k','s'], number:['n','ah','m','b','er'], point:['p','oy2','n','t'],
  success:['s','ax','k','s','eh','s'], decide:['d','ax','s','ay2','d'],
  plus:['p','l','ah','s'], minus:['m','ay2','n','ax','s'], equals:['iy','k','w','ax','l','z'],
  dollar:['d','aa','l','er'], percent:['p','er','s','eh','n','t'], at:['ae','t'],
  for:['f','ao','r'], from:['f','r','ah','m'], with:['w','ih','dh'], this:['dh','ih','s'],
  that:['dh','ae','t'], not:['n','aa','t'], but:['b','ah','t'], word:['w','er','d'],
  words:['w','er','d','z'], speak:['s','p','iy','k'], speech:['s','p','iy','ch']
};
/* Round 10: common words the rules get wrong, and the owner's test phrase. ay2/aw2/oy2 name a diphthong. */
Object.assign(LEX, {
  correction:['k','ax','r','eh','k','sh','ax','n'], direction:['d','ax','r','eh','k','sh','ax','n'], buddy:['b','ah','d','iy'],
  thoroughly:['th','er','ow','l','iy'], thorough:['th','er','ow'], want:['w','aa','n','t'], wants:['w','aa','n','t','s'],
  wanted:['w','aa','n','t','ih','d'], express:['ih','k','s','p','r','eh','s'], expression:['ih','k','s','p','r','eh','sh','ax','n'],
  correct:['k','ax','r','eh','k','t'], really:['r','iy','l','iy'], very:['v','eh','r','iy'], every:['eh','v','r','iy'],
  everything:['eh','v','r','iy','th','ih','ng'], something:['s','ah','m','th','ih','ng'], nothing:['n','ah','th','ih','ng'],
  anything:['eh','n','iy','th','ih','ng'], just:['jh','ah','s','t'], like:['l','ay2','k'], time:['t','ay2','m'],
  make:['m','ey','k'], take:['t','ey','k'], good:['g','uh','d'], look:['l','uh','k'], going:['g','ow','ih','ng'],
  come:['k','ah','m'], right:['r','ay2','t'], over:['ow','v','er'], after:['ae','f','t','er'], again:['ax','g','eh','n'],
  always:['ao','l','w','ey','z'], water:['w','ao','t','er'], where:['w','eh','r'], when:['w','eh','n'], which:['w','ih','ch'],
  while:['w','ay2','l'], whole:['hh','ow','l'], those:['dh','ow','z'], these:['dh','iy','z'], them:['dh','eh','m'],
  then:['dh','eh','n'], than:['dh','ae','n'], though:['dh','ow'], together:['t','ax','g','eh','dh','er'],
  today:['t','ax','d','ey'], tomorrow:['t','ax','m','aa','r','ow'], thing:['th','ih','ng'], things:['th','ih','ng','z'],
  think:['th','ih','ng','k'], use:['y','uw','z'], work:['w','er','k'], write:['r','ay2','t'], wrong:['r','ao','ng'],
  year:['y','ih','r'], young:['y','ah','ng'], need:['n','iy','d'], new:['n','uw'], next:['n','eh','k','s','t'],
  night:['n','ay2','t'], off:['ao','f'], old:['ow','l','d'], once:['w','ah','n','s'], only:['ow','n','l','iy'],
  open:['ow','p','ax','n'], other:['ah','dh','er'], our:['aw2','er'], out:['aw2','t'], part:['p','aa','r','t'],
  place:['p','l','ey','s'], put:['p','uh','t'], read:['r','iy','d'], same:['s','ey','m'], say:['s','ey'],
  school:['s','k','uw','l'], show:['sh','ow'], small:['s','m','ao','l'], some:['s','ah','m'], sound:['s','aw2','n','d'],
  still:['s','t','ih','l'], such:['s','ah','ch'], sure:['sh','uh','r'], tell:['t','eh','l'], try:['t','r','ay2'],
  turn:['t','er','n'], under:['ah','n','d','er'], until:['ah','n','t','ih','l'], way:['w','ey'], well:['w','eh','l'],
  went:['w','eh','n','t'], why:['w','ay2'], will:['w','ih','l'], woman:['w','uh','m','ax','n'], women:['w','ih','m','ax','n'],
  love:['l','ah','v'], give:['g','ih','v'], live:['l','ih','v'], does:['d','ah','z'], done:['d','ah','n'], gone:['g','ao','n'],
  both:['b','ow','th'], cold:['k','ow','l','d'], told:['t','ow','l','d'], hold:['hh','ow','l','d'], home:['hh','ow','m'],
  house:['hh','aw2','s'], mouth:['m','aw2','th'], south:['s','aw2','th'], south:['s','aw2','th'],
  voice:['v','oy2','s'], choice:['ch','oy2','s'], world:['w','er','l','d'], first:['f','er','s','t'],
  morning:['m','ao','r','n','ih','ng'], evening:['iy','v','n','ih','ng'], beautiful:['b','y','uw','t','ax','f','ax','l'],
  important:['ih','m','p','ao','r','t','ax','n','t'], different:['d','ih','f','r','ax','n','t'],
  computer:['k','ax','m','p','y','uw','t','er'], language:['l','ae','ng','g','w','ax','jh'],
  brown:['b','r','aw2','n'], down:['d','aw2','n'], town:['t','aw2','n'], now:['n','aw2'], how:['hh','aw2'], cow:['k','aw2'],
  around:['ax','r','aw2','n','d'], found:['f','aw2','n','d'], ground:['g','r','aw2','n','d'], round:['r','aw2','n','d'],
  count:['k','aw2','n','t'], hour:['aw2','er'], measure:['m','eh','zh','er'], pleasure:['p','l','eh','zh','er'],
  speaking:['s','p','iy','k','ih','ng'], talking:['t','ao','k','ih','ng'], testing:['t','eh','s','t','ih','ng']
});
/* diphthong tails stored as ay2 so the lexicon can name the glide. Map them at lookup. */
function phoneOf(name){
  if(name === 'ay2') return ['ay','ay2'];
  if(name === 'aw2') return ['aw','aw2'];
  if(name === 'oy2') return ['oy','oy2'];
  return [name];
}

const ONES = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
function cardinal(n){
  n = Math.trunc(n);
  if(n < 0) return 'minus ' + cardinal(-n);
  if(n < 20) return ONES[n];
  if(n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if(n < 1000){
    const h = ONES[Math.floor(n / 100)] + ' hundred';
    return n % 100 ? h + ' and ' + cardinal(n % 100) : h;
  }
  if(n < 1000000){
    const t = cardinal(Math.floor(n / 1000)) + ' thousand';
    return n % 1000 ? t + ' ' + cardinal(n % 1000) : t;
  }
  return String(Math.abs(n)).split('').map(d => ONES[+d]).join(' ');
}
const GLYPH = {'&':'and','@':'at','#':'number','$':'dollar','%':'percent','+':'plus','=':'equals'};

const LETTER = {a:'ey', b:'b iy', c:'s iy', d:'d iy', e:'iy', f:'eh f', g:'jh iy', h:'ey ch', i:'ay2', j:'jh ey', k:'k ey', l:'eh l', m:'eh m', n:'eh n', o:'ow', p:'p iy', q:'k y uw', r:'aa r', s:'eh s', t:'t iy', u:'y uw', v:'v iy', w:'d ah b ax l y uw', x:'eh k s', y:'w ay2', z:'z iy'};

/* Lexical stress where the first-syllable rule is wrong: the index of the stressed syllable among the
   word's nuclei. The phone list records it as phones.sIdx, the absolute index of that phone. */
const STRESS_AT = {decide:1, success:1, about:1, because:1, correction:1, direction:1, correct:1, express:1, expression:1, again:1,
  together:1, today:1, tomorrow:1, until:1, around:1, important:1, computer:1, tonight:1, begin:1, behind:1, believe:1, remember:1};
function pushWord(phones, w){
  if(w.length === 1 && !LEX[w] && LETTER[w]){
    LETTER[w].split(' ').forEach(p => phoneOf(p).forEach(q => phones.push(q)));
    return;
  }
  const wp = wordPhones(w), base = phones.length;
  wp.forEach(p => phones.push(p));
  const nk = [];
  wp.forEach((p, k) => { if(VOWEL.has(p) && !TAIL.has(p)) nk.push(k); });
  const si = STRESS_AT[w] !== undefined ? STRESS_AT[w] : (LEX[w] ? undefined : stressIndex(w, nk.length));
  if(si !== undefined && nk[si] !== undefined){
    phones.sIdx = phones.sIdx || new Set();
    phones.sIdx.add(base + nk[si]);
  }
}
/* Words run together. English does not stop between them, so nothing is inserted there but a
   junction: a very short break, wide and weak, that lets one word's gesture finish releasing into
   the next. The long breaks belong to punctuation. */
const JUNCT = {word:'gap', clause:'clause', stop:'pause'};
const BREAK = new Set(['gap', 'clause', 'pause']);
function joinAt(phones, kind){
  const j = JUNCT[kind] || kind;
  const last = phones.length ? phones[phones.length - 1] : null;
  if(last && last !== j && !BREAK.has(last)) phones.push(j);
}
function pushPhrase(phones, phrase){
  phrase.split(/\s+/).filter(Boolean).forEach(w => { joinAt(phones, 'word'); pushWord(phones, w); });
}

/* 'th' is voiceless by default. It is voiced in the function words that are always /dh/ and between
   two vowels (mother, other), so 'think', 'thick' and 'teeth' keep their /th/ and 'the', 'this' do not. */
const DH_WORDS = new Set(['the','this','that','these','those','them','they','their','there','then','than','though','thus','other','mother','father','brother','another','whether','either','neither','without','within','with']);
function thVoiced(w, i){
  if(i === 0) return DH_WORDS.has(w);
  return isVowelChar(w[i - 1] || '') && isVowelChar(w[i + 2] || '');
}

const TENSE = {a:'ey', e:'iy', i:'ay', o:'ow', u:'uw', y:'ay'};
const LAX = {a:'ae', e:'eh', i:'ih', o:'aa', u:'ah', y:'iy'};
function isVowelChar(c){ return 'aeiouy'.includes(c); }

/* Letters to sounds: a small rule engine plus the lexicon above. Round 10 added what the first version did
   not have — doubled consonants collapse (correction, buddy, express are one r, one d, one s), the common
   suffixes (-tion -sion -ture -ous -ing -ly -ed -ness -ment), r-coloured vowels (ar or er ir ur), ough, wa-,
   al-, silent gh and mb, a voiced word-final s, and a stress guess (stressIndex) for the words whose
   stress is not on the first syllable. The rest is the lexicon: a rule engine is never right for English,
   and the common words are the ones that are heard most. */
const SUFFIXES = [
  [/^(.+)ssion$/, () => ['sh','ax','n']],
  [/^(.+)tion$/, () => ['sh','ax','n']],
  [/^(.+)sion$/, st => isVowelChar(st[st.length - 1]) ? ['zh','ax','n'] : ['sh','ax','n']],
  [/^(.+)[ct]ian$/, () => ['sh','ax','n']],
  [/^(.+)[ct]ial$/, () => ['sh','ax','l']],
  [/^(.+)[ct]ious$/, () => ['sh','ax','s']],
  [/^(.+)ture$/, () => ['ch','er']],
  [/^(.{2,})ous$/, () => ['ax','s']],
  [/^(.{3,})ness$/, () => ['n','ax','s']],
  [/^(.{3,})less$/, () => ['l','ax','s']],
  [/^(.{3,})ment$/, () => ['m','ax','n','t']],
  [/^(.{3,})ful$/, () => ['f','ax','l']],
  [/^(.{3,})ly$/, () => ['l','iy']],
  [/^(.{3,})ing$/, () => ['ih','ng']],
  [/^(.{3,}[^aeiou])ed$/, st => /[td]$/.test(st) ? ['ih','d'] : /[pkfsx]$|sh$|ch$|th$/.test(st) ? ['t'] : ['d']]
];
const R_COLOUR = {ar:['aa','r'], or:['ao','r'], er:['er'], ir:['er'], ur:['er'], ear:['ih','r'], air:['eh','r']};
function letterPhones(word){
  let w = word;
  let magic = false;
  if(/[aeiouy][^aeiouy]e$/.test(w) || /[aeiouy][^aeiouy][^aeiouy]e$/.test(w)){
    magic = true;
    w = w.slice(0, -1);
  }
  const out = [];
  let i = 0, vowelSeen = false;
  const lastIdx = () => out.length;
  while(i < w.length){
    const tri = w.slice(i, i + 3), di = w.slice(i, i + 2), ch = w[i], nx = w[i + 1] || '', prev = w[i - 1] || '';
    const take = (ph, n) => { ph.forEach(p => out.push(p)); i += n; };
    const vtake = (ph, n) => { take(ph, n); vowelSeen = true; };
    if(w.startsWith('ough', i)){ vtake([w[i + 4] === 't' ? 'ao' : 'ow'], 4); continue; }   // thought, though
    if(tri === 'tch'){ take(['ch'], 3); continue; }
    if(tri === 'igh'){ vtake(['ay','ay2'], 3); continue; }
    if(tri === 'dge'){ take(['jh'], 3); continue; }
    if(tri === 'sch'){ take(['s', 'k'], 3); continue; }
    if(di === 'ee' || di === 'ea' || di === 'ie'){ vtake(['iy'], 2); continue; }
    if((di === 'ue' || di === 'ew') && i + 2 === w.length){ vtake(['uw'], 2); continue; }
    if(di === 'oo'){ vtake(['uw'], 2); continue; }
    if(di === 'oi' || di === 'oy'){ vtake(['oy','oy2'], 2); continue; }
    if(di === 'ou'){ vtake(['aw','aw2'], 2); continue; }
    if(di === 'oa'){ vtake(['ow'], 2); continue; }
    if(di === 'ow'){ vtake(['ow'], 2); continue; }
    if(di === 'ai' || di === 'ay' || di === 'ei'){ vtake(['ey'], 2); continue; }
    if(di === 'au' || di === 'aw'){ vtake(['ao'], 2); continue; }
    if(tri === 'all' || (di === 'al' && (w[i + 2] === 'k' || w[i + 2] === 't'))){ vtake(['ao','l'], tri === 'all' ? 3 : 2); continue; }
    if(tri === 'ear'){ vtake(['ih','r'], 3); continue; }
    if(tri === 'air'){ vtake(['eh','r'], 3); continue; }
    if(R_COLOUR[di] && !magic){ vtake(R_COLOUR[di], 2); continue; }
    if(di === 'ph'){ take(['f'], 2); continue; }
    if(di === 'sh'){ take(['sh'], 2); continue; }
    if(di === 'ch'){ take(['ch'], 2); continue; }
    if(di === 'th'){ take([thVoiced(w, i) ? 'dh' : 'th'], 2); continue; }
    if(di === 'wh'){ take(['w'], 2); continue; }
    if(di === 'gh'){ if(i === 0) take(['g'], 2); else i += 2; continue; }   // night, high: silent
    if(di === 'mb' && i + 2 === w.length){ take(['m'], 2); continue; }       // lamb, climb
    if(di === 'ng'){ take(['ng'], 2); continue; }
    if(di === 'nk'){ take(['ng', 'k'], 2); continue; }
    if(di === 'ck'){ take(['k'], 2); continue; }
    if(di === 'qu'){ take(['k','w'], 2); continue; }
    if(di === 'wr' || di === 'kn'){ take([di[1]], 2); continue; }
    if(ch === 'c'){
      if(nx === 'c'){ const soft = 'eiy'.includes(w[i + 2] || ''); take(soft ? ['k', 's'] : ['k'], 2); continue; }   // success / account
      take([nx && 'eiy'.includes(nx) ? 's' : 'k'], 1); continue;
    }
    if(ch === 'g'){
      if(nx === 'g'){ take(['g'], 2); continue; }
      take([nx && 'eiy'.includes(nx) ? 'jh' : 'g'], 1); continue;
    }
    if(ch === 'x'){ take(['k','s'], 1); continue; }
    if(ch === 'q'){ take(['k'], 1); continue; }
    if(ch === 'y' && i === 0 && isVowelChar(nx)){ take(['y'], 1); continue; }   // yes, you: a consonant
    if(ch === 'y' && !vowelSeen && i === w.length - 1 && i > 0){ vtake(['ay','ay2'], 1); continue; }   // my, by, try
    if(isVowelChar(ch)){
      // open syllable: a first 'a' before one consonant and a final y, er, or ie (baby, paper, navy) is tense
      const tense = (magic && !vowelSeen) || (ch === 'a' && !vowelSeen && i > 0 && /^a[bdfgklmnpstvz](y|er|ie)$/.test(w.slice(i)));
      // wa-: want, wash, watch; a vowel before a final r after a magic e (care, more)
      if(ch === 'a' && prev === 'w' && nx !== 'r'){ vtake([/^a(sh|tch)/.test(w.slice(i)) ? 'ao' : 'aa'], 1); continue; }
      if(magic && nx === 'r' && !vowelSeen){ if(ch === 'a'){ vtake(['eh'], 1); continue; } if(ch === 'o'){ vtake(['ao'], 1); continue; } }
      const table = tense ? TENSE : LAX;
      const ph = table[ch] || 'ax';
      if(ph === 'ay') vtake(['ay','ay2'], 1);
      else vtake([ph], 1);
      continue;
    }
    if('bcdfghjklmnpqrstvwxyz'.includes(ch)){
      const map = {b:'b', d:'d', f:'f', h:'hh', j:'jh', k:'k', l:'l', m:'m', n:'n', p:'p', r:'r', s:'s', t:'t', v:'v', w:'w', z:'z'};
      // a doubled consonant is one sound (buddy, correction, express)
      const dbl = nx === ch && 'bdfgklmnprstvz'.includes(ch);
      if(ch === 's' && i === w.length - 1 && i > 1 && prev !== 's' && !/(us|is|as|os)$/.test(w) && /[aeioubdglmnrvz]$/.test(prev)){ take(['z'], 1); continue; }   // dogs, buddies
      if(ch === 's' && !dbl && isVowelChar(prev) && isVowelChar(nx) && i > 0){ take(['z'], 1); continue; }   // rose, easy, music
      if(map[ch]) take([map[ch]], dbl ? 2 : 1);
      else i++;
      continue;
    }
    i++;
  }
  return out;
}
/* Which vowel of the word carries the stress, as an index among its nuclei: the syllable before a
   -tion/-sion/-ic ending, the second syllable after an unstressed prefix, otherwise the first. */
const PREFIX2 = /^(ex|de|re|be|cor|com|per|ad|ab)[^aeiouy]/;
function stressIndex(word, nuclei){
  if(nuclei < 2) return undefined;
  if(/(tion|sion|ssion|cian|tian|ial|ic|ics)$/.test(word)) return nuclei - 2;
  if(/(ity|ify|ical)$/.test(word) && nuclei >= 3) return nuclei - 3;
  if(PREFIX2.test(word) && word.length > 4) return 1;
  return undefined;
}
function wordPhones(word){
  if(LEX[word]) return LEX[word].flatMap(phoneOf);
  let w = word.replace(/'s$/, '');
  const plural = word.endsWith("'s") ? ['z'] : [];
  if(LEX[w]) return LEX[w].flatMap(phoneOf).concat(plural);
  let out = null;
  for(const [re, tail] of SUFFIXES){
    const m = re.exec(w);
    if(m && /[aeiouy]/.test(m[1])){
      const stem = m[1];
      if(LEX[stem]) out = LEX[stem].flatMap(phoneOf).concat(tail(stem));
      else out = letterPhones(stem).concat(tail(stem));
      break;
    }
  }
  if(!out) out = letterPhones(w);
  if(!out.length) out.push('ax');
  return out.concat(plural);
}

function textToPhones(raw){
  const phones = [];
  const re = /[A-Z]{2,}|\d+\.\d+|\d+|[A-Za-z']+|[.,!?;:&@#$%+=]/g;
  const tokens = String(raw).match(re) || [];
  for(const tok of tokens){
    if(tok === ',' || tok === ';' || tok === ':'){ joinAt(phones, 'clause'); continue; }
    if(tok === '.' || tok === '!' || tok === '?'){ joinAt(phones, 'stop'); continue; }
    if(GLYPH[tok]){ pushPhrase(phones, GLYPH[tok]); continue; }
    if(/^\d+\.\d+$/.test(tok)){
      const [a, b] = tok.split('.');
      pushPhrase(phones, cardinal(+a) + ' point ' + b.split('').map(d => ONES[+d]).join(' '));
      continue;
    }
    if(/^\d+$/.test(tok)){ pushPhrase(phones, cardinal(+tok)); continue; }
    if(/^[A-Z]{2,}$/.test(tok)){
      tok.split('').forEach(ch => pushPhrase(phones, ch.toLowerCase()));
      continue;
    }
    pushPhrase(phones, tok.toLowerCase().replace(/[^a-z']/g, ''));
  }
  let drop = 0;
  while(phones.length && BREAK.has(phones[0])){ phones.shift(); drop++; }
  while(phones.length && BREAK.has(phones[phones.length - 1])) phones.pop();
  if(phones.sIdx) phones.sIdx = new Set([...phones.sIdx].map(k => k - drop).filter(k => k >= 0));
  return phones.length ? phones : ['pause'];
}

/* Prosody. A word carries one stress: its first vowel, unless the word is one of the little
   function words, which reduce instead. Stress lengthens a vowel and opens it a shade; an
   unstressed vowel shortens and reduces toward the schwa's own small shape. The last segment of a
   phrase is lengthened, and the vowel before a break is lengthened more. That is what makes a
   string of phones read as words: the shapes are no longer equal in time or in size. */
/* 'to' and 'for' are left out on purpose: they share their phones with 'two' and 'four', which are
   stressed, and the phones do not say which word they came from. */
const REDUCED = new Set(['a','an','the','of','and','or','with','is','at','in','but','from','this','that','was','are']);
/* Reduction is a property of the word, and the phones do not carry their word, so the reduced
   function words are recognised by their phone sequence. */
const REDUCED_KEYS = new Set([...REDUCED].filter(w => LEX[w]).map(w => LEX[w].flatMap(phoneOf).join(' ')));
/* Tiers. stress: a content word's nucleus, longer and a shade larger. weak: an unstressed syllable or
   a function word, shorter and reduced to the schwa's own shape. cluster: a consonant between two
   consonants, compressed. final: the last segment before a break, lengthened. */
const STRESS = {
  stress:  {dur:1.3,  art:1.1},
  weak:    {dur:.72,  art:.84},
  cluster: {dur:.8,   art:.95},
  final:   {dur:1.42, art:1.1},
  plain:   {dur:1,    art:1}
};
/* diphthong tails are glides of the nucleus before them, not a syllable of their own */
const TAIL = new Set(['ay2', 'aw2', 'oy2', 'ow2', 'ey2']);
const CHAT_STRESS = [1.3, .65];   // a chat vowel this many times its sentence's median length is stressed, at most this weak
const isBreak = p => p === 'gap' || p === 'pause' || p === 'clause';
function stressOf(phones){
  const out = new Array(phones.length).fill('plain');
  let i = 0;
  while(i < phones.length){
    if(isBreak(phones[i])){ i++; continue; }
    let j = i;
    while(j < phones.length && !isBreak(phones[j])) j++;
    const words = phones.slice(i, j);
    const nuc = [];
    for(let k = 0; k < words.length; k++) if(VOWEL.has(words[k]) && !TAIL.has(words[k])) nuc.push(i + k);
    if(nuc.length){
      /* a content word has one stress on its first syllable (a one-syllable content word is stressed);
         a function word's only vowel is weak; every later syllable of a longer word is weak */
      const reduced = REDUCED_KEYS.has(words.join(' '));
      const forced = phones.sIdx ? nuc.find(k => phones.sIdx.has(k)) : undefined;
      const first = forced !== undefined ? forced : nuc[0];
      out[first] = (nuc.length === 1 && reduced) ? 'weak' : 'stress';
      for(const k of nuc) if(k !== first) out[k] = 'weak';
      /* a tail goes with the nucleus it glides from */
      for(let k = i; k < j; k++) if(TAIL.has(phones[k]) && k > 0) out[k] = out[k - 1];
      /* a consonant with a consonant on each side is one of a cluster and is compressed */
      for(let k = i + 1; k < j - 1; k++){
        const cons = p => !VOWEL.has(p) && !TAIL.has(p) && !isBreak(p);
        if(cons(phones[k]) && cons(phones[k - 1]) && cons(phones[k + 1])) out[k] = 'cluster';
      }
    }
    i = j;
  }
  /* the phrase's own breath: the last segment before a break stretches, and so does the vowel before it */
  for(let k = 0; k < phones.length; k++){
    /* a word junction is a 'gap', not a phrase end: only punctuation ends a phrase */
    const phrasePunct = p => p === 'pause' || p === 'clause';
    const end = k === phones.length - 1 || phrasePunct(phones[k + 1]);
    if(!end || isBreak(phones[k])) continue;
    /* the phrase's last stressed syllable lengthens; a reduced syllable stays reduced */
    if(out[k] !== 'weak') out[k] = 'final';
    if(k > 0 && VOWEL.has(phones[k - 1]) && out[k - 1] !== 'weak') out[k - 1] = 'final';
  }
  return out;
}
/* An unstressed vowel is a schwa in shape as well as in time: the reduced syllable is pulled to the
   schwa's own lip and jaw, and only its length is its own. A tail keeps its glide. */
function specFor(name, pros){
  const base = PHONE[name] || PHONE.ax;
  if(pros === 'weak' && VOWEL.has(name) && !TAIL.has(name)){
    /* reduced in length and jaw, but not in lip shape: a weak /ow/ is still a round vowel and a weak /iy/ still a
       spread one (thoroughly, buddy), only less of it */
    const mus = Object.assign({}, PHONE.ax.mus);
    for(const k of ['orbOris', 'ris', 'bucc']) if(base.mus[k]) mus[k] = base.mus[k] * .7;
    return Object.assign({}, PHONE.ax, {dur:base.dur, mus});
  }
  return base;
}
function spans(phones){
  const pros = stressOf(phones);
  const out = [];
  let t = 0;
  for(let i = 0; i < phones.length; i++){
    const name = phones[i];
    const P = STRESS[pros[i]] || STRESS.plain;
    const spec = specFor(name, pros[i]);
    const dur = spec.dur * P.dur;
    out.push({name, t0:t, t1:t + dur, mid:t + dur / 2, spec, pros:pros[i], art:P.art});
    t += dur;
  }
  return out;
}
/* Coarticulation is not rate-free. At the reading rate a phone lasts about half a second and its
   dominance reaches as far as it should; read three times faster, the same dominance in phone time
   passes three times quicker and each target is present too briefly for the springs to arrive, so
   the mouth clamps shut between the sounds. The decay is therefore scaled with the rate, which
   gives the phones roughly the same reach in wall time however fast they are read — the same
   anticipation a speaker makes when they hurry. */
let RATEC = 1, RATEC_SHAPE = 1, RATEC_JAW = 1;   // RATEC_SHAPE: the lip shape's own (rounding is anticipated several sounds ahead)
/* A vowel has a lip shape of its own, so it CLAIMS the lip-shape channels (round, spread, cheek) even when it
   lists none of them: an unrounded vowel unrounds, a rounded one is not spread. Left at the quarter weight
   an unlisted channel gets, the rounding of /r sh w er ow/ stayed on through the vowels that followed
   (the pucker read 0.5-1.0 on /iy/ and /aa/ in a fast phrase), and every shape was the same pursed mouth.
   The contacts are the same: a vowel's position is "no press, no tuck, the tongue inside" (speechClaims says so
   for the claim), so a vowel claims lipPress, lipTuck and tongueOut at none. At the quarter weight a /b/'s press
   (alpha 1.3) still held .3 at the centre of the vowel after it at Piper's pace, and kept "Bob" 70% shut. */
const SHAPE_CH = new Set(['orbOris', 'ris', 'bucc', 'lipPress', 'lipTuck', 'tongueOut']);
function claimsChannel(spec, name, k){
  if(Object.prototype.hasOwnProperty.call(spec.mus, k)) return true;
  return SHAPE_CH.has(k) && VOWEL.has(name);
}
/* Coarticulatory resistance (Bladon & Al-Bamerni 1976; Recasens' DAC model): how hard a sound holds an articulator
   against its neighbours, per channel. A sound holds the articulators that make it and gives the others to the
   sounds round it, so a consonant is heard into the vowel it leads to: "sue" is a rounded /s/, "tea" a spread /t/,
   "boo" a /b/ with the lips pressed and pushed forward. The lingual consonants give their lip shape away (an /s/'s
   spread is a default, not its cue); the rounded consonants hold their rounding (it is what /r w sh/ look like); the
   contacts hold the contact and give the lip shape away. Multiplies the claimed weight of the channel's group. */
const LIP_SHAPE = new Set(['orbOris', 'ris', 'bucc']);
const RESIST = {
  s:{shape:.45}, z:{shape:.45}, t:{shape:.2}, d:{shape:.2}, n:{shape:.2}, l:{shape:.25}, th:{shape:.25}, dh:{shape:.25},
  k:{shape:.15}, g:{shape:.15}, ng:{shape:.15}, y:{shape:.6},
  p:{shape:.2}, b:{shape:.2}, m:{shape:.2}, f:{shape:.06}, v:{shape:.06},
  r:{shape:1.8}, w:{shape:1.3}, sh:{shape:1.4}, zh:{shape:1.4}, ch:{shape:1.3}, jh:{shape:1.3},
  /* the spread vowels hold their spread the way /r w/ hold their rounding: "we want" kept /iy/ at .8 of a pucker
     between its two /w/s, and "wet" its /eh/ at .75; the open nucleus of /aɪ/ holds off rounding (/aʊ/'s did, and with
     it held off its own glide's: "around" ended unrounded, .35, owner: "no o'ing") */
  iy:{shape:1.7}, ih:{shape:1.4}, ey:{shape:1.5}, ey2:{shape:1.5}, eh:{shape:1.3}, ae:{shape:1.3}, ay2:{shape:1.4}, oy2:{shape:1.4}, ay:{shape:1.5}, aw2:{shape:1.6}, ow2:{shape:1.6}
};
/* The jaw is the syllable's carrier: it opens for each vowel and the tongue makes /t d n l k g r/ on whatever it is
   doing, so those hold it lightly. /s z sh/ need it up for the slit and the contacts need it for the closure, so
   they keep their hold. At Piper's pace the vowels peaked at 24 px of light between the lips and the consonants at
   19: the syllables hardly showed. /t d n/ were .45 until 2026-10-14: at Piper's pace their jaw stayed 17-24 px open, and
   the tongue's gesture showed in an open mouth instead of the teeth coming together (owner: "tongue action"). /eɪ/'s
   nucleus holds the jaw harder than a vowel's 1: between the /d g t s/ round it ("day", "gray", "chased") it opened the
   teeth 12.3 px on the board's sentences, 14.0 held so, and its glide closes them 6.3 (the 52 px of 2026-10-19 gave 14.5
   and 5.5, and put it above /eh/ against the vowels' order). /aɪ aʊ ɔɪ/'s open nuclei hold it the same: the 57 ms
   /a/ of "around" between its /r/ and its glide drew a jaw of .079 against its own .31 (now .10). */
const JAW_RESIST = {t:.75, d:.75, n:.75, l:.45, k:.75, g:.75, ng:.35, r:.55, y:.6, hh:.5, er:.8, ey:1.4, ay:1.4, aw:1.4, oy:1.4, ow:1.4};
function resistOf(name, k){
  if(k === 'jaw') return JAW_RESIST[name] ?? 1;
  const r = RESIST[name]; return r && LIP_SHAPE.has(k) && r.shape != null ? r.shape : 1;
}
function channelWeight(spec, dtSec, claimed, name, k){
  const d = DOM[spec.dom] || DOM.mid, P = SPEECH.p;
  const rate = dtSec < 0 ? d.theta * P.antic : d.phi * P.carry;
  const alpha = (claimed ? d.alpha * (name ? resistOf(name, k) : 1) : d.alpha * P.unclaimed * (name && LIP_SHAPE.has(k) && RESIST[name] && RESIST[name].shape < 1 ? RESIST[name].shape : 1));
  return alpha * Math.exp(-rate * (k === 'jaw' ? RATEC_JAW : k && LIP_SHAPE.has(k) ? RATEC_SHAPE : RATEC) * Math.pow(Math.abs(dtSec), d.c));
}
/* Normalised Cohen–Massaro blend, one denominator per channel. Jaw is always claimed.
   A muscle the segment does not list is target 0 at UNCLAIMED weight, so it tugs
   toward rest without vetoing a neighbour that does claim it. */
function blendAt(phones, ms, all, win){
  const segs = all || spans(phones);
  const total = segs.length ? segs[segs.length - 1].t1 : 0;
  if(!segs.length || ms >= total) return {shape:{jaw:0, mus:{}}, label:'', next:'', done:true, parts:[]};
  let idx = segs.findIndex(s => ms < s.t1);
  if(idx < 0) idx = segs.length - 1;
  // playback passes the cached spans and a window: a phone more than a few places away has no weight left
  const near = win == null ? segs : segs.slice(Math.max(0, idx - win), idx + win + 1);
  const keys = new Set();
  for(const s of near) for(const k of Object.keys(s.spec.mus)) keys.add(k);
  let jawW = 0, jaw = 0;
  const acc = {}, den = {}, parts = [];
  for(const k of keys){ acc[k] = 0; den[k] = 0; }
  for(const s of near){
    const dt = (ms - s.mid) / 1000;
    const wJaw = channelWeight(s.spec, dt, true, s.name, 'jaw');
    parts.push({name:s.name, w:wJaw});
    jawW += wJaw;
    jaw += wJaw * (s.spec.jaw || 0);
    for(const k of keys){
      const claimed = claimsChannel(s.spec, s.name, k);
      const w = channelWeight(s.spec, dt, claimed, s.name, k);
      den[k] += w;
      if(claimed) acc[k] += w * (s.spec.mus[k] || 0);
    }
  }
  const mus = {};
  if(jawW > 0) jaw /= jawW;
  for(const k of keys){
    const v = den[k] > 0 ? acc[k] / den[k] : 0;
    if(v > 1e-4) mus[k] = v;
  }
  return {shape:{jaw, mus}, label:segs[idx].name, next:segs[idx + 1] ? segs[idx + 1].name : '', done:false, parts};
}
/* Playback controls. rate scales time (1 is the table's own, slow and readable; about 2.5 is
   natural conversation at 12 phones a second) and can change mid-utterance. art exaggerates the
   shapes: it scales the jaw and the lip-shaping muscles (spread, round, levators, depressors) and
   leaves the contact and tongue channels (press, tuck, tongue) alone, which are already at their
   limit and would only come late, and every channel is held to a muscle's full pull. */
/* The parameters under the phoneme dynamics, all live (the panel under the Say box writes here). Defaults
   are the shipped behaviour. claim 0 is the old additive speech; the rest shape how a phone takes the mouth.
     claim     how fully a phone takes the articulators it controls from the base face (0 none … 1 full)
     lead tail  ms the claim takes to rise ahead of the first phone and to let go after the last
     cJaw cLips cRound cPress cTuck cWidth   per-articulator multipliers on that claim
     antic carry   multipliers on how far ahead a phone reaches (anticipation) and how far it lingers
     unclaimed   the weight a phone gives an articulator it does not list (a pull toward rest)
     speed     multiplier on the pace of speech's own motion (speechMotion)
     soft      closure softness: the lipPress range over which the lips come together (low is a snap)
     tuckY     how far under the upper teeth's edge the tucked lip settles, px
     accent    how much the brows, eyes and head move with the stressed words
     cheek     how far the cheeks follow the lips and jaw (the malar, buccal and jaw-carried cheek pads) and the lower lids the cheeks
     affect    how much the face's feeling shapes the speech: what an accent does to the brows and eyes, how large the speaker articulates */
const SPEECH_DEFAULTS = {claim:1, lead:140, tail:250, cJaw:1, cLips:1, cRound:.8, cPress:1, cTuck:1, cWidth:.6,
  antic:1, carry:1, unclaimed:.25, speed:1, soft:.52, tuckY:4, accent:1, cheek:1, affect:1};
/* Articulation scales the jaw and the lip channels (ARTIC) of a phone's HELD shape. That shape is fixed in pixels by the
   phone table (the lab's apertures), so anything above 1 opens n, l, jh and y past their rules: at 1.2 the lab fails
   four phones. The exaggeration the lower lip and the underbite need belongs in the motion (the overshoot and the
   excursion from rest), not in the held aperture. Until that exists the default stays at 1. */
const SPEECH_ART_DEFAULT = 1;
const SPEECH = {rate:1, art:SPEECH_ART_DEFAULT, p:Object.assign({}, SPEECH_DEFAULTS)};
/* What each parameter is, for the panel: [key, label, min, max, step, hint]. */
const SPEECH_PARAMS = [
  ['claim', 'positions', 0, 1, .05, 'how fully a phone takes the mouth from the face under it (0 = the old additive speech)'],
  ['lead', 'take over', 20, 400, 10, 'ms the claim rises ahead of the first sound'],
  ['tail', 'let go', 20, 500, 10, 'ms the base face takes the mouth back after the last sound'],
  ['cJaw', 'jaw', 0, 1.2, .05, 'the jaw: how far the base face\'s jaw is overruled'],
  ['cLips', 'lip height', 0, 1.2, .05, 'upper and lower lip positions'],
  ['cPress', 'press', 0, 1.2, .05, 'lip press (bilabial closure)'],
  ['cTuck', 'tuck', 0, 1.2, .05, 'lower lip onto the upper teeth (f v)'],
  ['cRound', 'round', 0, 1.2, .05, 'pucker (w uw ow r)'],
  ['cWidth', 'spread', 0, 1.2, .05, 'lip spread (s iy)'],
  ['antic', 'anticipation', .3, 2.5, .05, 'how far ahead a sound reaches (x theta)'],
  ['carry', 'carryover', .3, 2.5, .05, 'how far a sound lingers (x phi)'],
  ['unclaimed', 'unlisted pull', 0, .8, .05, 'weight pulling a muscle a phone does not list toward rest'],
  ['speed', 'speed', .5, 2.5, .05, 'how quickly the mouth moves between shapes while speaking: lower is slower and smoother'],
  ['soft', 'closure', .2, 1.2, .02, 'closure softness: low is a snap, high is a slow press'],
  ['tuckY', 'tuck depth', 0, 10, .5, 'px the tucked lip settles under the incisal edge'],
  ['accent', 'accents', 0, 2.5, .05, 'how much the brows, eyes and head move with the stressed words (K-E-V sets it with the feeling)'],
  ['cheek', 'cheeks', 0, 2.5, .05, 'how far the cheeks follow the lips and the jaw, and the lower lids follow the cheeks (0 = the cheeks stand still)'],
  ['affect', 'feeling in speech', 0, 2.5, .05, 'how much the face\'s feeling shapes the speech: a happy speaker spreads and keeps the cheeks up, a sad one articulates smaller and lifts the inner brows, an angry one lowers the brows on an accent']];
function speechApplyParams(){
  const P = SPEECH.p;
  if(typeof MOUTH !== 'undefined'){ MOUTH.PRESS = [.08, .08 + P.soft]; MOUTH.TUCKY = P.tuckY; }
}
/* Articulators move faster in faster speech: peak velocity grows with rate. While speech is on, the
   muscle springs and the jaw follower run at the square root of the rate (never slower than their
   own rest rate). A 70ms phone at rate 3 is then 1.7 times as long for the lips to arrive, which is
   the one thing a small target at the top of the slider was missing. */
function speechSpringScale(){ return Math.max(1, Math.sqrt(SPEECH.rate)) * SPEECH.p.speed; }
const ARTIC = new Set(['ris', 'bucc', 'orbOris', 'dli', 'ulr']);
const VOWEL = new Set(['iy','ih','ey','ey2','eh','ae','aa','ao','ow','ow2','ah','ax','er','uw','uh','ay','ay2','aw','aw2','oy','oy2']);
/* The shape at a moment is the blend's own, per channel: every segment's target weighted by its
   own dominance, so anticipation and carryover act on every phone at once and a consonant is
   shaped by the sounds on both sides of it rather than by a rule laid over the top. Nothing
   overrides a neighbour, and no consonant inherits a word's vowel shape. What the blend cannot
   know is stress, so a stressed segment opens a little further and a reduced one less; that is
   the whole of prosody's effect on shape, and it is what lets a word read as one gesture. */
/* Contact resistance (Cosi et al. 2002; Cohen-Massaro's normalised blend undershoots a closure). A contact has to
   be made: the lips shut for /p b m/, the lower lip on the teeth for /f v/, the tongue between the teeth for /th dh/.
   Normalised against the vowels on either side, a contact of Piper's length (23-60 ms) got about half the weight
   on its own channels, and /f v/ never tucked. So over its hold a contact owns the channels it lists and the jaw:
   the blend is drawn to the contact's own target over a hold round its centre, with CONTACT_EDGE ms edges. The hold
   is the segment's own length, at least CONTACT_HOLD for its class and at most CONTACT_MAX. A bilabial's segment is
   its closure (the silence), so it needs nothing more; the lips stay on the teeth for /f v/ longer than the
   frication Piper times (23-35 ms). Held longer, two /b/s round a vowel left it no time to open ("Bob"). A dental
   holds 50 (70 until 2026-10-20: the 23 ms /dh/ of "around the" held its tip out over the /d/ before it). */
const CONTACT_HOLD = {bilab:40, labdent:70, dental:50}, CONTACT_MAX = 90;
let CONTACT_EDGE = 20, CONTACT_EDGE_OF = {bilab:30};
/* Where a sound's hold may reach: round its centre by half the hold, and never past the centre of the sound either
   side of it (breaks are looked past), less the hold's edge, so its weight there is 0. At Piper's pace a 23 ms /r/ held
   its rounding over 90 ms and its jaw over 50, both past the centre of the /aʊ/ after it, and "around" never opened
   (jaw .065 of the vowel's .3, rounded .46 at its centre); the 23 ms /dh/ of "the" held the tongue forward over 70 ms,
   back across the /d n/ of "around" (owner, 2026-10-20: "the tongue sticks out like a th"). */
function holdSpan(segs, i, hold, edge, roundOnly){
  const s = segs[i], half = Math.max(hold, s.t1 - s.t0) / 2;
  let a = s.mid - half, b = s.mid + half;
  const stop = q => VOWEL.has(q.name) && (!roundOnly || (q.spec.mus.orbOris || 0) >= .3);
  for(let j = i - 1; j >= 0; j--) if(!isBreak(segs[j].name)){ if(stop(segs[j])) a = Math.max(a, segs[j].mid + edge); break; }
  for(let j = i + 1; j < segs.length; j++) if(!isBreak(segs[j].name)){ if(stop(segs[j])) b = Math.min(b, segs[j].mid - edge); break; }
  return [Math.min(a, s.mid), Math.max(b, s.mid)];
}
const spanDist = ([a, b], ms) => ms < a ? a - ms : ms > b ? ms - b : -1;
/* /r/ after a lip sound (/b p m f v/, a word junction looked past) is rounded further, R_AFTER_LIPS: the lips come off
   the closure into the /r/'s pucker. At its own .55 the /r/ of "bring", "brother" was no rounder than the /b/ before it
   (which rounds ahead for it), so the lips went straight from the release to the vowel (owner, 2026-10-20: "the br's
   aren't well articulated"). Everywhere, .7 widened "three" 14 px a frame into its /iy/. /r/'s jaw hold is 90 ms (50
   until 2026-10-20): in "brother" the jaw opened for the vowel through the 35 ms /r/, 28 px, where now 24. */
const R_AFTER_LIPS = .75, LIP_SOUNDS = new Set(['p', 'b', 'm', 'f', 'v']);
function afterLips(segs, i){
  for(let j = i - 1; j >= 0; j--) if(segs[j].name !== 'gap') return LIP_SOUNDS.has(segs[j].name);
  return false;
}
/* The rounded vowel a sound comes after in its word (the consonants between looked past), or null, and null when it
   comes before one: /t d n k g/ after one keep its lips, as a lingual
   consonant gives its lip shape away, so their lip hold holds the vowel's lower lip, not their own (peeled off the
   teeth). Their own, or none, the /n d/ after the /aʊ/ of "around" drew its glide's rounding into a /sh/'s flare,
   open on 8-13 px of lower teeth (owner, 2026-10-20: "no o'ing"). Before a rounded vowel their own hold stays: "do",
   "so" have to show their teeth before the lips close in (the lab's roundteethU). */
function besideRound(segs, i){
  for(let j = i + 1; j < segs.length && !isBreak(segs[j].name); j++) if(VOWEL.has(segs[j].name)){ if((segs[j].spec.mus.orbOris || 0) >= .3) return null; break; }
  for(let j = i - 1; j >= 0 && !isBreak(segs[j].name); j--) if(VOWEL.has(segs[j].name)) return (segs[j].spec.mus.orbOris || 0) >= .3 ? segs[j] : null;
  return null;
}
function contactAt(segs, ms, shape){
  let idx = segs.findIndex(s => ms < s.t1);
  if(idx < 0) idx = segs.length - 1;
  for(let i = Math.max(0, idx - 3), hi = Math.min(segs.length, idx + 4); i < hi; i++){
    const s = segs[i];
    const minHold = CONTACT_HOLD[s.spec.dom];
    if(minHold == null) continue;
    const edge = CONTACT_EDGE_OF[s.spec.dom] ?? CONTACT_EDGE;
    let [a, b] = holdSpan(segs, i, Math.min(CONTACT_MAX, Math.max(minHold, s.t1 - s.t0)), edge);
    /* two contacts of a kind with no vowel between them are one contact: "Bob brought" keeps its lips shut across the
       word gap instead of letting go for 70 ms and shutting again */
    for(let j = i + 1; j < segs.length && !VOWEL.has(segs[j].name); j++) if(segs[j].spec.dom === s.spec.dom){ b = Math.max(b, segs[j].mid); break; }
    for(let j = i - 1; j >= 0 && !VOWEL.has(segs[j].name); j--) if(segs[j].spec.dom === s.spec.dom){ a = Math.min(a, segs[j].mid); break; }
    const d = spanDist([a, b], ms);
    const r = d <= 0 ? 1 : d >= edge ? 0 : sm01(1 - d / edge);
    if(r <= 0) continue;
    for(const k in s.spec.mus){ const v = shape.mus[k] || 0; shape.mus[k] = v + (s.spec.mus[k] - v) * r; }
    shape.jaw = shape.jaw + ((s.spec.jaw || 0) - shape.jaw) * r;
  }
  /* /t d n/ bring the teeth together and /w/ the lips in: over JAW_HOLD ms round their centre the jaw is drawn JAW_HOLD_K
     of the way to their own, so a 23-35 ms /t/ between two vowels still closes the teeth rather than leaving its tongue
     in an open mouth (on the chat timelines /t d n/ opened 20.1 px on average, /w/ 22.5; now 15.9 and 15.3). Stronger,
     the vowels between them lose their reach (.85: .71 of their held opening). /r/ is held the same way, and its lips'
     heights with it (LIP_HOLD): without, its frames in the board's sentences opened 30 px on average and 34-43 next to
     /k g/ and the open vowels ("crate", "gray", "across", "large"), the tongue showing, where held it is a 15 px
     rounded slit with none (owner, 2026-10-19: the /r/ tongue "completely wrong"). With: 25 px, 26-32 after /aa/. /w/ too: with
     the wider /k/ and open vowels round it, its chat opening had grown to 18 px (rule 17); held, 12.5. /t d n k g/ hold
     their lips too, since their shape is now the lower lip peeled off the lower row (MOUTH_PEEL), which only a near-full
     depressor gives: without, the board's /k/ frames showed 6.7 px of lower row (held 38). Their edge is 60 ms (LIP_HOLD
     is the edge per sound, r and w keep 20): at 20 the lip was pulled on in a few frames and the opening's jerk rose
     1.53 to 1.65, and the lower row reached less (/k/ 12.4 px against 14.6). */
  for(let i = Math.max(0, idx - 3), hi = Math.min(segs.length, idx + 4); i < hi; i++){
    const s = segs[i], hold = JAW_HOLD[s.name];
    if(!hold) continue;
    const d = spanDist(holdSpan(segs, i, hold, CONTACT_EDGE), ms);
    const r = (d <= 0 ? 1 : d >= CONTACT_EDGE ? 0 : sm01(1 - d / CONTACT_EDGE)) * JAW_HOLD_K;
    if(r > 0) shape.jaw = shape.jaw + ((s.spec.jaw || 0) - shape.jaw) * r;
    const le = LIP_HOLD[s.name];
    if(!le) continue;
    const carry = le > CONTACT_EDGE ? besideRound(segs, i) : null, tgt = carry ? carry.spec.mus : s.spec.mus;
    /* the long, soft lip holds of /t d n k g/ are cut only at a rounded vowel: cut at every vowel, both sides of /eh/ in
       "dense", the lower lip dipped 2 px at its centre; uncut, the /d z/ round the /oʊ/ of "shadows" held its lips up
       and down off the teeth, and the rounding drew as a /sh/'s flare, open on the teeth, not an o (owner: "no o'ing") */
    const dl = spanDist(holdSpan(segs, i, hold, le, le > CONTACT_EDGE), ms);
    const rl = (dl <= 0 ? 1 : dl >= le ? 0 : sm01(1 - dl / le)) * JAW_HOLD_K;
    /* carried, the lower lip only, and all the way (a flare needs both lips lifted, so the lower lip held down keeps the o):
       the upper lip held at the vowel's rest leapt to a /sh/ after it ("old shoes", 6.2 px a frame) */
    if(rl > 0) for(const k of ['dli', 'ulr']){ const v = shape.mus[k] || 0, c = carry && k === 'dli'; shape.mus[k] = v + (((c ? tgt : s.spec.mus)[k] || 0) - v) * (c ? rl / JAW_HOLD_K : rl); }
  }
  /* A rounded consonant's rounding is its cue, the way a contact is: /r/ and /w/ hold their pucker over ROUND_HOLD ms
     round their centre. The rounding channel is the slowest and reads furthest ahead, and a 46 ms /r/ before /iy/
     ("read") was otherwise read straight past, to the spread vowel. */
  for(let i = Math.max(0, idx - 3), hi = Math.min(segs.length, idx + 4); i < hi; i++){
    const s = segs[i], hold = ROUND_HOLD[s.name];
    if(!hold) continue;
    const d = spanDist(holdSpan(segs, i, hold, CONTACT_EDGE), ms);
    const r = d <= 0 ? 1 : d >= CONTACT_EDGE ? 0 : sm01(1 - d / CONTACT_EDGE);
    if(d >= ROUND_SPREAD_EDGE) continue;
    const lab = s.name === 'r' && afterLips(segs, i);
    for(const k of ['orbOris', 'lipPress', 'ris', 'bucc']){   // /w/'s press is its small hole; no spread through the hold
      if(!(k in s.spec.mus) && k !== 'ris' && k !== 'bucc') continue;
      if(lab && k === 'orbOris'){ const v = shape.mus[k] || 0; shape.mus[k] = v + (Math.max(v, R_AFTER_LIPS) - v) * r; continue; }
      if(!s.spec.mus[k]){   // the spread held off, and let go over a wider edge: at the hold's own edge /r iy/ in "three" widened 14 px in a frame
        const rs = d <= 0 ? 1 : d >= ROUND_SPREAD_EDGE ? 0 : sm01(1 - d / ROUND_SPREAD_EDGE);
        shape.mus[k] = (shape.mus[k] || 0) * (1 - ROUND_HOLD_SPREAD * rs); continue;
      }
      const v = shape.mus[k] || 0, tg = Math.max(v, s.spec.mus[k]);
      shape.mus[k] = v + (tg - v) * r;
    }
  }
  return shape;
}
const ROUND_HOLD = {r:90, w:80, sh:80, zh:70, ch:70, jh:70}, ROUND_HOLD_SPREAD = .6, ROUND_SPREAD_EDGE = 140;   // the spread taken off is given back over 140 ms: let go at the hold's edge, "three" widened 15 px a frame, so the hold had been cut to .2 and "green" lost its /r/
let JAW_HOLD = {t:50, d:50, n:50, w:60, s:55, z:55, k:50, g:50, r:90}, JAW_HOLD_K = .7, LIP_HOLD = {r:20, w:20, t:60, d:60, n:60, k:60, g:60};
function speechShape(phones, ms, segs){
  const at = blendAt(phones, ms, segs, 9);
  if(at.done) return at;
  if(segs) contactAt(segs, ms, at.shape);
  const all = segs || spans(phones);
  let i = all.findIndex(s => ms < s.t1);
  if(i < 0) i = all.length - 1;
  const k = all[i].art ?? 1;
  if(k === 1) return {shape:at.shape, label:at.label, next:at.next, done:false, parts:at.parts};
  const mus = {};
  for(const c in at.shape.mus) mus[c] = Math.min(1, at.shape.mus[c] * (ARTIC.has(c) ? k : 1));
  return {shape:{jaw:Math.min(.6, (at.shape.jaw || 0) * k), mus}, label:at.label, next:at.next, done:false, parts:at.parts};
}
function shapePlayed(shape){
  const art = SPEECH.art, A = AFF_NOW, aj = art * A.jaw, al = art * A.lip, mus = {};
  /* the spread and the pucker are never made greater by the feeling's gain, only less (a mouth stretched past a spread phone's own width, or a rounding carried further under an open jaw, folds the skin under its corner at a few percent more: the widest, /i/, is already there) */
  for(const k in shape.mus){
    const v = shape.mus[k];
    if(!ARTIC.has(k)){ mus[k] = Math.min(1, v); continue; }
    const g = k === 'ris' || k === 'bucc' || k === 'orbOris' ? Math.min(art, al) : al;
    /* a gain above 1 does not carry a lip channel past AFF_CEIL (or past the phone's own value, if that is higher): the lower
       lip's peel grows as the square of the depressor past .55 (8 px more between .87 and .99), and that turned the skin
       under the corner inside out on a wide-eyed speaker's open vowel (12 px² of fold) */
    mus[k] = Math.min(1, g > 1 && k in AFF_CEIL ? Math.min(v * g, Math.max(v, AFF_CEIL[k])) : v * g);
  }
  /* a speaker who is happy keeps the lips a little spread through the vowels and the consonants that are not spread already (not on a pucker) */
  if(A.spread > 0){ const r = mus.ris || 0; mus.ris = Math.min(1, r + A.spread * (1 - Math.min(1, mus.orbOris || 0)) * Math.max(0, 1 - r / .5)); }   // not past a spread phone's own: a /i/ held by a smile is the widest mouth there is (laughing, 4 px² and 18 px² of folded skin at the corner)
  /* and one who bares the teeth keeps the lips off them, except while they close (a closure is a press, and shuts the lips) */
  if(A.bare > 0){
    const free = (1 - Math.min(1, (mus.lipPress || 0) / .5)) * (1 - Math.min(1, mus.orbOris || 0));
    mus.ulr = Math.min(1, Math.min((mus.ulr || 0) + A.bare * free, Math.max(mus.ulr || 0, AFF_CEIL.ulr)));
    mus.dli = Math.min(1, Math.min((mus.dli || 0) + .6 * A.bare * free, Math.max(mus.dli || 0, AFF_CEIL.dli)));
  }
  const jw = shape.jaw || 0;
  return {jaw:aj > art ? Math.min(jw * aj, Math.max(jw * art, AFF_CEIL.jaw)) : jw * aj, mus};   // the same ceiling for a jaw opened wider by the feeling: /a/ already opens to .41
}
function utteranceMs(phones){
  return phones.reduce((s, p) => s + (PHONE[p] || PHONE.ax).dur, 0);
}

function speakText(raw){
  if(typeof LIVE_FACES === 'undefined') return textToPhones(raw);
  const f = LIVE_FACES.find(x => x.el && x.el.closest('#fd-face')) || LIVE_FACES[0];
  if(!f) return;
  const phones = textToPhones(raw);
  const segs = spans(phones);
  f.speech = {phones, segs, total:segs.length ? segs[segs.length - 1].t1 : 0, ms:0, last:performance.now(), now:''};
  const box = document.getElementById('speech-phones');
  if(box) box.textContent = phones.join(' ');
  return phones;
}

/* How much of each articulator the speech has at this moment, 0…1. Speech owns the mouth for the whole of an
   utterance, not phone by phone: the claim rises over `lead` ms ahead of the first phone's centre, holds
   through the utterance, and lets go over `tail` ms after the last (the base face returns then, not between
   two sounds). The jaw, the lips' heights, the press and the tuck are claimed by every phone — a position is
   a position, and a vowel's is "no press, no tuck". The pucker and the spread are claimed only by phones that
   list them, the others lending `unclaimed` of their weight, so a smile's width survives an /s/: those two
   claims are the share of the weight that is real, from the same channel weights the blend uses. */
const sm01 = t => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
/* The share of the current weight that really claims the pucker and the spread (speechClaims' fpk, fwd). */
function speechShares(segs, ms, o){
  const win = 9;
  let idx = segs.findIndex(s => ms < s.t1);
  if(idx < 0) idx = segs.length - 1;
  let all = 0, pk = 0, wd = 0;
  for(let i = Math.max(0, idx - win), hi = Math.min(segs.length, idx + win + 1); i < hi; i++){
    const s = segs[i], dt = (ms - s.mid) / 1000;
    all += channelWeight(s.spec, dt, true);
    pk += channelWeight(s.spec, dt, claimsChannel(s.spec, s.name, 'orbOris') || s.spec.dom === 'bilab' || s.spec.dom === 'labdent');
    wd += channelWeight(s.spec, dt, claimsChannel(s.spec, s.name, 'ris') || claimsChannel(s.spec, s.name, 'bucc'));
  }
  o.fpk = all > 1e-6 ? pk / all : 0; o.fwd = all > 1e-6 ? wd / all : 0;
  return o;
}
function speechClaims(segs, ms, out){
  const P = SPEECH.p, win = 9;
  if(!segs.length){ out = out || {}; out.J = out.ru = out.rl = out.lp = out.tk = out.pk = out.wd = 0; return out; }
  const first = segs[0].mid, last = segs[segs.length - 1].mid;
  const env = sm01((ms - (first - P.lead)) / Math.max(1, P.lead)) * (1 - sm01((ms - last) / Math.max(1, P.tail)));
  let idx = segs.findIndex(s => ms < s.t1);
  if(idx < 0) idx = segs.length - 1;
  const lo = Math.max(0, idx - win), hi = Math.min(segs.length, idx + win + 1);
  let all = 0, pk = 0, wd = 0;
  for(let i = lo; i < hi; i++){
    const s = segs[i], dt = (ms - s.mid) / 1000, m = s.spec.mus;
    all += channelWeight(s.spec, dt, true);
    // a contact is not made with pursed lips: bilabials and labiodentals claim the pucker (at none) too
    pk += channelWeight(s.spec, dt, claimsChannel(s.spec, s.name, 'orbOris') || s.spec.dom === 'bilab' || s.spec.dom === 'labdent');
    wd += channelWeight(s.spec, dt, claimsChannel(s.spec, s.name, 'ris') || claimsChannel(s.spec, s.name, 'bucc'));
  }
  const fpk = all > 1e-6 ? pk / all : 0, fwd = all > 1e-6 ? wd / all : 0;
  const k = env * P.claim, o = out || {};
  o.J = Math.min(1, k * P.cJaw); o.ru = Math.min(1, k * P.cLips); o.rl = o.ru;
  o.lp = Math.min(1, k * P.cPress); o.tk = Math.min(1, k * P.cTuck);
  o.pk = Math.min(1, k * fpk * P.cRound); o.wd = Math.min(1, k * fwd * P.cWidth);
  return o;
}

/* The face under the speech, read for what it feels. Speech is not played on a blank: the muscles the base face holds
   (f.bActs, everything that is not speech, as the springs draw it: the emotion, the expression, a gesture's beat, a
   micro-movement, the pads) say what the speaker is feeling, and a speaker who feels something does not speak like one
   who does not. The reading is of the muscles and not of the emotion's name, so any source of a feeling counts, and
   it is 0 on a face at rest (the neutral speech the mouth lab holds is then exactly what it was). Each is 0…1:
     smile    the cheeks and corners drawn up (zygomaticus, levator anguli oris)
     cheek    the cheek raiser's share of it (orbicularis oculi with the smile)
     sad      the corners down and the inner brows up (depressor anguli oris, the inner brow raiser without the outer)
     ang      the brows drawn down and together, the nose wrinkled (corrugator, procerus, depressor supercilii)
     wide     the lids raised (levator palpebrae: surprise, fear, curiosity), without anger
     lax      the lids drooping (sleepy, bored)
     ener     the affect plane's arousal, -1…1 (f.affect[1]), the speaker's energy
     asym     which side of the face is the more lively for this utterance, ±UPPER_ASYM
   and from them the speaker's articulation, as gains on what the phones ask for (AFF_ART): jaw and lip (a gain on the
   jaw's opening and on the lips' shaping channels, ARTIC), spread (the lips held a little spread, for a smile) and bare (the
   upper lip held up and the lower down off the teeth: an angry speaker's teeth, and the snarl a disgusted or contemptuous
   face makes, which the claim took away with the rest of the base's upper-lip raise, a share of it kept here). */
const AFF_IDS = ['zyg', 'lao', 'orbOc', 'dao', 'frontIn', 'frontOut', 'corr', 'procerus', 'depSup', 'noseWr', 'levPalp', 'lidClose', 'ulr'];
const AFF_ZERO = Object.freeze({smile:0, cheek:0, sad:0, ang:0, wide:0, lax:0, ener:0, jaw:1, lip:1, spread:0, bare:0, asym:0});
let AFF_NOW = AFF_ZERO, AFF_IDX = null;
/* The resting face is not exactly nothing (the affect plane's origin blends the nearby emotions' tone: the lids' raiser
   .04, the nostrils a little), so a reading under AFF_DEAD is 0 and the rest above it rescaled, and the arousal likewise
   under AFF_DEAD_ENER: speech on a face that feels nothing is the speech the mouth lab holds, to the last digit. */
const AFF_DEAD = .12, AFF_DEAD_ENER = .15;
/* How the feeling scales the speaker's articulation, per unit of each reading (times the `affect` parameter):
   an energetic or wide-eyed speaker opens the jaw further, a sad or tired one less, an angry one speaks through a tighter
   jaw; the lips shape more for energy and a smile and less for sadness and tiredness; a smile holds the lips spread. */
const AFF_CEIL = {dli:.88, ulr:.8, jaw:.42};   // how far a feeling's gain may carry a lip channel (shapePlayed)
const AFF_ART = {jaw:{ener:.12, wide:.08, sad:-.1, lax:-.14, ang:-.12}, lip:{ener:.12, smile:.06, wide:.06, sad:-.1, lax:-.1, ang:.04}, spread:{smile:.16}, bare:{ang:.12, ulr:.35, max:.25}, min:.6, max:1.4};
function speechAffect(f, o){
  o = o || {};
  const B = f.bActs, P = SPEECH.p.affect ?? 1;
  if(!B || P <= 0){ Object.assign(o, AFF_ZERO); return o; }
  if(!AFF_IDX){ AFF_IDX = {}; for(const id of AFF_IDS) AFF_IDX[id] = ['L', 'R', 'C'].map(sd => MUSCLE_IDX[id + '.' + sd]).filter(n => n != null); }
  const a = id => { const ix = AFF_IDX[id]; let t = 0; for(let i = 0; i < ix.length; i++) t += B[ix[i]]; return ix.length ? Math.max(0, t / ix.length) : 0; };
  const c01 = v => v <= AFF_DEAD ? 0 : v >= 1 ? 1 : (v - AFF_DEAD) / (1 - AFF_DEAD);
  const zyg = a('zyg'), corr = a('corr'), proc = a('procerus'), fi = a('frontIn'), fo = a('frontOut');
  o.smile = c01(1.25 * zyg + .5 * a('lao'));
  o.cheek = c01(1.5 * a('orbOc') + .7 * zyg);
  o.sad = c01(.9 * a('dao') + Math.max(0, fi - .5 * fo - .4 * corr));
  o.ang = c01(1.2 * corr + .8 * proc + .5 * a('depSup') + .4 * a('noseWr'));
  o.lax = c01(1.3 * a('lidClose'));
  o.wide = c01(1.4 * a('levPalp')) * (1 - o.ang);
  const ev = f.affect ? Math.abs(f.affect[1]) : 0;   // the plane's own dead zone as well: the idle face's (.15, -.3) is not a calm speaker
  o.ener = ev <= AFF_DEAD_ENER ? 0 : Math.sign(f.affect[1]) * Math.min(1, (ev - AFF_DEAD_ENER) / (1 - AFF_DEAD_ENER));
  const G = AFF_ART, cl = v => Math.max(G.min, Math.min(G.max, v));
  o.jaw = cl(1 + P * (G.jaw.ener * o.ener + G.jaw.wide * o.wide + G.jaw.sad * o.sad + G.jaw.lax * o.lax + G.jaw.ang * o.ang));
  o.lip = cl(1 + P * (G.lip.ener * o.ener + G.lip.smile * o.smile + G.lip.wide * o.wide + G.lip.sad * o.sad + G.lip.lax * o.lax + G.lip.ang * o.ang));
  o.spread = P * G.spread.smile * o.smile;
  o.bare = Math.min(G.bare.max, P * (G.bare.ang * o.ang + G.bare.ulr * a('ulr')));
  const sp = f.speech;
  if(sp && sp !== f.sAsymOf){ f.sAsymOf = sp; f.sAsym = UPPER_ASYM * (2 * faceHash(Math.round((sp.total || 0) * 7) + (sp.segs ? sp.segs.length : 0)) - 1); }
  o.asym = f.sAsym || 0;
  return o;
}

/* The upper face in speech. The phone tables name the mouth only, so the brows, the eyes and the cheeks froze while
   the lips moved. What moves them in speech is not the sound being made but the accent: the brows lift with an
   accented syllable and settle after it, most at the first accent of a phrase, and the eye narrows a little with the
   effort, which lifts the cheek (orbOc is the cheek raiser). Piper sends no stress, but it lengthens a stressed
   vowel, so a vowel's length against the utterance's median vowel is the accent (the page's own spans add their
   stress grading). Each accent is a bump that rises UPPER.lead s ahead of the vowel's centre and falls over
   UPPER.fall s. The mouth corners (zyg, zygMin, dimp) are not used: a corner lift is a smile. */
const UPPER = {lift:.24, phrase:1.5, eye:.5, widen:.6, nod:1, lead:.12, fall:.3, max:.45};   // lift was .16 and the eye .4 of it: the eyes did not visibly take part
let UPPER_W = 0;   // the accent's weight at the last upperAt, for the head's nod (speechLife)
function upperAccents(segs){
  if(segs.upper) return segs.upper;
  const vow = segs.filter(s => VOWEL.has(s.name) && !TAIL.has(s.name)).map(s => s.t1 - s.t0).sort((a, b) => a - b);
  const med = vow.length ? vow[vow.length >> 1] : 1;
  const out = new Float32Array(segs.length); let fresh = true;
  segs.forEach((s, i) => {
    if(isBreak(s.name)){ if(s.name !== 'gap' && s.t1 - s.t0 > 150) fresh = true; return; }
    if(!VOWEL.has(s.name) || TAIL.has(s.name)) return;
    let a = Math.min(1, Math.max(0, ((s.t1 - s.t0) / med - 1.1) / .6));
    if(s.pros === 'stress' || s.pros === 'final') a = 1;
    if(a > .05){ out[i] = a * (fresh ? UPPER.phrase : 1); fresh = false; }
  });
  return segs.upper = out;
}
/* A phrase's first accent opens the eyes a little with the brows (the lids rise: attention, the start of a thought);
   the accents after it narrow them a touch instead (the cheek raiser: effort on the stressed word).
   What an accent does is the speaker's, and the speaker's feeling bends it (speechAffect; UPPER_AFF, times the `affect`
   parameter). The accent is one gesture, an effort on the word, and a face makes it in the direction it is already going:
     a smiling speaker squints into the cheek more (the cheek stays up) and lifts the outer brow;
     a sad one lifts the inner brows, not the outer, and does not open the eye;
     an angry one pulls the brows down and together instead of raising them, narrows the eye and flares the nostrils;
     a wide-eyed one (surprised, curious) opens the eye further;
     a tired one accents less and does not open the eye.
   All of it is 0 on a face at rest. */
const UPPER_AFF = {angKnit:.55, angLift:.9, angSquint:.6, angWrinkle:.3, sadInner:.7, sadOuter:.85, sadWiden:.9, laxAmp:.5, smileCheek:1, smileOuter:.3, wideGain:.6, flare:.45, flareEner:.15, nod:.4,
  fallSad:.4, fallLax:.3, fallAng:.3};   // how the feeling shapes the accent's own time: a sad or tired speaker's accent is drawn out, an angry one's short
/* No face is symmetric: one side takes a little more of each accent (brow, lid and cheek), the same side for the whole of
   an utterance and by chance from one utterance to the next (a hash of its length, so a replay is the same). */
const UPPER_ASYM = .12;
function upperAt(segs, ms, mus){
  UPPER_W = 0;
  if(!segs || !segs.length) return mus;
  const acc = upperAccents(segs);
  const A = AFF_NOW, P = SPEECH.p.affect ?? 1, U = UPPER_AFF;
  const fall = UPPER.fall * Math.max(.5, 1 + P * (U.fallSad * A.sad + U.fallLax * A.lax - U.fallAng * A.ang));
  let w = 0, wF = 0;
  for(let i = 0; i < segs.length; i++){
    if(!acc[i]) continue;
    const d = (ms - segs[i].mid) / 1000, k = d < 0 ? UPPER.lead : fall;
    if(Math.abs(d) > 3 * k) continue;
    const g = acc[i] * Math.exp(-(d / k) * (d / k));
    w = Math.max(w, g); if(acc[i] > 1) wF = Math.max(wF, g);
  }
  if(w < .01) return mus;
  const ac = SPEECH.p.accent ?? 1;
  UPPER_W = Math.min(1, w) * ac;
  const lift = Math.min(UPPER.max * ac, UPPER.lift * w * ac), widen = Math.min(UPPER.max * ac, UPPER.lift * wF * ac) * UPPER.widen;
  const squint = Math.max(0, lift - widen) * UPPER.eye;
  const ang = A.ang * P, sad = A.sad * P, smile = A.smile * P, wide = A.wide * P, lax = A.lax * P;
  const raise = Math.max(0, 1 - U.angLift * ang - U.laxAmp * lax);
  const inner = lift * raise * (1 + U.sadInner * sad), outer = lift * .8 * raise * (1 - U.sadOuter * sad) * (1 + U.smileOuter * smile);
  const open = widen * (1 - U.sadWiden * Math.max(sad, lax)) * (1 + U.wideGain * wide) * (1 - ang);
  const squ = squint * (1 + U.smileCheek * smile * (1 + A.cheek) / 2 + U.angSquint * ang) * (1 - .5 * lax);
  const knit = U.angKnit * ang * lift, flare = (U.flare * ang + U.flareEner * Math.max(0, A.ener) * P) * lift, wrinkle = U.angWrinkle * ang * lift;
  const as = A.asym;   // the lively side takes (1 + as) of an accent, the other (1 - as)
  for(const [k, v, sym] of [['frontIn', inner], ['frontOut', outer], ['levPalp', open], ['orbOc', squ], ['corr', knit], ['noseWr', wrinkle], ['nasal', flare, 1]]){
    if(!(v > 0)) continue;
    const cur = mus[k] || 0;
    if(sym) mus[k] = cur + v;
    else { const a = Array.isArray(cur) ? cur : [cur, cur]; mus[k] = [a[0] + v * (1 + as), a[1] + v * (1 - as)]; }
  }
  return mus;
}
/* The cheeks in speech. The mouth layer and the jaw reach about 110 px from the lips, so the cheek mass, from the
   cheekbone to the corner, stood still whatever the lips did: held /i/ (21 px of spread at the corner) moved the skin at
   y 600 by 0 px, held /a/ (39 px of jaw at the chin) by .8 px at y 640 and nothing above, /u/ (37 px of rounding) 0 at
   y 600, and the lower lids never answered anything but the accent's squint. A real cheek is a soft mass the lips and the
   jaw drag with them: it bunches up and out on a spread (the smile's cheek, the /i/ of "cheese"), is drawn in toward the
   corner on a rounding, and is carried down and stretched as the jaw drops, each a fraction of the corner's own move.
   Three muscles that nothing else reads (malar, buccal, cheekJaw, face-core) carry the skin, and the lower lid follows
   the malar pad (LID_CHEEK). They are driven from what the blend asks of the lips and the jaw, so what the cheek does is
   timed with the mouth, through a class of their own: soft tissue arrives later than the lips (omega 15 against 40) and
   is read that far ahead, as the others are (its read-ahead is not in the preroll: before the first sound it is at rest). Its
   own filter is its only smoothing, no window over the blend: at omega 22 with a 24 ms window the jaw's pulses were smoothed
   by the window and the cheek's acceleration was .03 of a muscle a frame; with the window off at 22 it was .056, and at 15
   it is .026 again.
   The face under the speech bends it: a smile bunches the cheek further (and a sad face less); all of it is
   `cheek` times CHEEK_DRIVE, a share of one full activation of the muscle per unit of the channel. */
const CHEEK_DRIVE = {spread:.85, roundCut:.6, lift:.5, smile:.8, sadCut:.35, round:1, open:1.25, jawRef:.4, mus:['malar', 'buccal', 'cheekJaw']};
function cheekAt(mus, jaw, out){
  const P = SPEECH.p.cheek ?? 1, C = CHEEK_DRIVE, A = AFF_NOW;
  const round = Math.min(1, mus.orbOris || 0), spread = Math.min(1, (mus.ris || 0) + .25 * (mus.bucc || 0)), lift = Math.min(1, mus.ulr || 0);
  const bunch = (C.spread * spread * (1 - C.roundCut * round) + C.lift * lift) * (1 + C.smile * A.cheek) * (1 - C.sadCut * A.sad);
  out.malar = [P * bunch * (1 + A.asym), P * bunch * (1 - A.asym)];   // the same side is the lively one as in the accents (UPPER_ASYM)
  out.buccal = P * C.round * round;
  out.cheekJaw = P * C.open * Math.min(1.3, Math.max(0, jaw) / C.jawRef);
  return out;
}
/* A speaker breathes in before a phrase: the nostrils flare a little ahead of the first sound and again where a pause or a
   clause break ends. Each is a bump (BREATH.width ms wide) centred BREATH.lead ms before the sound that follows the
   break, so the flare is over as the voice comes in; an angry or energetic speaker's breath is the larger. The nostril
   muscle is not read by the mouth. Scaled by `accent`, the parameter for the face's own gestures of speech. */
const BREATH = {flare:.3, lead:90, width:110, minGap:140, ang:.6, ener:.3};
function breathAt(segs, ms, mus){
  if(!segs || !segs.length) return mus;
  const P = SPEECH.p.accent ?? 1; if(P <= 0) return mus;
  const at = segs.breath || (segs.breath = (() => {
    const out = []; let gap = 1e9;   // before the first sound the silence is as long as it needs to be
    for(const s of segs){
      if(isBreak(s.name)){ gap = s.name === 'gap' ? gap + (s.t1 - s.t0) : gap + Math.max(BREATH.minGap, s.t1 - s.t0); continue; }
      if(gap >= BREATH.minGap) out.push(s.t0);
      gap = 0;
    }
    return out;
  })());
  let w = 0;
  for(const t of at){ const d = (ms - (t - BREATH.lead)) / BREATH.width; if(Math.abs(d) < 3) w = Math.max(w, Math.exp(-d * d)); }
  if(w < .01) return mus;
  const A = AFF_NOW, G = SPEECH.p.affect ?? 1;
  mus.nasal = (mus.nasal || 0) + BREATH.flare * w * P * (1 + G * (BREATH.ang * A.ang + BREATH.ener * Math.max(0, A.ener)));
  return mus;
}
/* The rest of the face's life while it speaks, which the phones do not carry. Speakers blink at the joints of what
   they say (a clause, the end of a sentence), seldom inside a word; they look aside as a sentence begins, while the
   thought is found, and come back to the listener to say it; and the head dips a little with an accent. Before, the
   blinks and glances kept the idle face's random timers through speech. */
const LIFE = {blink:.75, gapMs:110, quiet:4500, refract:700, glance:.55, glanceMs:[300, 650]};
function speechLife(f, now){
  const L = f.sLife || (f.sLife = {sp:null, brk:-1, last:-1e9, until:0, on:false});
  if(f.blinkT0 >= 0 && now - f.blinkT0 < 40) L.last = Math.max(L.last, f.blinkT0);
  /* the speaker's own blink rate (the emotion's manner, EMOTIONS[...].blink: an angry face stares, a frightened one blinks
     often) scales the chance of a blink at a joint; a face whose life is quiet (rate 0) keeps the plain chance */
  const bm = f.beh && f.beh.blink > .05 ? Math.min(2.4, f.beh.blink) : 1;
  const sp = f.motion && f.speech && f.speech.segs && f.speech.ms >= 0 ? f.speech : null;   // a face with its life off (a harness's quiet face) only speaks
  if(!sp){
    if(L.on){ L.on = false; f.speechNod = 0; if(f.next) f.next.look = now + 500 + Math.random() * 900;
      if(now - L.last > LIFE.refract && Math.random() < LIFE.blink * bm * .6 && f.blinkT0 < 0){ f.blinkT0 = now; L.last = now; } }
    return;
  }
  if(!f.next) return;
  if(sp !== L.sp){
    L.sp = sp; L.brk = -1; L.on = true;
    if(Math.random() < LIFE.glance){
      const side = Math.random() < .5 ? -1 : 1;
      f.look = [side * (5 + Math.round(Math.random() * 6)), -(2 + Math.round(Math.random() * 3))];
      L.until = now + LIFE.glanceMs[0] + Math.random() * (LIFE.glanceMs[1] - LIFE.glanceMs[0]);
    } else { f.look = [0, 0]; L.until = 0; }
  }
  if(L.until && now > L.until){ L.until = 0; f.look = [0, 0]; }
  f.next.look = now + 1000;   // no idle glances while speaking
  const i = sp.segs.findIndex(s => sp.ms < s.t1), s = sp.segs[i];
  if(s && i !== L.brk && (s.name === 'clause' || s.name === 'pause' || (s.name === 'gap' && s.t1 - s.t0 >= LIFE.gapMs))){
    L.brk = i;
    if(now - L.last > LIFE.refract && f.blinkT0 < 0 && Math.random() < LIFE.blink * bm){ f.blinkT0 = now; L.last = now; }
  }
  if(now - L.last < LIFE.quiet) f.next.blink = Math.max(f.next.blink, now + 250);   // inside a word, a blink waits for the next joint
  f.speechNod = UPPER_W * UPPER.nod * Math.max(.4, 1 + UPPER_AFF.nod * ((SPEECH.p.affect ?? 1) * (AFF_NOW.ener - .75 * AFF_NOW.sad)));   // a lively speaker nods more, a sad one less
}
/* The speech parameters as device widgets, built from the face device's own parts so they read as the face's
   do: two-axis pads (the same 8x8 cells, crosshair, puck; a ring marks the shipped default) for the
   parameters that come in pairs, and a bar matrix (drag a bar up or down) for the single ones. Double-click
   a pad or a bar to return it to its default. SPEECH.p and SPEECH.rate/art are the state; the widgets are a
   view of it, so the Say bar's own sliders and a saved page agree with them. */
const SPEECH_PADS = [
  {id:'pace',    label:'Pace',        x:['rate', .4, 3, 'slow', 'fast'],              y:['art', .5, 1.8, 'mumbled', 'exaggerated']},
  {id:'reach',   label:'Reach',       x:['antic', .3, 2.5, 'short', 'far ahead'],     y:['carry', .3, 2.5, 'clipped', 'lingers']},
  {id:'claimt',  label:'Claim time',  x:['lead', 20, 400, 'late', 'early'],           y:['tail', 20, 500, 'quick', 'slow']},
  {id:'closure', label:'Closure',     x:['soft', .2, 1.2, 'snap', 'slow press'],      y:['tuckY', 0, 10, 'on edge', 'deep']},
  {id:'jawlip',  label:'Jaw · lips',  x:['cJaw', 0, 1.2, 'keep base', 'phone'],       y:['cLips', 0, 1.2, 'keep base', 'phone']},
  {id:'contact', label:'Contact',     x:['cPress', 0, 1.2, 'keep base', 'press'],     y:['cTuck', 0, 1.2, 'keep base', 'tuck']},
  {id:'shape',   label:'Lip shape',   x:['cRound', 0, 1.2, 'keep base', 'round'],     y:['cWidth', 0, 1.2, 'keep base', 'spread']}
];
const SPEECH_BARS = [
  ['claim', 'positions', 0, 1], ['unclaimed', 'unlisted pull', 0, .8], ['speed', 'mouth pace', .5, 2.5],
  ['accent', 'accents', 0, 2.5], ['cheek', 'cheeks', 0, 2.5], ['affect', 'feeling', 0, 2.5]
];
const speechGet = k => k === 'rate' || k === 'art' ? SPEECH[k] : SPEECH.p[k];
function speechSet(k, v){
  if(k === 'rate' || k === 'art'){
    SPEECH[k] = v;
    const sl = typeof document !== 'undefined' && document.getElementById(k === 'rate' ? 'speech-rate' : 'speech-art');
    if(sl) sl.value = v;
    const rv = typeof document !== 'undefined' && document.getElementById('speech-rate-v'); if(rv) rv.textContent = SPEECH.rate.toFixed(1);
  } else SPEECH.p[k] = v;
  speechApplyParams();
  try { localStorage.setItem('face-rig.speech.p', JSON.stringify(SPEECH.p)); } catch(e){}
}
const speechDefault = k => k === 'rate' ? 1 : k === 'art' ? SPEECH_ART_DEFAULT : SPEECH_DEFAULTS[k];
function speechDevice(){
  const grid = document.querySelector('#facedev .fd-pads');
  if(!grid || document.getElementById('speech-sep')) return;
  const cells = 8, cs = 100 / cells;
  const sep = document.createElement('div');
  sep.id = 'speech-sep'; sep.className = 'fd-sep';
  const frag = document.createDocumentFragment();   // the speech widgets lead the grid: they are what is being edited
  sep.innerHTML = `<span class="fd-pl">Speech dynamics</span><span class="fd-chips"><button class="nc" data-sp="reset" title="every speech parameter back to its shipped value">reset</button><button class="nc" data-sp="additive" title="positions 0: speech is added to the face under it, as before">additive</button><button class="nc" data-sp="copy" title="copy the parameters as json">copy</button></span>`;
  frag.appendChild(sep);
  for(const P of SPEECH_PADS){
    const el = document.createElement('div');
    el.className = 'fd-pad'; el.dataset.spad = P.id;
    let g = '';
    for(let r = 0; r < cells; r++) for(let c = 0; c < cells; c++) g += `<rect class="pc" x="${(c * cs + .8).toFixed(2)}" y="${(r * cs + .8).toFixed(2)}" width="${(cs - 1.6).toFixed(2)}" height="${(cs - 1.6).toFixed(2)}" rx=".6"/>`;
    g += `<path d="M50 4V96M4 50H96" stroke="#ffffff" stroke-opacity=".12" stroke-width=".6"/>`;
    g += `<text x="50" y="9" class="pt" text-anchor="middle">${P.y[4]}</text><text x="50" y="96" class="pt" text-anchor="middle">${P.y[3]}</text><text x="4" y="52" class="pt">${P.x[3]}</text><text x="96" y="52" class="pt" text-anchor="end">${P.x[4]}</text>`;
    g += `<circle class="gh" r="2.6"/><rect class="pk pkR" width="8" height="8" rx="1.2"/>`;
    el.innerHTML = `<div class="fd-pl">${P.label}</div><svg viewBox="0 0 100 100">${g}</svg>`;
    frag.appendChild(el);
    const svg = el.querySelector('svg');
    const toVal = (axis, t) => { const [, lo, hi] = axis; return lo + (hi - lo) * (t + 1) / 2; };
    const toPad = e => { const b = svg.getBoundingClientRect(); return [Math.max(-1, Math.min(1, ((e.clientX - b.left) / b.width) * 2 - 1)), Math.max(-1, Math.min(1, 1 - ((e.clientY - b.top) / b.height) * 2))]; };
    const apply = e => { const v = toPad(e); speechSet(P.x[0], +toVal(P.x, v[0]).toFixed(3)); speechSet(P.y[0], +toVal(P.y, v[1]).toFixed(3)); };
    svg.addEventListener('pointerdown', e => {
      svg.setPointerCapture(e.pointerId); apply(e);
      const mv = ev => apply(ev), up = () => { svg.removeEventListener('pointermove', mv); svg.removeEventListener('pointerup', up); };
      svg.addEventListener('pointermove', mv); svg.addEventListener('pointerup', up);
    });
    svg.addEventListener('dblclick', () => { speechSet(P.x[0], speechDefault(P.x[0])); speechSet(P.y[0], speechDefault(P.y[0])); });
    const info = SPEECH_PARAMS.filter(q => q[0] === P.x[0] || q[0] === P.y[0]).map(q => q[1] + ': ' + q[5]).join('\n');
    el.title = info;
  }
  // the single parameters, as the muscle matrix draws a muscle: a bar, dragged up or down
  const wrap = document.createElement('div');
  wrap.className = 'fd-mxw fd-spw';
  wrap.innerHTML = `<div class="fd-pl">Speech · single</div><svg class="fd-mx fd-smx" viewBox="0 0 132 ${SPEECH_BARS.length * 11 + 2}"></svg>`;
  frag.appendChild(wrap);
  const closeSep = document.createElement('div'); closeSep.className = 'fd-sep fd-sep2'; closeSep.innerHTML = '<span class="fd-pl">Face</span>';
  frag.appendChild(closeSep);
  grid.insertBefore(frag, grid.firstChild);
  const mx = wrap.querySelector('svg');
  mx.innerHTML = SPEECH_BARS.map(([k, name], r) => {
    const y = r * 11 + 1;
    return `<text class="mt" x="0" y="${y + 7.4}">${name}</text><rect class="mc" data-k="${k}" x="62" y="${y}" width="70" height="9.5" rx="1"/><rect class="mf" data-f="${k}" x="62" y="${y}" width="0" height="9.5" rx="1" fill="#d7c27a"/><text class="mv" data-v="${k}" x="130" y="${y + 7.2}" text-anchor="end"></text>`;
  }).join('');
  mx.addEventListener('pointerdown', e => {
    const c = e.target.closest('.mc'); if(!c) return;
    const k = c.dataset.k, def = SPEECH_BARS.find(b => b[0] === k), [, , lo, hi] = def;
    const y0 = e.clientY, v0 = speechGet(k);
    mx.setPointerCapture(e.pointerId);
    const mv = ev => speechSet(k, +Math.max(lo, Math.min(hi, v0 + (y0 - ev.clientY) / 70 * (hi - lo))).toFixed(3));
    const up = () => { mx.removeEventListener('pointermove', mv); mx.removeEventListener('pointerup', up); };
    mx.addEventListener('pointermove', mv); mx.addEventListener('pointerup', up);
  });
  mx.addEventListener('dblclick', e => {   // pointer capture makes the svg the target, so the row comes from the position
    const bb = mx.getBoundingClientRect(), row = Math.floor((e.clientY - bb.top) / bb.height * (SPEECH_BARS.length * 11 + 2) / 11);
    const def = SPEECH_BARS[Math.max(0, Math.min(SPEECH_BARS.length - 1, row))];
    speechSet(def[0], speechDefault(def[0]));
  });
  sep.addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    if(b.dataset.sp === 'reset'){ Object.assign(SPEECH.p, SPEECH_DEFAULTS); speechSet('rate', 1); speechSet('art', 1); }
    if(b.dataset.sp === 'additive') speechSet('claim', 0);
    if(b.dataset.sp === 'copy'){ const t = JSON.stringify(Object.assign({rate:SPEECH.rate, art:SPEECH.art}, SPEECH.p)); if(navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {}); const n = document.getElementById('speech-now'); if(n) n.textContent = t; }
  });
  // the read-back: pucks follow the state (whoever changed it), bars fill, cells light round the puck
  const norm = (axis, v) => Math.max(-1, Math.min(1, (v - axis[1]) / (axis[2] - axis[1]) * 2 - 1));
  const tick = () => {
    grid.querySelectorAll('.fd-pad[data-spad]').forEach(el => {
      const P = SPEECH_PADS.find(q => q.id === el.dataset.spad), svg = el.querySelector('svg');
      const v = [norm(P.x, speechGet(P.x[0])), norm(P.y, speechGet(P.y[0]))], d = [norm(P.x, speechDefault(P.x[0])), norm(P.y, speechDefault(P.y[0]))];
      svg.querySelectorAll('.pc').forEach((c, k) => {
        const cx = (k % cells + .5) / cells * 2 - 1, cy = 1 - (Math.floor(k / cells) + .5) / cells * 2;
        c.style.fillOpacity = (.07 + .7 * Math.exp(-((cx - v[0]) ** 2 + (cy - v[1]) ** 2) / .07)).toFixed(2);
      });
      const pk = svg.querySelector('.pkR'); pk.setAttribute('x', 50 + v[0] * 44 - 4); pk.setAttribute('y', 50 - v[1] * 44 - 4);
      const gh = svg.querySelector('.gh'); gh.setAttribute('cx', 50 + d[0] * 44); gh.setAttribute('cy', 50 - d[1] * 44);
    });
    SPEECH_BARS.forEach(([k, , lo, hi]) => {
      const v = speechGet(k), f = mx.querySelector(`.mf[data-f="${k}"]`), t = mx.querySelector(`.mv[data-v="${k}"]`);
      f.setAttribute('width', (70 * Math.max(0, Math.min(1, (v - lo) / (hi - lo)))).toFixed(1));
      t.textContent = v.toFixed(2);
    });
  };
  tick();
  if(speechDevice.timer) clearInterval(speechDevice.timer);
  speechDevice.timer = setInterval(tick, 100);
}

/* Speech's hold on the mouth, as an envelope that belongs to the face, not to one utterance. It rises over `lead`
   ms when speech is about to start (an utterance on the page's own clock starts now; a chat sentence is seen
   coming in the queue) and falls over `tail` ms after speech stops, and a short gap between two chat sentences
   only dips it. Computed per utterance from the phones' centres, as it was, a chat sentence (inactive before its
   first sample, dropped at its last) switched the base face's mouth off at ~0.96 in its first frame and back on
   from ~0.36 in its last: on a pressed angry mouth the closure jumped 72% in one frame at every sentence. */
function speechHold(f, now){
  const P = SPEECH.p, dt = Math.min(80, Math.max(0, now - (f.holdT ?? now)));
  f.holdT = now;
  let want = f.speech && !(f.speech.clock === 'audio' && f.speech.ms < -speechPreroll()) ? 1 : 0, left = P.lead;
  if(f.chatSpeechQueue && f.chatSpeechQueue.length && typeof FACE_RIG_CHAT_CLOCK === 'function'){
    const audioNow = FACE_RIG_CHAT_CLOCK();
    /* a sentence is seen coming; the hold has to be up by its first sound's centre. The chat queues a sentence
       only ~75 ms before its audio, so the rise takes whatever time is left, not always `lead`: a first word
       spoken at a part hold left the face's own jaw under it, and its lips popped open. */
    for(const item of f.chatSpeechQueue){
      if(!Number.isFinite(audioNow)) break;
      const first = item.segs.find(s => !isBreak(s.name)), at = (item.startAt - audioNow) * 1000 + (first ? first.mid : 0);
      if(at > P.lead) continue;
      want = 1; left = Math.min(left, Math.max(16, at));
    }
  }
  const e = f.holdE || 0;
  f.holdE = want ? Math.min(1, e + Math.max(dt / Math.max(1, P.lead), dt * (1 - e) / left)) : Math.max(0, e - dt / Math.max(1, P.tail));
  return sm01(f.holdE);
}
let SPEECH_JAW_EXP = .85;
/* Speech's own motion. The blend is the trajectory (Cohen-Massaro computes a path through the targets); after it each
   channel class runs through one critically damped filter paced like the articulator it moves: omega 40 for the lips,
   the tongue and the jaw (a 10-90% rise of about 85 ms, a jaw gesture's own time), 35 for the press, 25 for spreading
   and 23 for rounding, slower gestures (at one pace for all a pucker's onset narrowed the mouth 35 px in a frame; at
   18 /w r/ arrived late; 26 since 2026-10-14: at 23 "we want" held /iy/ at .8 of a pucker. A quicker release than
   onset, tried with it, widened "three"'s /r iy/ by 14 px in a frame).
   Each class reads the blend its own lag (2/omega) ahead, so the parts of a shape land on the sound together; the TTS
   gives the timing before it is spoken, so the read-ahead is exact. sigma, where it is not 0, also averages the
   blend over a centred window of that many ms. (The expression springs speech used to go through ran at omega 8-14,
   a 240 ms rise, and lost every consonant; a centred window alone, tried as the whole smoothing, bought smoothness
   only by losing the vowels' opening.) SPEECH.p.speed scales every pace: below 1 slower and smoother, above quicker. */
const SPEECH_MOTION = {base:{omega:40, sigma:10}, jaw:{omega:40, sigma:14},
  classes:[{omega:26, sigma:0, mus:['orbOris']}, {omega:25, sigma:0, mus:['ris', 'bucc']}, {omega:23, sigma:0, mus:['lipPress']},
    {omega:55, sigma:10, lead:18, mus:['tongueOut', 'tongueUp', 'tongueBack']},
    {omega:30, sigma:28, mus:['dli']}]};
/* The tongue is quicker than the lips and jaw (omega 55; the tip is the fastest articulator) and reads its lag ahead as a
   pulse's (lead 1/omega, ms), not a ramp's (2/omega): its gestures are short pulses (a /th/ of 23 ms at Piper's pace),
   and read the whole lag ahead in the jaw's class the tip came out 25-40 ms early: in "around the" it was out over the
   /d/ of "around" (.68) and going back in by the /dh/ (owner, 2026-10-20: "the tongue sticks out like a th"). Now it is
   .21 at the /d/'s centre and .67 at the /dh/; every /th dh/ of the board's sentences peaks .67 or more. */
const SPEECH_CLASS_OF = {};
for(const c of SPEECH_MOTION.classes) for(const m of c.mus) SPEECH_CLASS_OF[m] = c;
/* The cheek's own class (cheekAt): soft tissue, slower than the lips, driven from the blend read this class's lag ahead. */
SPEECH_MOTION.cheek = {omega:15, sigma:0};   // no window average: its own filter is the only smoothing (see cheekAt)
for(const m of CHEEK_DRIVE.mus) SPEECH_CLASS_OF[m] = SPEECH_MOTION.cheek;
const speechOmega = c => c.omega * (SPEECH.p.speed || 1);
const SPEECH_TAPS = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map(i => [i / 2, Math.exp(-(i / 2) * (i / 2) / 2)]);
const SPEECH_TAP_SUM = SPEECH_TAPS.reduce((a, [, w]) => a + w, 0);
/* The blend for a channel class at ms: read the class's lag ahead, over its window (in the segments' own time: k is
   the playback rate). */
function speechSmoothAt(phones, segs, ms, c, k, total){
  const mus = {}, lead = c.lead != null ? c.lead / (SPEECH.p.speed || 1) : 2000 / speechOmega(c), taps = c.sigma ? SPEECH_TAPS : [[0, 1]], sum = c.sigma ? SPEECH_TAP_SUM : 1;
  let jaw = 0;
  for(const [o, w] of taps){
    const t = ms + (o * (c.sigma || 0) + lead) * k;
    if(t >= total || t < 0) continue;   // before the first sound and past the last: rest
    const sh = shapePlayed(speechShape(phones, t, segs).shape);
    jaw += w * (sh.jaw || 0);
    for(const m in sh.mus) mus[m] = (mus[m] || 0) + w * sh.mus[m];
  }
  for(const m in mus) mus[m] /= sum;
  return {mus, jaw:jaw / sum};
}
function speechTargetAt(phones, segs, ms, k, total){
  const base = speechSmoothAt(phones, segs, ms, SPEECH_MOTION.base, k, total);
  base.jaw = speechSmoothAt(phones, segs, ms, SPEECH_MOTION.jaw, k, total).jaw;
  for(const c of SPEECH_MOTION.classes){
    const pc = speechSmoothAt(phones, segs, ms, c, k, total).mus;
    for(const m of c.mus){ if(pc[m]) base.mus[m] = pc[m]; else delete base.mus[m]; }
  }
  if((SPEECH.p.cheek ?? 1) > 0){ const ck = speechSmoothAt(phones, segs, ms, SPEECH_MOTION.cheek, k, total); cheekAt(ck.mus, ck.jaw, base.mus); }
  base.at = speechShape(phones, Math.min(total - 1, Math.max(0, ms)), segs);
  return base;
}
/* Reading ahead needs time before the first sound: a speaker's lips move before the voice does. Speech starts
   speechPreroll() ms (the furthest read-ahead) early: a chat sentence is taken up that long before its audio, and the
   page's own playback (which has no audio) starts its clock that far back. Without it the first phone was read before
   the playback reached it and a first /m/ at rate 3 never pressed. */
const speechPreroll = () => Math.ceil(Math.max(...[SPEECH_MOTION.base, SPEECH_MOTION.jaw, ...SPEECH_MOTION.classes].map(c => 2000 / speechOmega(c) + 2 * (c.sigma || 0))));
/* The release is quicker than the closure, but no more than half again: the closure holds the lips together over a jaw
   that is already dropping for the vowel, and at the press's own 3.4 the lips sprang open to it in a frame. */
const SPEECH_REL_MAX = 1.5;
let SPEECH_TGT = null;
function speechMotion(f, now){
  const n = MUSCLES.length, dt = Math.min(.08, Math.max(0, (now - (f.sT ?? now)) / 1000));
  f.sT = now;
  if(!f.sActs){ f.sActs = new Float32Array(n); f.sVel = new Float32Array(n); f.sJaw = 0; f.sJawV = 0; }
  const T = SPEECH_TGT || (SPEECH_TGT = new Float32Array(n));
  T.fill(0);
  if(f.speechTargets) musTargets(f.speechTargets, T, 1);
  const step = (x, v, tg, w) => { const e = Math.exp(-w * dt), y = x - tg, c = v + w * y; return [tg + (y + c * dt) * e, (v - w * c * dt) * e]; };
  let any = false;
  for(let i = 0; i < n; i++){
    const x = f.sActs[i], v = f.sVel[i], tg = T[i];
    if(x === 0 && v === 0 && tg === 0) continue;
    /* a contact lets go faster than it closes (the muscle's own rel: the lip press 3.4, the tuck and the tongue 2):
       a bilabial's release is the burst, the quickest thing the lips do */
    const rel = Math.min(SPEECH_REL_MAX, MUSCLES[i].def.rel || 1), r = step(x, v, tg, speechOmega(SPEECH_CLASS_OF[MUSCLES[i].id] || SPEECH_MOTION.base) * (tg < x ? rel : 1));
    f.sActs[i] = Math.abs(r[0]) < 1e-5 && Math.abs(r[1]) < 1e-4 && tg === 0 ? 0 : r[0]; f.sVel[i] = f.sActs[i] === 0 ? 0 : r[1];
    any = true;
  }
  const rj = step(f.sJaw, f.sJawV, f.speechJaw || 0, speechOmega(SPEECH_MOTION.jaw));
  f.sJaw = rj[0]; f.sJawV = rj[1];
  if(any) f.musMoved = true;
}
/* Back to no speech at all, at once: for harnesses that reset a face's muscles between runs. */
function speechReset(f){
  f.speech = null; f.speechTargets = null; f.speechJaw = 0; f.speechClaim = null; f.sAff = null;
  f.sActs = null; f.sVel = null; f.sJaw = 0; f.sJawV = 0; f.sT = undefined; f.holdE = 0; f.holdT = undefined;
  f.bActs = null; f.actsOut = null; f.jawB = null; f.jawOut = undefined;
}
function speechFrame(f, now){
  AFF_NOW = f.sAff = speechAffect(f, f.sAff);   // the face under the speech, for this face's speech this frame (shapePlayed, upperAt, cheekAt)
  speechFrameAt(f, now);
  speechLife(f, now);
  speechMotion(f, now);
  const env = speechHold(f, now);
  if(SPEECH.p.claim <= 0 || env <= 0){ f.speechClaim = null; return; }
  const c = f.speechClaim || (f.speechClaim = {J:0, ru:0, rl:0, lp:0, tk:0, pk:0, wd:0, fpk:0, fwd:0});
  if(f.speech && f.speech.segs && f.speech.ms >= -speechPreroll() * SPEECH.rate) speechShares(f.speech.segs, Math.max(0, f.speech.ms), c);
  const P = SPEECH.p, k = env * P.claim;
  c.J = Math.min(1, k * P.cJaw); c.ru = Math.min(1, k * P.cLips); c.rl = c.ru;
  c.lp = Math.min(1, k * P.cPress); c.tk = Math.min(1, k * P.cTuck);
  c.pk = Math.min(1, k * c.fpk * P.cRound); c.wd = Math.min(1, k * c.fwd * P.cWidth);
  c.tn = P.affect ?? 1;   // the share of the base's cancelled press that thins the lips (faceMouthState): the feeling's part of the mouth
}
function speechFrameAt(f, now){
  if(f.chatSpeechQueue && f.chatSpeechQueue.length && typeof FACE_RIG_CHAT_CLOCK === 'function'){
    const audioNow = FACE_RIG_CHAT_CLOCK();
    while(f.chatSpeechQueue.length && f.chatSpeechQueue[0].startAt + f.chatSpeechQueue[0].total / 1000 <= audioNow){
      f.chatSpeechQueue.shift();
    }
    const active = f.chatSpeechQueue.find(item => item.startAt - speechPreroll() / 1000 <= audioNow && item.startAt + item.total / 1000 > audioNow);
    if(active) f.speech = active;
    else if(f.speech?.clock === 'audio') f.speech = null;
  }
  const sp = f.speech;
  if(!sp){ f.speechTargets = null; f.speechJaw = 0; return; }
  if(sp.clock === 'audio'){
    const audioNow = typeof FACE_RIG_CHAT_CLOCK === 'function' ? FACE_RIG_CHAT_CLOCK() : NaN;
    if(!Number.isFinite(audioNow)){
      f.speech = null; f.speechTargets = null; f.speechJaw = 0;
      return;
    }
    sp.ms = (audioNow - sp.startAt) * 1000;
    if(sp.ms < -speechPreroll()){ f.speechTargets = null; f.speechJaw = 0; return; }
  } else {
    if(!sp.pre){ sp.pre = true; sp.ms -= speechPreroll() * SPEECH.rate; }
    sp.ms += Math.max(0, now - sp.last) * SPEECH.rate; sp.last = now;
  }
  /* RATEC scales the dominance's decay in the segments' own time. On the page's clock (the reading rate, sped up by
     the slider) rate^-.55 is the slider's law. The chat's segments are in wall time, at about four times the
     reading rate: there the decay goes with the whole pace, so a consonant's reach covers the phones it covers at
     the reading rate instead of five of Piper's (an /s/ still weighed .28 at the centre of a vowel 250 ms on). */
  RATEC = sp.clock === 'audio' ? (sp.pace || 1) : Math.pow(SPEECH.rate, -.55);
  /* the lip shape is anticipated over a span of time, not of phones: rounding starts some 200-500 ms before a rounded
     vowel however fast the speech (Bell-Berti & Harris). So on the chat's clock its reach stays the reading rate's,
     in wall time; narrowed with the pace, /f/ before /uw/ lost its rounding (.14, .29 at the root of the pace) */
  RATEC_SHAPE = sp.clock === 'audio' ? 1 : RATEC;
  RATEC_JAW = sp.clock === 'audio' ? Math.pow(sp.pace || 1, SPEECH_JAW_EXP) : RATEC;
  speechApplyParams();
  const cur = document.getElementById('speech-now');
  const say = txt => { if(cur && sp.now !== txt){ sp.now = txt; cur.textContent = txt; } };
  if(sp.ms >= sp.total){
    f.speech = null;
    f.speechTargets = null;
    f.speechJaw = 0;
    if(cur) cur.textContent = '';
    return;
  }
  /* each channel's target is read its own lead ahead, so a shape's parts all land on the sound however fast each moves */
  const played = speechTargetAt(sp.phones, sp.segs, sp.ms, sp.clock === 'audio' ? 1 : SPEECH.rate, sp.total), at = played.at;
  f.speechTargets = breathAt(sp.segs, sp.ms, upperAt(sp.segs, sp.ms, played.mus));
  f.speechJaw = played.jaw;
  say(at.label + (at.next ? ' → ' + at.next : ''));
}

let FACE_RIG_CHAT_CLOCK = null;
const FACE_RIG_SPEECH_BOUNDS = Object.fromEntries(SPEECH_PARAMS.map(([name, , lo, hi]) => [name, [lo, hi]]));
FACE_RIG_SPEECH_BOUNDS.rate = [.4, 3];
FACE_RIG_SPEECH_BOUNDS.art = [.5, 1.8];

if(typeof window !== 'undefined') window.FACE_RIG_CHAT = Object.freeze({
  bindClock(clock){
    if(typeof clock !== 'function') throw new TypeError('audio clock must be a function');
    FACE_RIG_CHAT_CLOCK = clock;
  },
  setSpeechMode(active){
    const f = LIVE_FACES.find(x => x.el && x.el.closest('#fd-face'));
    if(!f) throw new Error('face rig is not mounted');
    f.chatSpeechMode = Boolean(active);
  },
  queueSpeech({ id, startAt, durationMs, segments }){
    if(typeof id !== 'string' || !id || id.length > 128) throw new TypeError('speech id is invalid');
    if(!Number.isFinite(startAt) || !Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 60000) throw new RangeError('speech clock or duration is invalid');
    if(!Array.isArray(segments) || !segments.length || segments.length > 5000) throw new TypeError('speech segments are invalid');
    const f = LIVE_FACES.find(x => x.el && x.el.closest('#fd-face'));
    if(!f) throw new Error('face rig is not mounted');
    /* Piper gives a diphthong as one phone; the face moves through it in two, as the page's own letters-to-sounds
       has it (phoneOf): the nucleus and the glide (55% and 45% of its time). Without the glide "fine", "how", "boy"
       and "go" never made their second movement. */
    /* A diphthong's nucleus is the longer part (70%): at 55% the glide began while it was still opening (/eɪ/ on the
       board's sentences: the teeth 12.3 px apart at its peak, 13.0 at 70%, 14.0 with its hold on the jaw, JAW_RESIST;
       the /a/ of "around" had 45 ms). */
    const GLIDE = {ay:'ay2', aw:'aw2', oy:'oy2', ow:'ow2', ey:'ey2'}, GLIDE_AT = {ey:.7, ay:.7, aw:.6, oy:.7, ow:.65};
    segments = segments.flatMap(sg => {
      if(!sg || !GLIDE[sg.phone] || !Number.isFinite(sg.startMs) || !Number.isFinite(sg.endMs)) return [sg];
      const cut = sg.startMs + (sg.endMs - sg.startMs) * (GLIDE_AT[sg.phone] || .55);
      return [{...sg, endMs:cut}, {...sg, phone:GLIDE[sg.phone], startMs:cut}];
    });
    let end = 0;
    const segs = segments.map((segment) => {
      if(!segment || !PHONE[segment.phone] || !Number.isFinite(segment.startMs) || !Number.isFinite(segment.endMs)
          || segment.startMs < 0 || segment.endMs <= segment.startMs || segment.startMs + .1 < end
          || segment.endMs > durationMs + 1) throw new RangeError('speech phone timeline is invalid');
      end = segment.endMs;
      return {
        name: segment.phone, t0: segment.startMs, t1: segment.endMs,
        mid: (segment.startMs + segment.endMs) / 2,
        spec: specFor(segment.phone, 'plain'), pros: 'plain', art: 1,
      };
    });
    if(Math.abs(end - durationMs) > 1) throw new RangeError('speech phone timeline does not reach the audio end');
    /* Stress. Piper sends none, but it lengthens a stressed vowel and shortens a reduced one, so a vowel's length
       against the sentence's median vowel grades it, as the page's own spans grade theirs (STRESS): a stressed vowel
       opens further, a weak one less. All 'plain', every syllable opened alike and the vowels hardly stood out from
       the consonants between them. The brows' accents read the same grade (upperAccents). */
    { const vd = segs.filter(s => VOWEL.has(s.name) && !TAIL.has(s.name)).map(s => s.t1 - s.t0).sort((a, b) => a - b);
      const med = vd.length ? vd[vd.length >> 1] : 0;
      if(med > 0) for(const s of segs){
        if(!VOWEL.has(s.name) || TAIL.has(s.name)) continue;
        const r = (s.t1 - s.t0) / med;
        if(r >= CHAT_STRESS[0]){ s.pros = 'stress'; s.art = STRESS.stress.art; }
        else if(r <= CHAT_STRESS[1]){ s.pros = 'weak'; s.art = STRESS.weak.art; }
      } }
    /* The silence before a sentence is not a closure: a speaker sets the mouth for a first vowel while it lasts, and the
       voice starts on an open mouth. As a pause it held the jaw shut against the vowel, and the 81 ms vowel that starts
       "Again" drew a jaw of .078 against its own .14 (owner: "barely opens"). The silence keeps its place, for the
       hand-over's timing (speechClaims), and takes the vowel's shape. */
    if(segs.length > 1 && segs[0].name === 'pause' && VOWEL.has(segs[1].name)) segs[0].spec = segs[1].spec;
    /* The utterance's pace: what the page's own spans would give these phones over their real length (Piper is about
       four times faster). The blend's reach is scaled by it (speechFrameAt), so each phone reaches as far, counted in
       phones, as at the reading rate the blend was tuned on; the motion's speed stays the filter's (speechMotion). */
    const nominal = spans(segs.map(s => s.name)).reduce((a, s) => a + s.t1 - s.t0, 0);
    const pace = Math.min(6, Math.max(.5, nominal / durationMs));
    if(!f.chatSpeechQueue) f.chatSpeechQueue = [];
    if(f.chatSpeechQueue.some(item => item.id === id)) throw new Error('speech id has already been queued');
    f.chatSpeechQueue.push({ id, clock: 'audio', startAt, total: durationMs, pace, ms: -1, last: 0, now: '', phones: segs.map(s => s.name), segs });
    f.chatSpeechQueue.sort((a, b) => a.startAt - b.startAt);
    f.chatSpeechMode = true;
    return { id, queued: f.chatSpeechQueue.length, durationMs };
  },
  stopSpeech(){
    const f = LIVE_FACES.find(x => x.el && x.el.closest('#fd-face'));
    if(!f) return false;
    f.chatSpeechQueue = [];
    f.speech = null; f.speechTargets = null; f.speechJaw = 0;   // the hold lets go over `tail`
    return true;
  },
  apply(action){
    if(!action || typeof action !== 'object') throw new TypeError('face action is invalid');
    const f = LIVE_FACES.find(x => x.el && x.el.closest('#fd-face'));
    if(!f) throw new Error('face rig is not mounted');
    switch(action.type){
      case 'affect':
        if(!Number.isFinite(action.valence) || !Number.isFinite(action.arousal) || Math.abs(action.valence) > 1 || Math.abs(action.arousal) > 1) throw new RangeError('affect coordinates must be in -1..1');
        f.affectT = [action.valence, action.arousal]; break;
      case 'emotion':
        if(!EMOTIONS[action.name]) throw new RangeError('unknown emotion');
        faceEmotion(f, action.name); break;
      case 'expression':
        if(!FACE_EXPRS[action.name] || !Number.isFinite(action.weight) || action.weight < 0 || action.weight > 1) throw new RangeError('expression or weight is invalid');
        // the same expression at a new weight eases to it; a new expression arrives with its wave of flips
        if(f.expr && f.expr.name === action.name) f.expr.w = action.weight;
        else faceExpression(f, action.name, action.weight);
        break;
      case 'gesture':
        if(!GESTURES[action.name]) throw new RangeError('unknown gesture');
        faceGesture(f, action.name); break;
      case 'agent':
        if(!AGENTS[action.name]) throw new RangeError('unknown agent state');
        faceAgent(f, action.name);
        if(action.name === 'speaking') f.chatSpeechMode = true;
        else if(!f.chatSpeechQueue?.length) f.chatSpeechMode = false;
        break;
      case 'augmentation':
        if(action.name === 'pupil' && Number.isFinite(action.value) && action.value >= 0 && action.value <= 1) f.pad.pupil[0] = action.value;
        else if(action.name === 'iris' && Number.isFinite(action.value) && action.value >= .8 && action.value <= 1.35) f.pad.pupil[1] = (action.value - .8) / .55;
        else if(action.name === 'flush' && Number.isFinite(action.value) && action.value >= 0 && action.value <= 1) f.pad.skin[0] = action.value;
        else if(action.name === 'crease' && Number.isFinite(action.value) && action.value >= 0 && action.value <= 1) f.pad.skin[1] = action.value;
        else if(action.name === 'ruby' && Number.isFinite(action.value) && action.value >= 0 && action.value <= 1) f.pad.gem[0] = action.value;
        else if(action.name === 'marble' && Number.isFinite(action.value) && action.value >= 0 && action.value <= 1) f.pad.gem[1] = 1 - action.value;
        else throw new RangeError('augmentation or value is invalid');
        facePads(f); break;
      case 'micro':
        if(!MICRO[action.name]) throw new RangeError('unknown micro-expression');
        f.micros.push({key:action.name, t0:performance.now(), dur:rand(MICRO[action.name].dur)}); break;
      case 'gaze':
        if(!Number.isFinite(action.x) || !Number.isFinite(action.y) || Math.abs(action.x) > 1 || Math.abs(action.y) > 1) throw new RangeError('gaze must be in -1..1');
        f.pad.gaze = [action.x, action.y]; facePads(f); break;
      case 'pad': {
        // the panel's own pads: a split pad takes one side or both, a vector pad (jaw, bones) one point
        const p = f.pad[action.name], v = [action.x, action.y];
        if(!p || !v.every(n => Number.isFinite(n) && Math.abs(n) <= 1) || ['gaze', 'skin', 'pupil', 'gem'].includes(action.name)) throw new RangeError('pad or value is invalid');
        if(Array.isArray(p)) f.pad[action.name] = v;
        else if(action.side === 'L' || action.side === 'R'){ p.split = true; p[action.side] = v; }
        else { p.split = false; p.L = v.slice(); p.R = v.slice(); }
        facePads(f); break;
      }
      case 'reset':
        for(const [name, p] of Object.entries(f.pad)) if(name !== 'gem'){ if(Array.isArray(p)) f.pad[name] = [0, 0]; else Object.assign(p, {L:[0, 0], R:[0, 0], split:false}); }
        faceEmotion(f, 'neutral'); faceExpression(f, 'neutral', 1); f.affectT = [0, 0]; facePads(f); break;
      case 'speech-parameter': {
        const range = FACE_RIG_SPEECH_BOUNDS[action.name];
        if(!range || !Number.isFinite(action.value) || action.value < range[0] || action.value > range[1]) throw new RangeError('speech parameter or value is invalid');
        speechSet(action.name, action.value); break;
      }
      default: throw new RangeError('unsupported face action');
    }
    return { applied: action.type };
  },
});

if(typeof document !== 'undefined'){
  const mount = () => {
    if(document.getElementById('speech-box')) return;
    const css = document.createElement('style');
    css.textContent = `#speech-box{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;margin:14px 0 4px;font:13px/1.3 ui-monospace,monospace;color:#c8c4b8}
#speech-box input{flex:1;min-width:180px;background:#14161a;color:#e8e4da;border:1px solid #3a3d36;border-radius:6px;padding:7px 10px}
#speech-box button{background:#2a2e28;color:#e8e4da;border:1px solid #5c6354;border-radius:6px;padding:7px 12px;cursor:pointer}
#speech-box label.sl{display:flex;gap:6px;align-items:center;color:#8d907f}
#speech-box input[type=range]{flex:none;min-width:0;width:90px;padding:0;accent-color:#d7c27a}
#speech-now,#speech-phones{flex-basis:100%;color:#8d907f;letter-spacing:.04em}
#speech-now{color:#d7c27a;min-height:1em}
.fd-sep{grid-column:1/-1;display:flex;align-items:center;gap:10px;margin:0;padding-bottom:2px}
.fd-sep2{margin-top:6px;padding-top:6px;border-top:1px solid var(--line-strong)}
.fd-spw{grid-column:span 2}
.fd-smx{width:200px}
.fd-mx .mv{font-size:6px;fill:#e8e4da;pointer-events:none}`;
    document.head.appendChild(css);
    const host = document.querySelector('.plate') || document.body;
    const box = document.createElement('form');
    box.id = 'speech-box';
    box.innerHTML = `<label for="speech-text">Say</label>
      <input id="speech-text" type="text" placeholder="hello, 42, C3PO, any token" autocomplete="off">
      <button type="submit">Speak</button>
      <label class="sl">rate <input id="speech-rate" type="range" min=".4" max="3" step=".05" value="1"><b id="speech-rate-v">1.0</b></label>
      <label class="sl">articulation <input id="speech-art" type="range" min=".5" max="1.8" step=".05" value="1"></label>
      <button type="button" id="speech-natural" title="12 phones a second, a little exaggerated">natural</button>
      <div id="speech-now"></div>
      <div id="speech-phones"></div>`;
    host.insertBefore(box, host.firstChild);
    /* the parameters under the phoneme dynamics: restored here, edited by the device widgets (speechDevice) */
    try { const saved = JSON.parse(localStorage.getItem('face-rig.speech.p') || 'null'); if(saved) for(const k in saved) if(k in SPEECH.p) SPEECH.p[k] = +saved[k]; } catch(e){}
    speechApplyParams();
    box.addEventListener('input', e => {
      if(e.target.id === 'speech-rate') SPEECH.rate = +e.target.value;
      if(e.target.id === 'speech-art') SPEECH.art = +e.target.value;
      const rv = document.getElementById('speech-rate-v'); if(rv) rv.textContent = SPEECH.rate.toFixed(1);
    });
    box.querySelector('#speech-natural').addEventListener('click', () => {
      SPEECH.rate = 2.5; SPEECH.art = 1.3;
      document.getElementById('speech-rate').value = 2.5; document.getElementById('speech-art').value = 1.3;
      document.getElementById('speech-rate-v').textContent = '2.5';
    });
    box.addEventListener('submit', e => {
      e.preventDefault();
      speakText(document.getElementById('speech-text').value);
    });
  };
  const mountAll = () => { mount(); speechDevice(); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll);
  else mountAll();
  if(typeof faceTick === 'function'){
    const tickNow = faceTick;
    faceTick = function(now){
      if(typeof LIVE_FACES !== 'undefined'){
        for(const f of LIVE_FACES) speechFrame(f, now);
      }
      tickNow(now);
    };
  }
}

if(typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('face-speech.js')){
  /* What this suite owns: reading the text into phones, the dominance blend's timing, the springs'
     arrival, and the closure mechanics. What it does not own: whether the mouth looks like the
     sound. That is measured off the drawn mesh — every polygon after every layer — by
     tools/mouth-lab.mjs, because a suite of channel numbers passed while /th/ /r/ /s/ /d/ /f/ /t/
     read as nothing. Numbers here, pixels there. */
  const fail = (...a) => { console.error('FAIL', ...a); process.exitCode = 1; };
  const n3 = x => Math.round((x || 0) * 1000) / 1000;
  const show = s => textToPhones(s).join(' ');
  const expect = (s, re) => { const got = show(s); if(!re.test(got)) fail(JSON.stringify(s), got); else console.log('ok', JSON.stringify(s), '→', got); };

  /* ---- G2P: words run together, punctuation breaks ---- */
  expect('hello', /^hh eh l ow$/);
  expect('the', /^dh ax$/);
  expect('moon', /^m uw n$/);
  expect('fish', /^f ih sh$/);
  expect('I see', /^ay ay2 gap s iy$/);
  expect('42', /^f ao r t iy gap t uw$/);
  expect('3.14', /^th r iy gap p oy oy2 n t gap w ah n gap f ao r$/);
  expect('hello!', /^hh eh l ow$/);
  expect('C3PO', /^s iy gap th r iy gap p iy gap ow$/);
  expect('$5 & @', /d aa l er gap f ay ay2 v gap ae n d gap ae t/);
  expect('hello, world.', /^hh eh l ow clause w er l d$/);
  expect('baby', /^b ey b iy$/);
  expect('navy', /^n ey v iy$/);
  /* the owner's test phrase (Round 10): doubled letters are one sound, -tion is sh-ax-n, ough, wa- */
  expect('correction buddy we thoroughly want to express this', /^k ax r eh k sh ax n gap b ah d iy gap w iy gap th er ow l iy gap w aa n t gap t uw gap ih k s p r eh s gap dh ih s$/);
  expect('running dogs bought nation vision', /^r ah n ih ng gap d aa g z gap b ao t gap n ae sh ax n gap v ih zh ax n$/);
  for(const w of ['three', 'fifty', 'teeth', 'do', 'fife', 'forty'])
    if(textToPhones(w).includes('gap') || textToPhones(w).includes('pause')) fail(w, 'a break inside a word', show(w));

  /* ---- the table: the opening it names, and who is allowed to gesture with what ---- */
  const VOWELS = ['iy', 'ih', 'ey', 'eh', 'ae', 'aa'];
  for(let k = 1; k < VOWELS.length; k++)
    if(!(PHONE[VOWELS[k - 1]].A < PHONE[VOWELS[k]].A)) fail('the vowel opening order', VOWELS[k], PHONE[VOWELS[k - 1]].A, PHONE[VOWELS[k]].A);
  if(!(PHONE.p.A === 0 && PHONE.f.A > 0 && PHONE.th.A < PHONE.aa.A)) fail('the consonant openings', PHONE.p.A, PHONE.f.A, PHONE.th.A, PHONE.aa.A);
  if(Math.abs(PHONE.aa.jaw - .37) > .12) fail('/aa/ jaw landed far from the opening it named', PHONE.aa.jaw);
  else console.log('ok /aa/ opens', PHONE.aa.A + 'px on a jaw of', n3(PHONE.aa.jaw));
  const banned = ['zyg', 'zygMin', 'lao', 'dao', 'orbOc'], pulled = [];
  for(const [name, spec] of Object.entries(PHONE)){
    for(const k of Object.keys(spec.mus)){
      if(banned.includes(k)) pulled.push(name + '.' + k);
      if(spec.mus[k] > 1) fail('weight not a full pull at most', name, k, spec.mus[k]);
    }
    const tip = spec.mus.tongueOut || 0, up = spec.mus.tongueUp || 0;
    if(name === 'th' || name === 'dh'){ if(tip < .55) fail(name, 'the dental has no tongue tip'); }
    else if(tip > .2) fail(name, 'only the dentals carry the tip forward', tip);
    if(tip + up > 1.05) fail(name, 'tongue weights compound past a full pull', tip, up);
    if((spec.mus.orbOris || 0) > .35 && (spec.mus.ris || 0) > .35) fail(name, 'a phone both rounds and spreads');
  }
  if(pulled.length) fail('expression muscles in speech', pulled.join(' '));
  else console.log('ok no phone pulls zyg, zygMin, lao, dao, or orbOc; the tip is forward only on the dentals');

  /* ---- speech's own motion, as the page plays it (speechMotion): each class's blend read its lag ahead, one critically
     damped filter on every channel and the jaw, at 16 ms ---- */
  const KEYS = ['ris', 'bucc', 'orbOris', 'lipPress', 'ment', 'ulr', 'dli', 'nasal', 'nasTrans', 'incSup', 'incInf', 'lipTuck', 'tongueUp', 'tongueOut'];
  function played(phones, rate, art){
    const segs = spans(phones);
    const total = segs.length ? segs[segs.length - 1].t1 : 0;
    const dt = 16, sec = dt / 1000;
    const act = {}, vel = {};
    let jaw = 0, ms = -speechPreroll() * rate;
    const frames = [];
    const saved = SPEECH.art, savedC = RATEC; SPEECH.art = art; RATEC = Math.pow(rate, -.55);
    const REL = {lipPress:1.5, lipTuck:1.5, tongueUp:1.5, tongueOut:1.5};   // the muscles' own rel, capped at SPEECH_REL_MAX: a contact lets go faster
    const step = (x, v, tg, w) => { const e = Math.exp(-w * sec), y = x - tg, c = v + w * y; return [tg + (y + c * sec) * e, (v - w * c * sec) * e]; };
    let jv = 0;
    for(let t = 0; t <= total / rate + 80 + speechPreroll(); t += dt){
      ms += dt * rate;
      const play = speechTargetAt(phones, segs, ms, rate, total), at = play.at;
      for(const k of KEYS){
        if(!(k in act)){ act[k] = 0; vel[k] = 0; }
        const rl = REL[k] && (play.mus[k] || 0) < act[k] ? REL[k] : 1;
        [act[k], vel[k]] = step(act[k], vel[k], play.mus[k] || 0, speechOmega(SPEECH_CLASS_OF[k] || SPEECH_MOTION.base) * rl);
      }
      [jaw, jv] = step(jaw, jv, play.jaw || 0, speechOmega(SPEECH_MOTION.jaw));
      frames.push({ms, jaw, a:{...act}, label:at.label});
    }
    SPEECH.art = saved; RATEC = savedC;
    return {segs, frames, total};
  }
  const centre = (run, name, i) => { const seg = run.segs.filter(s => s.name === name)[i || 0]; return {seg, fr:run.frames.reduce((b, f) => Math.abs(f.ms - seg.mid) < Math.abs(b.ms - seg.mid) ? f : b)}; };
  const peak = (run, k) => run.frames.reduce((m, f) => Math.max(m, f.a[k] || 0), 0);
  /* the opening the mouth makes, in px: the jaw's drop plus the gap a pucker holds open while the
     jaw stays shut. A word stalls when this clamps shut in the middle of it. */
  const opening = f => mouthGap(f.jaw, f.a.orbOris, f.a);
  const minOpen = run => run.frames.filter(f => f.ms >= 0 && f.ms <= run.total).reduce((m, f) => Math.min(m, opening(f)), 1e9);   // the word itself: before and after it the mouth is at rest
  const at1 = w => played(textToPhones(w), 1, 1);

  /* the blend's own claim: at a consonant's centre the consonant's channel leads, and the vowel's
     anticipation is nevertheless already there */
  const who = at1('who'), hh = centre(who, 'hh'), uw = centre(who, 'uw');
  let tg = blendAt(who.segs.map(s => s.name), hh.seg.mid, who.segs);
  if(tg.label !== 'hh') fail('who midpoint label', tg.label);
  if((tg.shape.mus.orbOris || 0) < .15) fail('who anticipation gone', tg.shape.mus);
  if((tg.shape.mus.orbOris || 0) > .8 * blendAt(who.segs.map(s => s.name), uw.seg.mid, who.segs).shape.mus.orbOris) fail('who consonant centre is the vowel');
  else console.log('ok who /hh/ orbOris', n3(tg.shape.mus.orbOris), '→ vowel', n3(blendAt(who.segs.map(s => s.name), uw.seg.mid, who.segs).shape.mus.orbOris),
    'arrived', n3(hh.fr.a.orbOris), '→', n3(uw.fr.a.orbOris));
  const see = at1('see'), sc = centre(see, 's'), iy = centre(see, 'iy');
  tg = blendAt(see.segs.map(s => s.name), sc.seg.mid, see.segs);
  if(tg.label !== 's') fail('see midpoint label', tg.label);
  if((tg.shape.mus.ris || 0) <= (PHONE.s.mus.ris || 0)) fail('see spread is not anticipating', tg.shape.mus);
  if((tg.shape.mus.ris || 0) > .85 * (blendAt(see.segs.map(s => s.name), iy.seg.mid, see.segs).shape.mus.ris || 0)) fail('see consonant centre is the vowel');
  else console.log('ok see /s/ ris', n3(tg.shape.mus.ris), '→ vowel', n3(blendAt(see.segs.map(s => s.name), iy.seg.mid, see.segs).shape.mus.ris));

  /* a bilabial closes the lips and the vowel after it opens them: the page forces the lips together
     only while lipPress is high and the jaw is shut, so the arrived press and jaw at the vowel's
     centre have to leave a real aperture. Aperture in px: a jaw of 1 is a 150px drop. */
  const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const closure = fr => { const x = Math.min(1, Math.max(0, ((fr.a.lipPress || 0) - .08) / .42)); return x * x * (3 - 2 * x) * (1 - sm(.1, .3, fr.jaw)); };   // MOUTH.PRESS: the page's own closure curve, a smoothstep
  for(const word of ['papa', 'mama', 'baby', 'bobby', 'pop']){
    const run = at1(word), out = [];
    run.segs.forEach((seg, i) => {
      const fr = centre(run, seg.name, run.segs.slice(0, i).filter(s => s.name === seg.name).length).fr, cl = closure(fr), ap = fr.jaw * 150 * (1 - cl);
      if('pbm'.includes(seg.name) && i < run.segs.length - 1){
        out.push(seg.name + ' closure ' + n3(cl));
        if(cl < .85) fail(word, seg.name, 'bilabial does not close at its centre', n3(cl));
      }
      if(PHONE[seg.name].A >= 18 && i && 'pbm'.includes(run.segs[i - 1].name)){
        out.push(seg.name + ' aperture ' + Math.round(ap) + 'px');
        if(ap < 17) fail(word, seg.name, 'vowel after a bilabial has not opened', Math.round(ap), 'px, closure', n3(cl));
      }
    });
    console.log('ok p-V-p release', word.padEnd(6), run.segs.map(s => s.name).join(' '), '|', out.join(', '));
  }

  /* what must arrive by the phone's own centre, at the reading rate the page ships with */
  const VIEW_ART = Math.round((.5 + .65 * (1.8 - .5)) * 20) / 20;
  for(const word of ['three', 'fife', 'fifty', 'teeth', 'do', 'forty', 'see', 'who', 'moon', 'baby', 'please']){
    const run = played(textToPhones(word), 3, VIEW_ART);
    console.log('rate 3  ' + word.padEnd(8) + textToPhones(word).join(' ').padEnd(22) + ' minOpen ' + Math.round(minOpen(run)) + 'px  press ' + n3(peak(run, 'lipPress')));
    /* /f v/ keep the jaw shut on purpose — their opening is the lower lip tucked off the teeth —
       so the stall check is for words where a vowel's own gesture has to carry the opening. */
    /* At the top of the rate slider the small openings narrow to a few pixels: a 9px stop or a 13px
       labiodental is a tenth of a full jaw, and the springs cannot hold a tenth of anything through
       a 70ms phone. What is asserted is that the lips never seal except where the sound seals them
       — the bilabials — and the number is printed so the behaviour is visible rather than claimed. */
    const sealed = minOpen(run) < .8;
    if(sealed && !/[pbm]/.test(textToPhones(word).join(''))) fail(word, 'the mouth seals in the middle of the word', n3(minOpen(run)) + 'px');
    if(word === 'fife' && peak(run, 'lipTuck') < .45) fail('fife at rate 3 never tucks', n3(peak(run, 'lipTuck')));
    if(word === 'fifty' && peak(run, 'lipTuck') < .45) fail('fifty at rate 3 never tucks', n3(peak(run, 'lipTuck')));
    if(word === 'teeth' && peak(run, 'tongueOut') < .35) fail('teeth at rate 3 never carries the tip forward', n3(peak(run, 'tongueOut')));
    /* At rate 3 a bilabial is about 70ms long and the press's own spring needs about 200ms to
       arrive, so the closure softens with speed. What is asserted is that it still rises. */
    if('pbm'.includes(textToPhones(word)[0]) && peak(run, 'lipPress') < .28) fail(word, 'the opening labial never pressed', n3(peak(run, 'lipPress')));
    if(word === 'moon' && peak(run, 'orbOris') < .5) fail('moon at rate 3 never rounds', n3(peak(run, 'orbOris')));
    if(word === 'see' && peak(run, 'ris') < .35) fail('see at rate 3 never spreads', n3(peak(run, 'ris')));
  }

  /* the playback window must agree with the full blend */
  const hw = textToPhones('hello world, this is a test'), hs = spans(hw);
  let wd = 0;
  for(let t = 0; t < hs[hs.length - 1].t1; t += 37){
    const a = blendAt(hw, t), b = blendAt(hw, t, hs, 9);
    wd = Math.max(wd, Math.abs(a.shape.jaw - b.shape.jaw));
    for(const k of new Set([...Object.keys(a.shape.mus), ...Object.keys(b.shape.mus)])) wd = Math.max(wd, Math.abs((a.shape.mus[k] || 0) - (b.shape.mus[k] || 0)));
  }
  if(wd > .03) fail('windowed blend drifts from the full blend', n3(wd));
  else console.log('ok windowed blend within', n3(wd));

  const src = speakText.toString() + '\n' + speechFrame.toString() + '\n' + speechShape.toString();
  if(/expr\s*\.\s*w/.test(src)) fail('expr.w still referenced in playback');
  else console.log('ok playback does not duck expr.w');
  if(/\.talking\s*=/.test(src)) fail('playback sets talking');
  else console.log('ok playback does not set talking');
  if(/vJaw|SHUT/.test(src)) fail('a word-carry is still laid over the blend');
  else console.log('ok nothing is carried from a word onto a consonant: the blend is the coarticulation');

  console.log('dominance c=' + C, 'unclaimed=' + UNCLAIMED);
  for(const [name, d] of Object.entries(DOM)) console.log(' ', name.padEnd(8), 'α=' + d.alpha, 'θ=' + d.theta, 'φ=' + d.phi);
  if(!process.exitCode) console.log('speech checks passed — the drawn-mouth rules live in tools/mouth-lab.mjs');
}
