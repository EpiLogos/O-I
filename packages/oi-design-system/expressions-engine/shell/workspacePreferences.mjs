const WORKSPACE_KEY = "oi.workspace.v1";
function defaultWorkspace() {
  return { version: 1, appearance: "scene", entries: [
    { id: "speed", scope: "field", key: "timeScale" },
    { id: "spring", scope: "field", key: "recovery" },
    { id: "viscosity", scope: "field", key: "native_fluid__viscosity" },
    { id: "flow", scope: "field", key: "turbulence" },
    { id: "transition", scope: "selected", key: "sequence.transition" },
    { id: "blend", scope: "field", key: "native_morphProgress" }
  ] };
}
function validateWorkspace(value) {
  const v = value;
  if (!v || v.version !== 1 || !["scene", "dark", "light"].includes(v.appearance) || !Array.isArray(v.entries)) throw new Error("Unsupported workspace preferences");
  const ids = /* @__PURE__ */ new Set();
  for (const e of v.entries) {
    if (!e || typeof e.id !== "string" || ids.has(e.id) || typeof e.key !== "string" || !["field", "selected", "named"].includes(e.scope) || e.scope === "named" && [e.entityId, e.sceneId, e.journeyId].some((x) => typeof x !== "string" || !x)) throw new Error("Invalid toolbelt binding");
    ids.add(e.id);
  }
  return structuredClone(v);
}
function moveBeltEntry(entries, id, offset) {
  const i = entries.findIndex((e) => e.id === id), j = i + offset;
  if (i < 0 || j < 0 || j >= entries.length) return false;
  [entries[i], entries[j]] = [entries[j], entries[i]];
  return true;
}
function formationSummary(e) {
  const label = (s) => s.shape === "text" ? s.text : s.shape;
  const states = e.sequence.steps;
  if (states.length > 1) return states.map(label).join(e.sequence.enabled ? " \u2192 " : " \u2194 ") + (e.sequence.enabled ? " \xB7 playing" : e.sequence.manual ? " \xB7 manual" : " \xB7 held");
  return label(e) + " \xB7 single state";
}
function syncHeldState(e, index) {
  const step = e.sequence.steps[index];
  if (!step || e.sequence.enabled || e.sequence.manual) return;
  e.shape = step.shape;
  e.text = step.text;
  e.yantraId = step.yantraId;
  e.templateFrequency = step.templateFrequency;
  e.templateGeometry = step.templateGeometry;
  e.templateDimension = step.templateDimension;
}
export {
  WORKSPACE_KEY,
  defaultWorkspace,
  formationSummary,
  moveBeltEntry,
  syncHeldState,
  validateWorkspace
};
