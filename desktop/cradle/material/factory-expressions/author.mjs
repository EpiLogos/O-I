// Factory Expressions — curated starter material (FX-C4; contract
// docs/contracts/EXPRESSION-ACT-MATERIAL-V1.md §1).
//
// Authors the reusable `oi.expression/v1` documents in this directory with
// the Expressions application's own authoring vocabulary: every Scene is the
// app's journey Scene (model.ts `blankScene`/`entity`, validated by
// `validateJourney` in tests/factory-expressions-material.test.mjs), carried
// in its native Scene as `oi.journey-scene/v1` presentation. Bodies are
// glyph, ASCII, yantra and cymatic forms with compound layers; states and
// gestures are entity sequences (morph steps with per-step object state,
// easing, hold/transition); movement from A to B is a ramp automation lane;
// the field carries its forces, palette, material, morph clock and
// resonance. Role slots carry `role` on the entity or text layer (§1: one
// role mechanism); `reuse` indexes them.
//
// Regenerate: node material/factory-expressions/author.mjs   (from desktop/cradle)
// The JSON files are the deliverable; this script is how they were authored.
import {register} from "node:module";
import {mkdirSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

register("../../tests/ts-transpile-hook.mjs", import.meta.url);
const M = await import("../../expressions-app/field-studies-journeys/src/model.ts");
const HERE = dirname(fileURLToPath(import.meta.url));
const AUTHOR = "agent:factory-expressions-lane-c";

// ---------------------------------------------------------------------------
// Document scaffolding (kernel composition law: expression-local refs; the
// Scene material's id/name are its native scene ref/title; every entity in
// the material is a native occurrence of that Scene)
// ---------------------------------------------------------------------------

function documentOf({slug, title, description, loop = true, scenes, reuse}) {
  const expressionRef = `expression:fx-${slug}`;
  const doc = {
    schema: "oi.expression/v1", expression_ref: expressionRef, revision: 1, title,
    presentation: {schema: "oi.journey-properties/v1", description, loop},
    scenes: [], entities: {}, relations: {},
    selection: {scene_ref: "", entity_ref: null},
    provenance: [{ref: "oi:desktop/cradle/material/factory-expressions", revision: "curated-2026-09-26", availability: "available"}],
    representations: [], refinements: [], collections: ["factory-expressions"],
  };
  const sceneRef = key => `${expressionRef}:scene:${key}`;
  const entityRef = key => `${expressionRef}:entity:${key}`;
  const refs = {scene: sceneRef, entity: entityRef};
  for (const build of scenes) {
    const {key, scene, entityKeys} = build(refs);
    const ref = sceneRef(key);
    scene.id = ref;
    for (const entity of scene.entities) {
      if (!doc.entities[entity.id]) doc.entities[entity.id] = {entity_ref: entity.id, revision: 1, title: entity.name, subject: null, parameters: {}};
    }
    doc.scenes.push({scene_ref: ref, revision: 1, title: scene.name, entity_refs: entityKeys ?? scene.entities.map(entity => entity.id),
      presentation: {schema: "oi.journey-scene/v1", scene}, triggers: []});
  }
  doc.selection.scene_ref = doc.scenes[0].scene_ref;
  doc.reuse = {schema: "oi.expression-reuse/v1", authored_by: AUTHOR, ...reuse(refs)};
  return doc;
}

const scene = (name, character, patch = {}) => {
  const s = M.blankScene(name);
  s.character = character;
  s.text = [];
  Object.assign(s, patch);
  return s;
};
const body = (id, name, text, position, patch = {}) => {
  const e = M.entity(name, text, position);
  e.id = id;
  e.sequence.steps[0].id = `${id.replace(/[^A-Za-z0-9_.:-]/g, "-")}:rest`.slice(0, 150);
  return Object.assign(e, patch);
};
const step = (id, text, shape, hold, transition, objectState, extra = {}) => ({id, text, shape, hold, transition, position: null, ...(objectState ? {objectState} : {}), ...extra});
const state = (size, rotation, tint, tintWeight, force, scale = 1) => ({size, rotation, scale, tint, tintWeight, force});
const text = (id, role, patch) => ({id, visible: true, kicker: "", title: "", italic: "", body: "", x: .08, y: .82, width: 520, size: 22, align: "left", role, ...patch});
const ramp = (id, target, min, max, duration, delay = 0, easing = "smoothstep") =>
  ({id, enabled: true, target, type: "ramp", wave: "smooth", min, max, rate: 1, phase: 0, blend: "replace", duration, delay, loop: "once", firedAt: null, easing});
const lfo = (id, target, min, max, rate, wave = "sine") =>
  ({id, enabled: true, target, type: "lfo", wave, min, max, rate, phase: 0, blend: "replace", duration: 0, delay: 0, loop: "loop", firedAt: null});
const entityTarget = (id, suffix) => `entity:${encodeURIComponent(id)}:${suffix}`;

// ---------------------------------------------------------------------------
// Styles: one Scene grammar, several artistic languages
// ---------------------------------------------------------------------------

const STYLES = {
  // Night field for the expression-development workflow: light collected in
  // the dark, resonant, toroidal drive, morph clock running.
  nocturne: {background: "#12161a", palette: ["#efe6d2", "#9fb7b0", "#d9a36a"], material: "round", engine: {inkMode: "whiteOnBlack", backgroundMode: "ambientGlow", morphEnabled: true, resonanceEnabled: true, trajectory: "toroidalHopf", colorEnabled: true, colorMode: "linearGradient"},
    params: {count: 54000, size: 2.2, opacity: .9, contrast: .82, dispersion: .07, speed: .62, turbulence: .18, halo: .22, densityPhase: 1.7}},
  // Ink on paper for the generic Factory composition.
  ink: {background: "#f3f0e7", palette: ["#23261f", "#5c665a"], material: "ink", engine: {inkMode: "blackOnWhite", backgroundMode: "solid", morphEnabled: false, resonanceEnabled: true, trajectory: "linear"},
    params: {count: 48000, size: 2.4, opacity: .92, contrast: .9, dispersion: .06, speed: .55, turbulence: .14}},
  // Print lattice for the standalone reusable Scenes.
  studio: {background: "#ebe7dc", palette: ["#2a2d33", "#6f7d8c", "#b0643c"], material: "print", engine: {inkMode: "blackOnWhite", backgroundMode: "vignette", morphEnabled: true, resonanceEnabled: true, trajectory: "vortexSpiral"},
    params: {count: 40000, size: 3.2, opacity: .88, contrast: .74, dispersion: .05, speed: .5, turbulence: .12, roundness: .3}},
};
const styled = (s, style) => {
  const st = STYLES[style];
  s.field.background = st.background; s.field.palette = [...st.palette]; s.field.material = st.material;
  Object.assign(s.field.params, st.params); Object.assign(s.engine, st.engine);
  return s;
};

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

const CHARACTERS = {
  anima: {
    title: "Anima — the composer's flame", glyph: "✧", tint: "#d98c5f",
    describe: "A layered star-flame: a ✧ core inside a slow heart-yantra halo. It gathers when idle, spins into a vortex when working, and flickers between ✧ and ❋ when it speaks.",
    layers: [{id: "halo", text: "◌", z: -.12, scale: 1.7}, {id: "core", text: "✦", z: .08, scale: .55}],
    yantra: "anahata", speakGlyph: "❋", skillGlyphs: ["⚘", "✺", "❂"],
  },
  aletheia: {
    title: "Aletheia — the unconcealing lamp", glyph: "◉", tint: "#6fb3c8",
    describe: "An ASCII lamp-eye over an ajna yantra: calm and legible at rest, a resonating cymatic plate when it works, its inscription changing as it speaks.",
    ascii: "  .-^-.  \n (  ◉  ) \n  `-v-'  ", yantra: "ajna", speakGlyph: "◈", skillGlyphs: ["☼", "✶", "◎"],
  },
};

function characterDocument(key, style = "nocturne") {
  const c = CHARACTERS[key];
  const stateScene = (name, character, configure) => refs => {
    const s = styled(scene(name, character), style);
    const self = body(refs.entity("self"), c.title.split(" — ")[0], c.glyph, {x: 0, y: .02, z: 0}, {role: "self", size: {x: .9, y: 1.02}, tint: c.tint, tintWeight: .85});
    if (c.layers) self.layers = c.layers.map(layer => ({...layer}));
    if (c.ascii) self.source = {kind: "ascii", ascii: {text: c.ascii, fontFamily: "Menlo, monospace", fontSize: 64, invert: false}};
    configure(self, s);
    s.entities = [self];
    s.text = [text("t-label", "caption", {kicker: c.title.split(" — ")[0].toUpperCase(), title: name, x: .06, y: .86, size: 18})];
    return {key: name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/-$/, ""), scene: s};
  };
  const idle = stateScene("Idle", `${c.title} at rest: gathered, breathing.`, (self, s) => {
    self.force = {kind: "attract", strength: .35, radius: .5, spin: .04};
    self.sequence = {...self.sequence, enabled: true, clock: "seconds", order: "pingpong", easing: "smoothstep", steps: [
      step(`${key}-idle-a`, c.glyph, "text", 3.5, 2.2, state({x: .9, y: 1.02}, 0, c.tint, .8, {kind: "attract", strength: .35, radius: .5, spin: .04})),
      step(`${key}-idle-b`, c.glyph, "text", 3.5, 2.2, state({x: .98, y: 1.1}, 4, c.tint, .9, {kind: "attract", strength: .45, radius: .56, spin: .06}), {name: "breathe"}),
    ]};
    s.automation = [lfo(`${key}-idle-breath`, "field.halo", .16, .3, .12)];
  });
  const working = stateScene("Working", `${c.title} at work: a turning vortex, the body resonating.`, (self, s) => {
    self.force = {kind: "vortex", strength: 1.1, radius: .42, spin: .9};
    self.shape = c.yantra ? "yantra" : "text"; self.yantraId = c.yantra;
    self.sequence = {...self.sequence, enabled: true, clock: "seconds", order: "loop", easing: "kineticSnap", rateMul: 1.4, steps: [
      step(`${key}-work-a`, c.glyph, "text", 1.2, .8, state({x: .9, y: 1}, 0, c.tint, 1, {kind: "vortex", strength: 1.1, radius: .42, spin: .9})),
      step(`${key}-work-b`, "", "yantra", 1.2, .9, state({x: 1.05, y: 1.05}, 45, c.tint, 1, {kind: "vortex", strength: 1.4, radius: .48, spin: 1.3}), {yantraId: c.yantra, name: "yantra"}),
      step(`${key}-work-c`, "", "cymatic", 1.4, 1, state({x: 1.2, y: 1.2}, 90, c.tint, .9, {kind: "repel", strength: .6, radius: .5, spin: .4}), {templateFrequency: key === "anima" ? 432 : 528, templateGeometry: "circular", templateDimension: "2D", name: "resonance"}),
    ]};
    Object.assign(s.field.params, {speed: .9, turbulence: .26, frequency: key === "anima" ? 432 : 528, excitation: .8});
    s.engine.resonatorMode = "template"; s.engine.templateGeometry = "circular";
    s.resonanceDrive = {kind: "sweep", glideS: 6, dwellS: 2, direction: "pingpong"};
    s.automation = [lfo(`${key}-work-spin`, entityTarget(self.id, "forces.spin"), .6, 1.4, .25)];
  });
  const speaking = stateScene("Speaking", `${c.title} speaking: the inscription flickers between forms.`, (self, s) => {
    self.force = {kind: "repel", strength: .5, radius: .38, spin: .2};
    self.sequence = {...self.sequence, enabled: true, clock: "seconds", order: "loop", easing: "whip", jitter: .15, impulse: .8, steps: [
      step(`${key}-speak-a`, c.glyph, "text", .45, .25, state({x: .95, y: 1.05}, 0, c.tint, 1, {kind: "repel", strength: .5, radius: .38, spin: .2})),
      step(`${key}-speak-b`, c.speakGlyph, "text", .35, .2, state({x: 1.02, y: 1.1}, -6, c.tint, 1, {kind: "repel", strength: .8, radius: .42, spin: .3}), {name: "utter"}),
    ]};
    s.text.push(text("t-speech", "caption", {body: "", italic: "", x: .56, y: .3, width: 380, size: 20}));
    s.automation = [lfo(`${key}-speak-pulse`, "field.excitation", .4, .95, 2.2, "square")];
  });
  const gesture = (name, gestureKey, glyphs, easing) => stateScene(name, `${c.title}: ${name.toLowerCase()} while the current Scene continues.`, (self, s) => {
    self.sequence = {...self.sequence, enabled: true, clock: "seconds", order: "loop", manual: false, easing, impulse: 1.2, steps: [
      step(`${key}-${gestureKey}-0`, c.glyph, "text", .2, .25, state({x: .9, y: 1}, 0, c.tint, 1, {kind: "attract", strength: .6, radius: .4, spin: .2})),
      ...glyphs.map((glyph, i) => step(`${key}-${gestureKey}-${i + 1}`, glyph, "text", .3, .35,
        state({x: 1 + i * .15, y: 1 + i * .15}, 30 * (i + 1), c.tint, 1, {kind: i % 2 ? "repel" : "vortex", strength: 1 + i * .5, radius: .45 + i * .05, spin: 1.2}), {name: `${gestureKey} ${i + 1}`})),
      step(`${key}-${gestureKey}-end`, c.glyph, "text", .5, .6, state({x: .9, y: 1}, 360, c.tint, .85, {kind: "attract", strength: .35, radius: .5, spin: .04})),
    ]};
    s.duration = 4; s.transition = .4;
    s.automation = [ramp(`${key}-${gestureKey}-burst`, "field.excitation", .2, 1, 1.2, 0, "whip")];
  });
  return documentOf({
    slug: `character-${key}`, title: c.title, description: c.describe,
    scenes: [idle, working, speaking, gesture("Invoke skill", "invoke-skill", c.skillGlyphs, "whip"), gesture("Operate", "operate", ["▣", "◇"], "kineticSnap")],
    reuse: refs => ({
      kind: "character", title: c.title,
      roles: [{role: "self", accepts: "agent", entity_ref: refs.entity("self")}, {role: "caption", accepts: "text", text_id: "t-label"}],
      entry_scene_ref: refs.scene("idle"),
      states: {idle: refs.scene("idle"), working: refs.scene("working"), speaking: refs.scene("speaking")},
      gestures: {"invoke-skill": {scene_ref: refs.scene("invoke-skill"), role: "self"}, operate: {scene_ref: refs.scene("operate"), role: "self"}},
      playback: [refs.scene("idle"), refs.scene("working"), refs.scene("speaking")],
      preview_state: "idle",
      associations: {workflow_keys: [], task_types: [], skill_set_refs: [], skill_refs: [], event_families: ["arrival", "activity", "skill-invocation", "tool-operation"]},
    }),
  });
}

