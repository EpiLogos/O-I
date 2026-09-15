import { esc } from "./icons.mjs";
import { clone } from "./model.mjs";
function stateSource(e, index) {
  return e.sequence.steps[index]?.source ?? (!e.sequence.sourcesVersion && index === 0 ? e.source : void 0);
}
function stateLabel(s) {
  return s.name || (s.source?.kind === "image" ? s.source.image.name || "Image glyph" : s.source?.kind === "ascii" ? "ASCII glyph" : s.shape === "text" ? s.text : s.shape);
}
function initialiseSources(j) {
  for (const scene of [...j.scenes, ...Object.values(j.savedScenes ?? {})]) for (const e of scene.entities) {
    if (!e.sequence.sourcesVersion && e.source && e.sequence.steps[0] && !e.sequence.steps.some((k) => k.source)) {
      e.sequence.steps[0].source = clone(e.source);
      e.sequence.steps[0].name = e.source.kind === "image" ? e.source.image.name || e.name : e.name;
    }
    if (e.source) e.sequence.sourcesVersion = 1;
  }
  return j;
}
function captureObjectState(e) {
  return { id: "", name: e.name, text: e.text, shape: e.shape, source: e.source ? clone(e.source) : void 0, yantraId: e.yantraId, templateFrequency: e.templateFrequency, templateGeometry: e.templateGeometry, templateDimension: e.templateDimension, hold: e.sequence.hold ?? 3, transition: e.sequence.transition ?? 1, position: null, objectState: { size: clone(e.size), rotation: e.rotation, scale: e.scale ?? 1, tint: e.tint, tintWeight: e.tintWeight, force: clone(e.force) } };
}
function stateThumbnail(e, index) {
  const k = e.sequence.steps[index], source = stateSource(e, index);
  return source ? `<img data-source-preview="${esc(e.id)}" data-source-step="${index}" alt="${esc(stateLabel({ ...k, source }))}">` : esc(k?.shape === "text" ? k.text : k?.shape ?? e.text);
}
function setStateSource(e, index, source) {
  const k = e.sequence.steps[index];
  if (!k) throw new Error("Choose a sequence state first.");
  e.sequence.sourcesVersion = 1;
  k.source = source ? clone(source) : void 0;
  k.name = source?.kind === "image" ? source.image.name : source ? "ASCII glyph" : void 0;
  if (index === 0 || !e.sequence.enabled && !e.sequence.manual) e.source = source ? clone(source) : void 0;
}
function transformObjectStates(e, path, before, after) {
  const key = path.replace(/^entity\./, "");
  if (!/^(size\.[xy]|rotation|scale|tint|tintWeight|force\.(strength|spin|radius|kind))$/.test(key)) return;
  const parts = key.split(".");
  for (const step of e.sequence.steps) {
    if (!step.objectState) continue;
    const root = step.objectState, target = parts.length > 1 ? root[parts[0]] : root, leaf = parts.at(-1);
    if (typeof after === "number" && typeof before === "number" && typeof target[leaf] === "number") {
      const relative = key.startsWith("size.") || key === "scale" || key === "force.radius";
      target[leaf] = relative && before !== 0 ? target[leaf] * after / before : target[leaf] + after - before;
      if (key === "tintWeight") target[leaf] = Math.max(0, Math.min(1, target[leaf]));
    } else target[leaf] = after;
  }
}
export {
  captureObjectState,
  initialiseSources,
  setStateSource,
  stateLabel,
  stateSource,
  stateThumbnail,
  transformObjectStates
};
