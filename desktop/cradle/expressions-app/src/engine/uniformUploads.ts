/**
 * Array uniforms uploaded only when they change (O-I #747 round 893, item 5).
 *
 * three.js (r186 WebGLUniforms setValueV1fArray and the vector and matrix array setters) uploads an array uniform every time a material is
 * refreshed, which is at least once a frame for every material drawn, with no cache: it caches scalars and vectors, not arrays. Walk 893
 * counted the field idle in Session view at 3,824 uniform1fv calls in 4 s, every one a float[64] array, none with a value that differed
 * from the last upload to its location; walk 892's profile put 48.8 s of a 52 s paint stall inside them.
 *
 * Installed on one WebGL context, its array uploads keep, per location, a copy of what was last sent, and an upload of the same values to
 * the same location is skipped. That is safe because a uniform keeps its value in its program until a uniform call sets it: every such
 * call on this context comes through here, a relinked program or a restored context gives new location objects (so no copy matches), and
 * a call with a source offset or length is always sent and forgets the copy. The prototype's method is looked up at each call, so what
 * reaches WebGL is what anything counting there sees.
 */
type Context = WebGLRenderingContext | WebGL2RenderingContext;
type ArrayUpload = 'uniform1fv' | 'uniform2fv' | 'uniform3fv' | 'uniform4fv' | 'uniform1iv' | 'uniform2iv' | 'uniform3iv' | 'uniform4iv';
type MatrixUpload = 'uniformMatrix2fv' | 'uniformMatrix3fv' | 'uniformMatrix4fv';
const ARRAYS: readonly ArrayUpload[] = ['uniform1fv', 'uniform2fv', 'uniform3fv', 'uniform4fv', 'uniform1iv', 'uniform2iv', 'uniform3iv', 'uniform4iv'];
const MATRICES: readonly MatrixUpload[] = ['uniformMatrix2fv', 'uniformMatrix3fv', 'uniformMatrix4fv'];
const installed = new WeakSet<Context>();

type Values = ArrayLike<number>;
const same = (kept: Float64Array | undefined, data: Values): boolean => {
  if (!kept || kept.length !== data.length) return false;
  for (let i = 0; i < kept.length; i++) if (kept[i] !== data[i] && !(Number.isNaN(kept[i]) && Number.isNaN(data[i]))) return false;
  return true;
};

/** Make `gl`'s array uniform uploads go only when their values change. Returns `gl`; installing twice does nothing more. */
export function uploadOnlyOnChange(gl: Context): Context {
  if (installed.has(gl)) return gl;
  installed.add(gl);
  const sent = new WeakMap<WebGLUniformLocation, Float64Array>();
  const proto = Object.getPrototypeOf(gl) as Record<string, (...args: unknown[]) => void>;
  const own = gl as unknown as Record<string, (...args: unknown[]) => void>;
  for (const name of ARRAYS) {
    if (typeof proto[name] !== 'function') continue;
    own[name] = function (location: unknown, data: unknown, ...rest: unknown[]) {
      const upload = proto[name];
      if (!location || rest.length || !data || typeof (data as Values).length !== 'number') {
        if (location) sent.delete(location as WebGLUniformLocation);
        return upload.call(gl, location, data, ...rest);
      }
      const at = location as WebGLUniformLocation;
      if (same(sent.get(at), data as Values)) return;
      upload.call(gl, location, data);
      sent.set(at, Float64Array.from(data as Values));
    };
  }
  for (const name of MATRICES) {
    if (typeof proto[name] !== 'function') continue;
    own[name] = function (location: unknown, transpose: unknown, data: unknown, ...rest: unknown[]) {
      const upload = proto[name];
      if (!location || rest.length || transpose || !data || typeof (data as Values).length !== 'number') {
        if (location) sent.delete(location as WebGLUniformLocation);
        return upload.call(gl, location, transpose, data, ...rest);
      }
      const at = location as WebGLUniformLocation;
      if (same(sent.get(at), data as Values)) return;
      upload.call(gl, location, transpose, data);
      sent.set(at, Float64Array.from(data as Values));
    };
  }
  return gl;
}
