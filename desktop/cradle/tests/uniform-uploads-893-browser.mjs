// O-I #747 round 893, item 5 (walk 892: 48.8 s of a 52 s paint stall inside uniform1fv, in the frame's PointCloudField render). Walk 893
// counted the frame's uploads: idle in Session view, 3,824 uniform1fv calls in 4 s (16 a frame, about 3.8 a draw), every one a float[64]
// array, and not one carried a value that differed from the last upload to its location. three.js (r186 setValueV1fArray and the vector
// array setters) uploads an array uniform on every material refresh with no cache, where it caches scalars and vectors. The field's own
// GL context now uploads an array only when it differs from the last upload to that location (src/engine/uniformUploads.ts).
// Run: node tests/uniform-uploads-893-browser.mjs (headless Chromium with --mute-audio, and WebKit). It renders through three.js itself
// and counts the uploads that reach WebGL; the pixels prove each changed value still lands.
import {build} from 'esbuild';
import {chromium, webkit} from 'playwright';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const engine = fileURLToPath(new URL('../expressions-app/src/engine', import.meta.url));
const bundle = await build({stdin: {contents: `import * as THREE from 'three'; export {THREE}; export {uploadOnlyOnChange} from './uniformUploads.ts';`, resolveDir: engine, loader: 'ts'},
  nodePaths: [fileURLToPath(new URL('../expressions-app/node_modules', import.meta.url))], bundle: true, format: 'iife', globalName: 'u', write: false, logLevel: 'silent'});

for (const [name, launcher, args] of [['Chromium', chromium, ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl']], ['WebKit', webkit, []]]) {
  const browser = await launcher.launch({args});
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><title>uniform uploads</title><canvas id=c width=8 height=8></canvas>');
    await page.addScriptTag({content: bundle.outputFiles[0].text});
    const result = await page.evaluate(() => {
      const {THREE, uploadOnlyOnChange} = window.u;
      // What reaches WebGL: every array upload, by the uniform's name.
      const names = new WeakMap(), sent = {};
      for (const proto of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype].filter(Boolean)) {
        const gul = proto.getUniformLocation; proto.getUniformLocation = function (p, n) { const l = gul.call(this, p, n); if (l) names.set(l, n); return l };
        for (const k of ['uniform1fv', 'uniform3fv']) { const f = proto[k]; proto[k] = function (l, ...a) { const n = names.get(l) ?? '?'; sent[n] = (sent[n] ?? 0) + 1; return f.call(this, l, ...a) } }
      }
      const renderer = new THREE.WebGLRenderer({canvas: document.getElementById('c'), antialias: false, preserveDrawingBuffer: true});
      uploadOnlyOnChange(renderer.getContext());
      const weights = new Float32Array(64), tints = Array.from({length: 64}, () => new THREE.Color(0, 0, 0));
      const material = new THREE.ShaderMaterial({uniforms: {uWeight: {value: weights}, uTint: {value: tints}},
        vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader: 'uniform float uWeight[64];uniform vec3 uTint[64];void main(){gl_FragColor=vec4(uWeight[3],uTint[5].g,0.,1.);}'});
      const scene = new THREE.Scene(), camera = new THREE.Camera();
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
      const gl = renderer.getContext(), px = new Uint8Array(4)
      const draw = () => { renderer.render(scene, camera); gl.readPixels(4, 4, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return [px[0], px[1]] }
      const steps = []
      const at = label => steps.push({label, pixel: draw(), sent: {...sent}})
      weights[3] = 0.5; at('first')
      at('unchanged'); at('unchanged again')
      weights[3] = 1; at('weight changed in place')
      tints[5].setRGB(0, 1, 0); at('tint changed in place')
      at('unchanged after')
      return steps
    });
    for (const s of result) console.log(`${name}: ${s.label.padEnd(24)} pixel ${s.pixel.join(',')} · uploads uWeight ${s.sent['uWeight[0]'] ?? s.sent.uWeight ?? 0}, uTint ${s.sent['uTint[0]'] ?? s.sent.uTint ?? 0}`);
    const up = (s, n) => s.sent[`${n}[0]`] ?? s.sent[n] ?? 0;
    const [first, same, again, weight, tint, after] = result;
    assert.ok(Math.abs(first.pixel[0] - 128) <= 1 && first.pixel[1] === 0, `${name}: the first render shows the uploaded values`);
    assert.equal(up(first, 'uWeight'), 1); assert.equal(up(first, 'uTint'), 1);
    assert.deepEqual([up(same, 'uWeight'), up(again, 'uWeight'), up(same, 'uTint'), up(again, 'uTint')], [1, 1, 1, 1], `${name}: an array that did not change is not uploaded again`);
    assert.deepEqual(same.pixel, first.pixel, `${name}: and the render is the same`);
    assert.deepEqual([up(weight, 'uWeight'), weight.pixel[0]], [2, 255], `${name}: a value changed in place is uploaded, and shows`);
    assert.deepEqual([up(tint, 'uTint'), tint.pixel[1]], [2, 255], `${name}: a colour changed in place is uploaded, and shows`);
    assert.deepEqual([up(after, 'uWeight'), up(after, 'uTint')], [2, 2], `${name}: and not again while it stands`);
  } finally { await browser.close(); }
}
const field = await readFile(new URL('../expressions-app/src/engine/PointCloudField.ts', import.meta.url), 'utf8');
assert.match(field, /uploadOnlyOnChange\(this\.renderer\.getContext\(\)\)/, 'the field\'s renderer uploads its arrays only on change');
console.log('Item 5: array uniforms upload only on change, in Chromium and WebKit; every change still lands.');
