import { esc } from "./icons.mjs";
import { TRANSITION_KINDS, WIPE_DIRECTIONS, DIP_AT_MIN, DIP_AT_MAX, DIP_AT_DEFAULT, SWITCH_MODES, CURVE_TYPES } from "../engine/transitionMath.mjs";
import { validateCurveEdit, valueAt } from "./propertyTracks.mjs";
import { laneFrame, toPixel, handlePosition, samplePath, moveHandle, PATH_SPACE } from "./curveLane.mjs";
import { TRANSITION_KINDS as TRANSITION_KINDS2, WIPE_DIRECTIONS as WIPE_DIRECTIONS2, DIP_AT_MIN as DIP_AT_MIN2, DIP_AT_MAX as DIP_AT_MAX2, DIP_AT_DEFAULT as DIP_AT_DEFAULT2, SWITCH_MODES as SWITCH_MODES2, CURVE_TYPES as CURVE_TYPES2, dipWeights, wipeHoldRect, paintedPassParams, srgbUnit, renderTargetAction, transitionColourOf, holdFit, holdSampleUv, compositeMirror } from "../engine/transitionMath.mjs";
const _curveVocabularyIsE08 = true;
const PARAMS = { cut: ["switchMode"], crossfade: ["switchMode", "curve"], "dip-to-colour": ["at", "switchMode", "curve"], wipe: ["direction", "switchMode", "curve"] };
const SWITCH_LABEL = { immediate: "Immediate", sync: "Sync", "at-end": "At end" };
const CURVE_LABEL = { linear: "Linear", hold: "Hold", smooth: "Smooth", bezier: "Bezier" };
function switchLabel(mode) {
  return SWITCH_LABEL[mode];
}
function curveLabel(type) {
  return CURVE_LABEL[type];
}
function switchModeOf(spec) {
  return spec?.switchMode ?? "immediate";
}
function curveOf(spec) {
  return spec?.curve;
}
function curveProgress(curve, fraction) {
  const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  if (!curve || curve.type === "linear") return f;
  return valueAt([{ time: 0, value: 0, type: curve.type, out: curve.out }, { time: 1, value: 1, in: curve.in }], f) ?? f;
}
function validateTransitionCurve(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("A transition curve must be an object with a type.");
  const v = value, type = v.type;
  if (typeof type !== "string" || !CURVE_TYPES.includes(type)) throw new Error(`Unknown transition curve ${JSON.stringify(String(type).slice(0, 40))}. Choose linear, hold, smooth or bezier.`);
  for (const key of Object.keys(v)) if (key !== "type" && key !== "out" && key !== "in") throw new Error(`A transition curve takes no ${key} parameter.`);
  const t = type;
  if (t !== "bezier" && (v.out !== void 0 || v.in !== void 0)) throw new Error("Only a bezier curve takes handles.");
  const out = v.out, inn = v.in;
  validateCurveEdit([{ time: 0, value: 0, type: t, out }, { time: 1, value: 1, in: inn }], { min: 0, max: 1 }, [{ key: 0 }, { key: 1 }, { handle: 0, end: "out" }, { handle: 1, end: "in" }]);
  if (t === "linear") return void 0;
  const curve = { type: t };
  if (out !== void 0) curve.out = { dt: out.dt, dv: out.dv };
  if (inn !== void 0) curve.in = { dt: inn.dt, dv: inn.dv };
  return curve;
}
const KIND_LABEL = { cut: "Cut", crossfade: "Crossfade", "dip-to-colour": "Dip to colour", wipe: "Wipe" };
const DIRECTION_LABEL = { left: "Wipe left", right: "Wipe right", up: "Wipe up", down: "Wipe down" };
function transitionKindOf(spec) {
  return spec?.kind ?? "crossfade";
}
function kindLabel(kind) {
  return KIND_LABEL[kind];
}
function transitionLabel(kind) {
  return `Set transition ${kind}`;
}
function validateTransitionSpec(value) {
  if (value === void 0) return void 0;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("A scene transition must be an object with a kind.");
  const v = value, kind = v.kind;
  if (typeof kind !== "string" || !TRANSITION_KINDS.includes(kind)) throw new Error(`Unknown transition kind ${JSON.stringify(String(kind).slice(0, 40))}. Choose cut, crossfade, dip-to-colour or wipe.`);
  const k = kind;
  for (const key of Object.keys(v)) if (key !== "kind" && !PARAMS[k].includes(key)) throw new Error(`Transition ${k} takes no ${key} parameter.`);
  const out = { kind: k };
  if (v.at !== void 0) {
    if (typeof v.at !== "number" || !Number.isFinite(v.at) || v.at < DIP_AT_MIN || v.at > DIP_AT_MAX) throw new Error(`Dip to colour reaches its colour between ${DIP_AT_MIN} and ${DIP_AT_MAX} of the transition.`);
    out.at = v.at;
  }
  if (v.direction !== void 0) {
    if (!WIPE_DIRECTIONS.includes(v.direction)) throw new Error("A wipe runs left, right, up or down.");
    out.direction = v.direction;
  }
  if (v.switchMode !== void 0) {
    if (typeof v.switchMode !== "string" || !SWITCH_MODES.includes(v.switchMode)) throw new Error(`Unknown switch mode ${JSON.stringify(String(v.switchMode).slice(0, 40))}. Choose immediate, sync or at-end.`);
    if (v.switchMode !== "immediate") out.switchMode = v.switchMode;
  }
  if (v.curve !== void 0) {
    const curve = validateTransitionCurve(v.curve);
    if (curve) out.curve = curve;
  }
  if (k === "crossfade" && out.switchMode === void 0 && out.curve === void 0) return void 0;
  return out;
}
function transitionSpecFor(kind, params = {}) {
  const raw = { kind };
  if (params.at !== void 0) raw.at = params.at;
  if (params.direction !== void 0) raw.direction = params.direction;
  if (params.switchMode !== void 0) raw.switchMode = params.switchMode;
  if (params.curve !== void 0) raw.curve = params.curve;
  return validateTransitionSpec(raw);
}
function edgeFactsOf(spec) {
  return { switchMode: spec?.switchMode, curve: spec?.curve };
}
function specWithEdge(spec, edge) {
  const base = { kind: transitionKindOf(spec) };
  if (spec?.at !== void 0) base.at = spec.at;
  if (spec?.direction !== void 0) base.direction = spec.direction;
  const switchMode = "switchMode" in edge ? edge.switchMode : spec?.switchMode;
  const curve = "curve" in edge ? edge.curve : spec?.curve;
  if (switchMode !== void 0) base.switchMode = switchMode;
  if (curve !== void 0 && base.kind !== "cut") base.curve = curve;
  return validateTransitionSpec(base);
}
const GLYPH = {
  cut: '<rect x="2.5" y="3" width="4.5" height="10" rx="1"/><rect x="9" y="3" width="4.5" height="10" rx="1"/>',
  crossfade: '<circle cx="6" cy="8" r="4.5"/><circle cx="10" cy="8" r="4.5"/>',
  "dip-to-colour": '<path d="M2.5 3.5 8 10l5.5-6.5"/><path d="M2.5 13.5h11"/>',
  wipe: '<rect x="2.5" y="3" width="11" height="10" rx="1"/><path d="M7.5 3v10"/>'
};
const ARROW = { left: "M13 8H3M6 5 3 8l3 3", right: "M3 8h10M10 5l3 3-3 3", up: "M8 13V3M5 6l3-3 3 3", down: "M8 3v10M5 10l3 3 3-3" };
const svg = (body) => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
function transitionGlyph(kind) {
  return svg(GLYPH[kind]);
}
function directionGlyph(direction) {
  return svg(`<path d="${ARROW[direction]}"/>`);
}
function seamGlyphHTML(scene, leftPercent) {
  const kind = transitionKindOf(scene.transitionSpec), label = `${kindLabel(kind)} into ${scene.name}`;
  return `<button type="button" class="seam-glyph" data-action="seam-transition" data-scene-id="${esc(scene.id)}" style="left:${leftPercent.toFixed(3)}%" aria-label="${esc(label)}" title="${esc(label)}">${transitionGlyph(kind)}</button>`;
}
function edgeBlend(spec, fraction) {
  const curve = curveOf(spec);
  if (!curve || curve.type === "linear") return { progress: fraction, blend: fraction * fraction * (3 - 2 * fraction) };
  const progress = curveProgress(curve, fraction);
  return { progress, blend: progress };
}
const TRANSITION_LANE = { duration: 1, range: { min: 0, max: 1 } };
function curvePointsOf(curve) {
  const start = { time: 0, value: 0, type: "bezier" }, end = { time: 1, value: 1 };
  if (curve.out) start.out = { dt: curve.out.dt, dv: curve.out.dv };
  if (curve.in) end.in = { dt: curve.in.dt, dv: curve.in.dv };
  return [start, end];
}
function transitionCurveHandleEdit(curve, index, end, time, value) {
  try {
    const points = moveHandle(curvePointsOf(curve), index, end, time, value);
    validateCurveEdit(points, TRANSITION_LANE.range, [{ handle: index, end }]);
    const next = { type: "bezier" };
    if (points[0].out) next.out = points[0].out;
    if (points[1].in) next.in = points[1].in;
    const valid = validateTransitionCurve(next);
    if (!valid) throw new Error("A bezier curve keeps its handles.");
    return { ok: true, curve: valid };
  } catch (cause) {
    return { ok: false, reason: cause instanceof Error ? cause.message : String(cause) };
  }
}
function curveGestureWrite(base, preview, ended) {
  if (!ended.commit || !ended.moved || ended.refused || !preview) return void 0;
  return JSON.stringify(preview) === JSON.stringify(base) ? void 0 : preview;
}
function seamCurveLaneHTML(scene, curve) {
  const points = curvePointsOf(curve), frame = laneFrame(points, TRANSITION_LANE.duration, TRANSITION_LANE.range, 100, 100), id = esc(scene.id);
  const keys = points.map((p) => {
    const q = toPixel(frame, p.time, p.value);
    return `<span class="curve-key" style="left:${q.x.toFixed(3)}%;top:${q.y.toFixed(3)}%" aria-hidden="true"></span>`;
  }).join("");
  const handles = [[0, "out"], [1, "in"]].map(([index, end]) => {
    const c = handlePosition(points, index, end), q = toPixel(frame, c.x, c.y);
    return `<span class="curve-handle curve-handle-${end}" data-handle-index="${index}" data-end="${end}" style="left:${q.x.toFixed(3)}%;top:${q.y.toFixed(3)}%" aria-hidden="true"></span>`;
  }).join("");
  return `<div class="seam-curve" data-seam-curve data-scene-id="${id}" role="group" aria-label="${esc(`Bezier curve into ${scene.name}`)}" title="Drag a handle to shape the blend"><svg class="curve-svg" viewBox="0 0 ${PATH_SPACE} ${PATH_SPACE}" preserveAspectRatio="none" aria-hidden="true"><path d="${samplePath(points, frame)}"/></svg>${keys}${handles}</div>`;
}
function seamEdgeHTML(scene, spec, preview) {
  const id = esc(scene.id), kind = transitionKindOf(spec), mode = switchModeOf(spec), curve = curveOf(spec), type = curve?.type ?? "linear";
  const switchSelect = `<label class="seam-param"><span>Switch</span><select data-edge-switch data-scene-id="${id}" aria-label="${esc(`Switch into ${scene.name}`)}" title="When the switch lands">${SWITCH_MODES.map((m) => `<option value="${m}"${m === mode ? " selected" : ""}>${esc(SWITCH_LABEL[m])}</option>`).join("")}</select></label>`;
  if (kind === "cut") return `<div class="seam-edge" role="group" aria-label="${esc(`Edge into ${scene.name}`)}">${switchSelect}</div>`;
  const curveSelect = `<label class="seam-param"><span>Curve</span><select data-edge-curve data-scene-id="${id}" aria-label="${esc(`Curve into ${scene.name}`)}" title="The blend's curve">${CURVE_TYPES.map((t) => `<option value="${t}"${t === type ? " selected" : ""}>${esc(CURVE_LABEL[t])}</option>`).join("")}</select></label>`;
  const lane = curve && type === "bezier" ? seamCurveLaneHTML(scene, preview ?? curve) : "";
  return `<div class="seam-edge" role="group" aria-label="${esc(`Edge into ${scene.name}`)}">${switchSelect}${curveSelect}${lane}</div>`;
}
function seamChooserHTML(scene, seconds, preview) {
  const spec = scene.transitionSpec, kind = transitionKindOf(spec), id = esc(scene.id), edge = seamEdgeHTML(scene, spec, preview);
  const kinds = TRANSITION_KINDS.map((k) => `<button type="button" class="seam-kind" data-action="set-transition-kind" data-scene-id="${id}" data-kind="${k}" aria-pressed="${k === kind}" aria-label="${esc(kindLabel(k))}" title="${esc(kindLabel(k))}">${transitionGlyph(k)}</button>`).join("");
  const at = spec?.at ?? DIP_AT_DEFAULT;
  const param = kind === "dip-to-colour" ? `<label class="seam-param"><span>Colour reached at</span><input type="range" min="${DIP_AT_MIN}" max="${DIP_AT_MAX}" step=".05" value="${at}" data-transition-at data-scene-id="${id}" aria-valuetext="${Math.round(at * 100)} percent of the transition"></label>` : kind === "wipe" ? `<div class="seam-directions" role="group" aria-label="Wipe direction">${WIPE_DIRECTIONS.map((d) => `<button type="button" data-action="set-transition-direction" data-scene-id="${id}" data-direction="${d}" aria-pressed="${(spec?.direction ?? "left") === d}" aria-label="${esc(DIRECTION_LABEL[d])}" title="${esc(DIRECTION_LABEL[d])}">${directionGlyph(d)}</button>`).join("")}</div>` : "";
  return `<div class="seam-chooser" role="group" aria-label="${esc(`Transition into ${scene.name}`)}"><div class="seam-kinds">${kinds}</div>${param}${edge}<label class="seam-seconds"><span>Seconds</span><input type="number" min="${seconds.min}" max="${seconds.max}" step=".1" value="${scene.transition}" data-transition-seconds data-scene-id="${id}"></label></div>`;
}
function writeSeamTransition(scenes, sceneId, spec, seconds) {
  const s = scenes.find((v) => v.id === sceneId);
  if (!s) throw new Error("That scene is no longer in this expression.");
  const next = specWithEdge(spec, { switchMode: spec?.switchMode ?? s.transitionSpec?.switchMode, curve: spec?.curve ?? s.transitionSpec?.curve });
  if (next) s.transitionSpec = next;
  else delete s.transitionSpec;
  s.transition = seconds;
}
function seamEdgeSpec(spec, edit) {
  const picked = edit.curve, current = curveOf(spec), seeded = picked && picked.type === "bezier" && !picked.out && !picked.in ? current?.type === "bezier" ? current : BEZIER_SEED : picked;
  return specWithEdge(spec, { ..."switchMode" in edit ? { switchMode: edit.switchMode } : {}, ..."curve" in edit ? { curve: seeded } : {} });
}
const BEZIER_SEED = { type: "bezier", out: { dt: 1 / 3, dv: 0 }, in: { dt: -1 / 3, dv: 0 } };
function edgeEditRefusal(spec, edit) {
  if (edit.kind === "curve" && transitionKindOf(spec) === "cut") return "A cut has no curve.";
  return void 0;
}
function pendingSwitchStillWaits(frame) {
  return frame.scene_playing || frame.completed || frame.advance_to_scene_index !== null || frame.unavailable_reason !== null;
}
function writeLoopExit(scenes, sceneId, on) {
  const s = scenes.find((v) => v.id === sceneId);
  if (!s) throw new Error("That scene is no longer in this expression.");
  if (on) s.breakAtEnd = true;
  else delete s.breakAtEnd;
}
function edgeEditLabel(edit) {
  if (edit.kind === "switch") return `Set transition switch ${switchLabel(edit.mode).toLowerCase()}`;
  if (edit.kind === "curve") return `Set transition curve ${curveLabel(edit.type).toLowerCase()}`;
  return edit.on ? "Set loop exit at end" : "Clear loop exit";
}
function isPaintedKind(kind) {
  return kind === "dip-to-colour" || kind === "wipe";
}
function paintedOverlayActive(spec, fraction) {
  return !!spec && isPaintedKind(spec.kind) && fraction >= 0 && fraction < 1;
}
export {
  BEZIER_SEED,
  CURVE_TYPES2 as CURVE_TYPES,
  DIP_AT_DEFAULT2 as DIP_AT_DEFAULT,
  DIP_AT_MAX2 as DIP_AT_MAX,
  DIP_AT_MIN2 as DIP_AT_MIN,
  SWITCH_MODES2 as SWITCH_MODES,
  TRANSITION_KINDS2 as TRANSITION_KINDS,
  TRANSITION_LANE,
  WIPE_DIRECTIONS2 as WIPE_DIRECTIONS,
  compositeMirror,
  curveGestureWrite,
  curveLabel,
  curveOf,
  curvePointsOf,
  curveProgress,
  dipWeights,
  directionGlyph,
  edgeBlend,
  edgeEditLabel,
  edgeEditRefusal,
  edgeFactsOf,
  holdFit,
  holdSampleUv,
  isPaintedKind,
  kindLabel,
  paintedOverlayActive,
  paintedPassParams,
  pendingSwitchStillWaits,
  renderTargetAction,
  seamChooserHTML,
  seamCurveLaneHTML,
  seamEdgeSpec,
  seamGlyphHTML,
  specWithEdge,
  srgbUnit,
  switchLabel,
  switchModeOf,
  transitionColourOf,
  transitionCurveHandleEdit,
  transitionGlyph,
  transitionKindOf,
  transitionLabel,
  transitionSpecFor,
  validateTransitionCurve,
  validateTransitionSpec,
  wipeHoldRect,
  writeLoopExit,
  writeSeamTransition
};
