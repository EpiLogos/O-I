import { esc } from "./icons.mjs";
import { clone, uid } from "./model.mjs";
function preserveLayerStates(e) {
  if (e.layers?.length) for (const step of e.sequence.steps) step.layers ??= e.layers.map((l) => ({ ...clone(l), id: uid("layer") }));
}
function useStateShape(e, index) {
  preserveLayerStates(e);
  if (e.sequence.steps[index]) e.sequence.steps[index].layers = [];
}
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
  return { id: "", name: e.name, text: e.text, shape: e.shape, source: e.source ? clone(e.source) : void 0, yantraId: e.yantraId, templateFrequency: e.templateFrequency, templateGeometry: e.templateGeometry, templateDimension: e.templateDimension, hold: e.sequence.hold ?? 3, transition: e.sequence.transition ?? 1, position: null, objectState: { normalized: e.native ? e.native.extent?.normalized ?? !!e.native.extent : true, size: clone(e.size), rotation: e.rotation, scale: e.scale ?? 1, tint: e.tint, tintWeight: e.tintWeight, force: clone(e.force) } };
}
function stateThumbnail(e, index) {
  const k = e.sequence.steps[index], source = stateSource(e, index);
  return source ? `<img data-source-preview="${esc(e.id)}" data-source-step="${index}" alt="${esc(stateLabel({ ...k, source }))}">` : k?.shape && k.shape !== "text" ? shapeMark(k.shape) : esc(k?.shape === "text" ? k.text : e.text);
}
function shapeMark(shape) {
  const d = { disc: '<circle cx="12" cy="12" r="8" fill="currentColor"/>', ring: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/>', square: '<rect x="5" y="5" width="14" height="14" fill="currentColor"/>', triangle: '<path d="M12 4 20 19H4Z" fill="currentColor"/>', yantra: '<path d="M12 4 20 18H4Z M12 20 4 6h16Z" fill="none" stroke="currentColor" stroke-width="1.4"/>', cymatic: '<path d="M3 12c3-7 6-7 9 0s6 7 9 0" fill="none" stroke="currentColor" stroke-width="1.6"/>' };
  return `<svg class="shape-mark" viewBox="0 0 24 24" aria-label="${esc(shape)}" role="img">${d[shape] ?? `<text x="12" y="16" text-anchor="middle" font-size="9" fill="currentColor">${esc(shape)}</text>`}</svg>`;
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
  preserveLayerStates,
  setStateSource,
  stateLabel,
  stateSource,
  stateThumbnail,
  transformObjectStates,
  useStateShape
};