// ---------------------------------------------------------------------------
// Scenes (role placeholders with authored placeholder material)
// ---------------------------------------------------------------------------

const agentSlot = (id, role, name, position, glyph = "◯") => body(id, name, glyph, position, {role, size: {x: .62, y: .72}, tint: "#8a7f6c", tintWeight: .5, force: {kind: "attract", strength: .3, radius: .38, spin: .05}});
const objectSlot = (id, role, name, position, glyph, patch = {}) => body(id, name, glyph, position, {role, size: {x: .48, y: .52}, share: .6, ...patch});
const station = (id, name, position, strength = .8) => { const p = M.pin(position); p.id = id; p.name = name; p.force = {kind: "attract", strength, radius: .3, spin: 0}; return p; };

const SCENES = {
  arrival: style => refs => {
    const s = styled(scene("Arrival", "An agent enters the field and takes up the work: its character arrives beside the goal.", {duration: 9, transition: 1.6}), style);
    const self = agentSlot(refs.entity("self"), "self", "Arriving agent", {x: -1.25, y: 0, z: 0});
    const goal = objectSlot(refs.entity("goal"), "goal", "Goal", {x: .55, y: .05, z: 0}, "◎", {shape: "ring", size: {x: .9, y: .9}, tint: "#c9a24e", tintWeight: .8, force: {kind: "vortex", strength: .5, radius: .5, spin: .25}});
    s.entities = [self, goal, station(refs.entity("threshold"), "Threshold", {x: -.35, y: 0, z: 0}, .6)];
    s.text = [text("t-caption", "caption", {kicker: "ARRIVAL", title: "", x: .07, y: .8}), text("t-goal", "goalText", {italic: "", x: .6, y: .2, width: 360, size: 18})];
    s.automation = [ramp("arrive-x", entityTarget(self.id, "x"), -1.25, -.4, 3.2, .2), ramp("arrive-halo", "field.halo", .08, .24, 3)];
    return {key: "arrival", scene: s};
  },
  "work-passage": style => refs => {
    const s = styled(scene("Work passage", "Work moves from A to B: the object travels between stations while its bearer keeps pace.", {duration: 12, transition: 1.2}), style);
    const self = agentSlot(refs.entity("self"), "self", "Working agent", {x: -.9, y: -.28, z: 0});
    const artifact = objectSlot(refs.entity("artifact"), "artifact", "Work object", {x: -.9, y: .12, z: 0}, "▤", {tint: "#6f7d8c", tintWeight: .7});
    artifact.sequence = {...artifact.sequence, enabled: true, order: "loop", easing: "smoothstep", steps: [
      step("work-object-a", "▤", "text", 2, 1.4, state({x: .48, y: .52}, 0, "#6f7d8c", .7, {kind: "attract", strength: .3, radius: .3, spin: 0})),
      step("work-object-b", "▦", "text", 2, 1.4, state({x: .52, y: .56}, 0, "#6f7d8c", .9, {kind: "vortex", strength: .5, radius: .32, spin: .3}), {name: "in progress"}),
    ]};
    const goal = objectSlot(refs.entity("goal"), "goal", "Goal", {x: 1.1, y: .45, z: 0}, "◎", {shape: "ring", size: {x: .5, y: .5}, tint: "#c9a24e", tintWeight: .6});
    s.entities = [self, artifact, goal, station(refs.entity("station-a"), "Station A", {x: -.9, y: .12, z: 0}), station(refs.entity("station-b"), "Station B", {x: .9, y: .12, z: 0})];
    s.text = [text("t-progress", "progressText", {kicker: "IN PROGRESS", x: .07, y: .84})];
    s.automation = [ramp("artifact-a-b", entityTarget(artifact.id, "x"), -.9, .9, 8, .5), ramp("bearer-a-b", entityTarget(self.id, "x"), -.9, .75, 8.4, .8), lfo("passage-turbulence", "field.turbulence", .1, .24, .08)];
    s.composition.focus = "travelling"; s.composition.focusDuration = 6;
    return {key: "work-passage", scene: s};
  },
  handoff: style => refs => {
    const s = styled(scene("Handoff", "A sender passes an artifact to a recipient with a caption: the object crosses between them.", {duration: 10, transition: 1.4}), style);
    const sender = agentSlot(refs.entity("sender"), "sender", "Sender", {x: -.85, y: 0, z: 0});
    const recipient = agentSlot(refs.entity("recipient"), "recipient", "Recipient", {x: .85, y: 0, z: 0});
    const artifact = objectSlot(refs.entity("artifact"), "artifact", "Artifact", {x: -.55, y: .22, z: 0}, "✉", {tint: "#b0643c", tintWeight: .9, force: {kind: "vortex", strength: .7, radius: .26, spin: .8}});
    s.entities = [sender, recipient, artifact];
    s.text = [text("t-caption", "caption", {kicker: "HANDOFF", x: .3, y: .78, width: 560, align: "center"})];
    s.automation = [ramp("handoff-arc-x", entityTarget(artifact.id, "x"), -.55, .55, 4, .6), ramp("handoff-arc-y", entityTarget(artifact.id, "y"), .22, .42, 2, .6, "whip"), ramp("handoff-settle-y", entityTarget(artifact.id, "y"), .42, .2, 2, 2.6)];
    return {key: "handoff", scene: s};
  },
  review: style => refs => {
    const s = styled(scene("Review", "The work is held up to its checks: a resonant plate rings under the artifact; the outcome settles its colour.", {duration: 10, transition: 1.2}), style);
    const lead = agentSlot(refs.entity("lead"), "lead", "Reviewer", {x: -.8, y: -.1, z: 0});
    const artifact = objectSlot(refs.entity("artifact"), "artifact", "Under review", {x: .25, y: .1, z: 0}, "▣", {tint: "#6f7d8c", tintWeight: .8});
    const plate = body(refs.entity("plate"), "Resonant plate", "", {x: .25, y: .1, z: -.1}, {shape: "cymatic", templateFrequency: 396, templateGeometry: "circular", templateDimension: "2D", size: {x: 1.4, y: 1.4}, share: 1.4, tint: "#9fb7b0", tintWeight: .5, force: {kind: "repel", strength: .4, radius: .7, spin: 0}});
    s.entities = [lead, artifact, plate];
    s.text = [text("t-caption", "caption", {kicker: "REVIEW", x: .07, y: .82})];
    Object.assign(s.field.params, {frequency: 396, excitation: .7});
    s.engine.resonatorMode = "template";
    s.resonanceDrive = {kind: "frequency"};
    s.automation = [lfo("review-ring", entityTarget(plate.id, "scale"), .9, 1.12, .5)];
    return {key: "review", scene: s};
  },
  completion: style => refs => {
    const s = styled(scene("Completion", "The cast gathers at the goal; the goal opens and the result is written beneath it.", {duration: 12, transition: 2}), style);
    const goal = objectSlot(refs.entity("goal"), "goal", "Goal", {x: 0, y: .12, z: 0}, "✺", {shape: "yantra", yantraId: "sahasrara", size: {x: 1.1, y: 1.1}, share: 1.6, tint: "#d9a36a", tintWeight: 1, force: {kind: "vortex", strength: .9, radius: .6, spin: .5}});
    const lead = agentSlot(refs.entity("lead"), "lead", "Lead", {x: -.7, y: -.35, z: 0});
    const p0 = agentSlot(refs.entity("participant-0"), "participants.0", "Participant", {x: .7, y: -.35, z: 0});
    const p1 = agentSlot(refs.entity("participant-1"), "participants.1", "Participant", {x: 0, y: -.6, z: 0});
    s.entities = [goal, lead, p0, p1];
    s.text = [text("t-result", "resultText", {kicker: "RETURNED", x: .22, y: .86, width: 640, align: "center"})];
    s.automation = [ramp("completion-bloom", entityTarget(goal.id, "scale"), .7, 1.25, 5, .3), ramp("completion-gather-l", entityTarget(lead.id, "x"), -1.1, -.55, 4), ramp("completion-gather-r", entityTarget(p0.id, "x"), 1.1, .55, 4)];
    s.morph = {...s.morph, law: "beat", depth: 1.4, thetaRate: .12, phiRate: .21};
    return {key: "completion", scene: s};
  },
  explanation: style => refs => {
    const s = styled(scene("Explanation", "One agent explains: it speaks beside the subject while the subject unfolds its layers and the words build up.", {duration: 14, transition: 1.5}), style);
    const lead = agentSlot(refs.entity("lead"), "lead", "Explainer", {x: -.95, y: -.1, z: 0});
    const goal = objectSlot(refs.entity("goal"), "goal", "Subject", {x: .45, y: .12, z: 0}, "◇", {size: {x: .9, y: .9}, share: 1.2, tint: "#9fb7b0", tintWeight: .7,
      layers: [{id: "outer", text: "◯", z: -.1, scale: 1.6}, {id: "inner", text: "·", z: .1, scale: .4}]});
    goal.sequence = {...goal.sequence, enabled: true, order: "loop", easing: "smoothstep", steps: [
      step("subject-closed", "◇", "text", 3, 1.5, state({x: .9, y: .9}, 0, "#9fb7b0", .7, {kind: "attract", strength: .4, radius: .4, spin: .1})),
      step("subject-open", "◈", "text", 3, 1.5, state({x: 1.1, y: 1.1}, 45, "#9fb7b0", .9, {kind: "vortex", strength: .6, radius: .5, spin: .35}), {name: "unfolded"}),
    ]};
    s.entities = [lead, goal];
    s.text = [text("t-caption", "caption", {kicker: "EXPLANATION", x: .07, y: .12, size: 26}), text("t-progress", "progressText", {x: .55, y: .7, width: 420, size: 18})];
    return {key: "explanation", scene: s};
  },
  continuation: style => refs => {
    const s = styled(scene("Continuation", "The same cast returns to the work: the passage runs back through the station it left.", {duration: 10, transition: 1.2}), style);
    const self = agentSlot(refs.entity("self"), "self", "Continuing agent", {x: .8, y: -.2, z: 0});
    const artifact = objectSlot(refs.entity("artifact"), "artifact", "Work object", {x: .8, y: .15, z: 0}, "▤", {tint: "#6f7d8c", tintWeight: .7});
    s.entities = [self, artifact, station(refs.entity("return-station"), "Return station", {x: -.6, y: .15, z: 0})];
    s.text = [text("t-caption", "caption", {kicker: "AGAIN", x: .07, y: .84})];
    s.automation = [ramp("return-x", entityTarget(artifact.id, "x"), .8, -.6, 5, .4), ramp("return-bearer", entityTarget(self.id, "x"), .8, -.4, 5.4, .6)];
    return {key: "continuation", scene: s};
  },
};

