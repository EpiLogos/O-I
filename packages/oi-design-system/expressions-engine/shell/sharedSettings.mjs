import { clone } from "./model.mjs";
import { defaultWorkspace } from "./workspacePreferences.mjs";
import { NATIVE_BINDINGS, bindValue } from "./nativeParameters.mjs";
import { readPath } from "../engine/automation.mjs";
const POINTER_PATHS = ["engine.pointerMode", "engine.pointerClick", "engine.pointerClickStrength", "engine.pointerClickRadius", ...NATIVE_BINDINGS.filter((b) => b.group === "pointer").map((b) => b.bind)];
function initialiseShared(j) {
  if (!j.shared) {
    const seen = /* @__PURE__ */ new Set(), entries = [];
    for (const scene of j.scenes) for (const entry of scene.toolbelt ?? defaultWorkspace().entries) {
      const key = [entry.scope, entry.key, entry.entityId ?? ""].join(":");
      if (!seen.has(key)) {
        seen.add(key);
        entries.push({ ...clone(entry), id: "shared-" + entries.length });
      }
    }
    j.shared = { toolbelt: entries, values: {}, pointer: {} };
    for (const path of POINTER_PATHS) {
      const binding = NATIVE_BINDINGS.find((b) => b.bind === path), v = readPath(j.scenes[0], path) ?? (binding ? binding.defaultValue : void 0);
      if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") j.shared.pointer[path] = v;
    }
  }
  return j;
}
function globalPath(path) {
  return /^(field\.(params\.[\w]+|background|material)|engine\.[\w]+|morph\.[\w]+|composition\.[\w]+)$/.test(path) && !path.split(".").some((k) => ["__proto__", "constructor", "prototype"].includes(k));
}
function isShared(j, s, path) {
  return !!j.shared && (Object.hasOwn(j.shared.values, path) || s.pointerScope !== "local" && POINTER_PATHS.includes(path));
}
function effectiveScene(j, s) {
  if (!j.shared) return s;
  const values = { ...j.shared.values, ...s.pointerScope !== "local" ? j.shared.pointer : {} };
  const out = { ...s, field: { ...s.field, params: { ...s.field.params } }, engine: { ...s.engine }, morph: { ...s.morph }, composition: { ...s.composition } };
  for (const [path, value] of Object.entries(values)) if (globalPath(path)) bindValue(out, path, value);
  const sharedTargets = new Set(NATIVE_BINDINGS.filter((b) => Object.hasOwn(values, b.bind)).map((b) => "field." + b.key));
  out.automation = s.automation.map((a) => sharedTargets.has(a.target) ? { ...a, enabled: false } : a);
  return out;
}
function writeShared(j, s, path, value) {
  if (!isShared(j, s, path)) return false;
  const bucket = POINTER_PATHS.includes(path) && s.pointerScope !== "local" ? j.shared.pointer : j.shared.values;
  bucket[path] = value;
  return true;
}
function toggleShared(j, s, path) {
  if (!globalPath(path)) throw new Error("This property cannot be shared.");
  initialiseShared(j);
  if (Object.hasOwn(j.shared.values, path)) {
    const value2 = j.shared.values[path];
    delete j.shared.values[path];
    for (const scene of j.scenes) bindValue(scene, path, value2);
    return false;
  }
  const binding = NATIVE_BINDINGS.find((b) => b.bind === path), value = readPath(effectiveScene(j, s), path) ?? binding?.defaultValue;
  if (typeof value !== "number" && typeof value !== "string" && typeof value !== "boolean") throw new Error("This property has no scalar value.");
  j.shared.values[path] = value;
  return true;
}
function useLocalPointer(j, s, local) {
  if (local) {
    const effective = effectiveScene(j, s);
    for (const path of POINTER_PATHS) {
      const v = readPath(effective, path);
      if (v !== void 0) bindValue(s, path, v);
    }
    s.pointerScope = "local";
  } else s.pointerScope = "global";
}
export {
  POINTER_PATHS,
  effectiveScene,
  globalPath,
  initialiseShared,
  isShared,
  toggleShared,
  useLocalPointer,
  writeShared
};
