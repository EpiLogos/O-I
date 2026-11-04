import { surfaceMaterial } from "../../engine/surfaceMaterial.mjs";
const made = /* @__PURE__ */ new WeakMap();
function nativeSurface(config, play) {
  const material = play?.material && play.material.absentBecause === null ? play.material : null;
  const key = material ? JSON.stringify(material) : "";
  const held = made.get(config);
  if (held && held.key === key) return held.result;
  const plate = {
    ...config,
    toroidalMorph: config.toroidalMorph ? { ...config.toroidalMorph, enabled: false, autoOscillate: false } : void 0,
    automations: config.automations?.filter((l) => !l.path.startsWith("toroidalMorph."))
  };
  const result = material ? surfaceMaterial(plate, material) : plate;
  made.set(config, { key, result });
  return result;
}
export {
  nativeSurface
};