const SCENE_ROLES = {
  arrival: [["self", "agent"], ["goal", "object"], ["caption", "text", "t-caption"], ["goalText", "text", "t-goal"]],
  "work-passage": [["self", "agent"], ["artifact", "object"], ["goal", "object"], ["progressText", "text", "t-progress"]],
  handoff: [["sender", "agent"], ["recipient", "agent"], ["artifact", "object"], ["caption", "text", "t-caption"]],
  review: [["lead", "agent"], ["artifact", "object"], ["caption", "text", "t-caption"]],
  completion: [["goal", "object"], ["lead", "agent"], ["participants.0", "agent", undefined, "participant-0"], ["participants.1", "agent", undefined, "participant-1"], ["resultText", "text", "t-result"]],
  explanation: [["lead", "agent"], ["goal", "object"], ["caption", "text", "t-caption"], ["progressText", "text", "t-progress"]],
  continuation: [["self", "agent"], ["artifact", "object"], ["caption", "text", "t-caption"]],
};
const FAMILY = {arrival: ["arrival"], "work-passage": ["activity"], handoff: ["message"], review: ["review"], completion: ["completion"], explanation: [], continuation: ["continuation"]};
const rolesOf = (key, refs) => SCENE_ROLES[key].map(([role, accepts, textId, entityKey]) => ({role, accepts, ...(textId ? {text_id: textId} : {entity_ref: refs.entity(entityKey ?? role)})}));

