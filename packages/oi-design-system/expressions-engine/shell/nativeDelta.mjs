const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
function equivalent(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ak = Object.keys(a).filter((k) => a[k] !== void 0);
  const bk = Object.keys(b).filter((k) => b[k] !== void 0);
  return ak.length === bk.length && ak.every((k) => own(b, k) && equivalent(a[k], b[k]));
}
const identityArray = (v) => Array.isArray(v) && v.every((x) => x && typeof x.id === "string");
function applyNativeDelta(original, baseline, edited) {
  if (equivalent(baseline, edited)) return original;
  if (identityArray(baseline) && identityArray(edited)) {
    const before = new Map(baseline.map((x) => [x.id, x]));
    const source = new Map((Array.isArray(original) ? original : []).map((x) => [x.id, x]));
    return edited.map((x) => before.has(x.id) ? applyNativeDelta(source.get(x.id) ?? before.get(x.id), before.get(x.id), x) : x);
  }
  if (!edited || !baseline || typeof edited !== "object" || typeof baseline !== "object" || Array.isArray(edited) || Array.isArray(baseline)) return edited;
  const out = { ...original };
  for (const k of /* @__PURE__ */ new Set([...Object.keys(baseline), ...Object.keys(edited)])) {
    if (["__proto__", "prototype", "constructor"].includes(k)) throw new Error("Unsafe native delta");
    if (equivalent(baseline[k], edited[k])) continue;
    if (!own(edited, k) || edited[k] === void 0) delete out[k];
    else out[k] = applyNativeDelta(original?.[k], baseline[k], edited[k]);
  }
  return out;
}
export {
  applyNativeDelta,
  equivalent
};
