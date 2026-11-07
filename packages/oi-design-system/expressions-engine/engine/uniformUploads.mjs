const ARRAYS = ["uniform1fv", "uniform2fv", "uniform3fv", "uniform4fv", "uniform1iv", "uniform2iv", "uniform3iv", "uniform4iv"];
const MATRICES = ["uniformMatrix2fv", "uniformMatrix3fv", "uniformMatrix4fv"];
const installed = /* @__PURE__ */ new WeakSet();
const same = (kept, data) => {
  if (!kept || kept.length !== data.length) return false;
  for (let i = 0; i < kept.length; i++) if (kept[i] !== data[i] && !(Number.isNaN(kept[i]) && Number.isNaN(data[i]))) return false;
  return true;
};
function uploadOnlyOnChange(gl) {
  if (installed.has(gl)) return gl;
  installed.add(gl);
  const sent = /* @__PURE__ */ new WeakMap();
  const proto = Object.getPrototypeOf(gl);
  const own = gl;
  for (const name of ARRAYS) {
    if (typeof proto[name] !== "function") continue;
    own[name] = function(location, data, ...rest) {
      const upload = proto[name];
      if (!location || rest.length || !data || typeof data.length !== "number") {
        if (location) sent.delete(location);
        return upload.call(gl, location, data, ...rest);
      }
      const at = location;
      if (same(sent.get(at), data)) return;
      upload.call(gl, location, data);
      sent.set(at, Float64Array.from(data));
    };
  }
  for (const name of MATRICES) {
    if (typeof proto[name] !== "function") continue;
    own[name] = function(location, transpose, data, ...rest) {
      const upload = proto[name];
      if (!location || rest.length || transpose || !data || typeof data.length !== "number") {
        if (location) sent.delete(location);
        return upload.call(gl, location, transpose, data, ...rest);
      }
      const at = location;
      if (same(sent.get(at), data)) return;
      upload.call(gl, location, transpose, data);
      sent.set(at, Float64Array.from(data));
    };
  }
  return gl;
}
export {
  uploadOnlyOnChange
};