function sceneDocument(key, style = "studio") {
  const build = SCENES[key](style);
  const title = {arrival: "Arrival", "work-passage": "Work passage (A → B)", handoff: "Handoff", review: "Review", completion: "Completion", explanation: "Explanation", continuation: "Continuation"}[key];
  return documentOf({slug: `scene-${key}`, title, description: `Reusable Scene: ${title}.`, loop: false, scenes: [build],
    reuse: refs => ({kind: "scene", title, roles: rolesOf(key, refs), entry_scene_ref: refs.scene(key), playback: [refs.scene(key)],
      associations: {workflow_keys: [], task_types: [], skill_set_refs: [], skill_refs: [], event_families: FAMILY[key]}})});
}

function skillGestureDocument(style = "studio") {
  const build = refs => {
    const s = styled(scene("Skill invocation", "A skill is invoked: the bearer's body flares through its skill forms while the field rings once.", {duration: 4, transition: .4}), style);
    const self = agentSlot(refs.entity("self"), "self", "Invoking agent", {x: 0, y: 0, z: 0}, "✧");
    self.sequence = {...self.sequence, enabled: true, order: "loop", easing: "whip", impulse: 1.4, steps: [
      step("skill-0", "✧", "text", .2, .2, state({x: .62, y: .72}, 0, "#b0643c", 1, {kind: "attract", strength: .5, radius: .38, spin: .1})),
      step("skill-1", "⚘", "text", .3, .3, state({x: .8, y: .9}, 60, "#b0643c", 1, {kind: "vortex", strength: 1.6, radius: .5, spin: 1.5}), {name: "kindle"}),
      step("skill-2", "", "yantra", .4, .4, state({x: 1.1, y: 1.1}, 120, "#d9a36a", 1, {kind: "repel", strength: 1.2, radius: .6, spin: .6}), {yantraId: "manipura", name: "form"}),
      step("skill-3", "✧", "text", .5, .6, state({x: .62, y: .72}, 360, "#8a7f6c", .6, {kind: "attract", strength: .3, radius: .38, spin: .05}), {name: "settle"}),
    ]};
    s.entities = [self];
    s.text = [text("t-skill", "caption", {kicker: "SKILL", x: .55, y: .25, size: 20})];
    s.automation = [ramp("skill-ring", "field.excitation", .2, 1, 1.4, 0, "whip")];
    return {key: "skill-invocation", scene: s};
  };
  return documentOf({slug: "gesture-skill-invocation", title: "Skill invocation", description: "Reusable gesture: a skill is invoked on the bound object while the current Scene continues.", loop: false, scenes: [build],
    reuse: refs => ({kind: "gesture", title: "Skill invocation", roles: [{role: "self", accepts: "agent", entity_ref: refs.entity("self")}, {role: "caption", accepts: "text", text_id: "t-skill"}],
      entry_scene_ref: refs.scene("skill-invocation"), gestures: {"invoke-skill": {scene_ref: refs.scene("skill-invocation"), role: "self"}, operate: {scene_ref: refs.scene("skill-invocation"), role: "self"}},
      playback: [refs.scene("skill-invocation")],
      associations: {workflow_keys: [], task_types: [], skill_set_refs: [], skill_refs: [], event_families: ["skill-invocation", "tool-operation"]}})});
}

/** A whole workflow Expression: its possible Scenes as named states, its
 * entry state, gestures and playback order (§1 kind "expression"). */
function workflowExpression({slug, title, description, style, workflowKeys, skillRefs = []}) {
  const keys = ["arrival", "work-passage", "handoff", "review", "completion", "continuation", "explanation"];
  const scenes = keys.map(key => SCENES[key](style));
  // The skill gesture lives in the workflow's own material too, so the
  // workflow repertoire performs it without leaving its artistic language.
  scenes.splice(2, 0, refs => {
    const s = styled(scene("Skill invocation", "A skill flares through the bearer while the passage continues.", {duration: 4, transition: .4}), style);
    const self = agentSlot(refs.entity("skill-self"), "self", "Invoking agent", {x: 0, y: 0, z: 0}, "✧");
    self.sequence = {...self.sequence, enabled: true, order: "loop", easing: "whip", impulse: 1.4, steps: [
      step(`${slug}-skill-0`, "✧", "text", .2, .2, state({x: .62, y: .72}, 0, "#d9a36a", 1, {kind: "attract", strength: .5, radius: .38, spin: .1})),
      step(`${slug}-skill-1`, "✺", "text", .3, .3, state({x: .85, y: .95}, 72, "#d9a36a", 1, {kind: "vortex", strength: 1.8, radius: .52, spin: 1.6}), {name: "kindle"}),
      step(`${slug}-skill-2`, "", "cymatic", .5, .4, state({x: 1.2, y: 1.2}, 144, "#efe6d2", 1, {kind: "repel", strength: 1.1, radius: .62, spin: .5}), {templateFrequency: 639, templateGeometry: "circular", templateDimension: "2D", name: "ring"}),
      step(`${slug}-skill-3`, "✧", "text", .5, .6, state({x: .62, y: .72}, 360, "#8a7f6c", .6, {kind: "attract", strength: .3, radius: .38, spin: .05}), {name: "settle"}),
    ]};
    s.entities = [self];
    s.text = [text("t-skill", "caption", {kicker: "SKILL", x: .55, y: .25, size: 20})];
    s.automation = [ramp(`${slug}-skill-ring`, "field.excitation", .2, 1, 1.4, 0, "whip")];
    return {key: "skill-invocation", scene: s};
  });
  return documentOf({slug, title, description, loop: false, scenes,
    reuse: refs => ({
      kind: "expression", title,
      roles: [
        {role: "lead", accepts: "agent", entity_ref: refs.entity("lead")},
        {role: "self", accepts: "agent", entity_ref: refs.entity("self")},
        {role: "sender", accepts: "agent", entity_ref: refs.entity("sender")},
        {role: "recipient", accepts: "agent", entity_ref: refs.entity("recipient")},
        {role: "participants.0", accepts: "agent", entity_ref: refs.entity("participant-0")},
        {role: "participants.1", accepts: "agent", entity_ref: refs.entity("participant-1")},
        {role: "goal", accepts: "object", entity_ref: refs.entity("goal")},
        {role: "artifact", accepts: "object", entity_ref: refs.entity("artifact")},
        {role: "caption", accepts: "text", text_id: "t-caption"},
        {role: "progressText", accepts: "text", text_id: "t-progress"},
        {role: "resultText", accepts: "text", text_id: "t-result"},
      ],
      entry_scene_ref: refs.scene("arrival"),
      states: Object.fromEntries([...keys, "skill-invocation"].map(key => [key, refs.scene(key)])),
      gestures: {"invoke-skill": {scene_ref: refs.scene("skill-invocation"), role: "self"}, operate: {scene_ref: refs.scene("skill-invocation"), role: "self"}},
      playback: ["arrival", "work-passage", "skill-invocation", "handoff", "review", "completion"].map(refs.scene),
      preview_state: "arrival",
      associations: {workflow_keys: workflowKeys, task_types: [], skill_set_refs: [], skill_refs: skillRefs, event_families: ["arrival", "activity", "skill-invocation", "tool-operation", "message", "artifact", "review", "continuation", "completion"]},
    }),
  });
}

// ---------------------------------------------------------------------------

const files = {
  "character/anima.expression.json": characterDocument("anima"),
  "character/aletheia.expression.json": characterDocument("aletheia"),
  "gesture/skill-invocation.expression.json": skillGestureDocument(),
  ...Object.fromEntries(Object.keys(SCENES).map(key => [`scene/${key}.expression.json`, sceneDocument(key)])),
  "expression/expression-development.expression.json": workflowExpression({
    slug: "expression-development", title: "Expression development — the QL-MEF workflow",
    description: "The expression-development workflow performed: agents arrive at the goal, carry the work from A to B, invoke their skills, hand results between them, face review and return — in the nocturne field.",
    style: "nocturne", workflowKeys: ["expression-development"],
    skillRefs: ["skill:anima-expressive-composition", "skill:aletheia-expressive-return", "skill:chronos-act-continuity"],
  }),
  "expression/factory-generic.expression.json": workflowExpression({
    slug: "factory-generic", title: "Factory — generic Run composition",
    description: "The generic Factory composition for any Run without its own workflow material: ink on paper, the same passages.",
    style: "ink", workflowKeys: ["factory:generic"],
  }),
};
for (const [path, doc] of Object.entries(files)) {
  const target = join(HERE, path);
  mkdirSync(dirname(target), {recursive: true});
  writeFileSync(target, `${JSON.stringify(doc, null, 1)}\n`);
}
console.log(JSON.stringify({written: Object.keys(files)}));
