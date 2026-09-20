/** Native C++ target receiver for the retained Point-Cloud GPGPUSimulator.
 * The host owns permission, geometry sampling, renderer lifecycle and scheduling.
 * This module neither integrates particles nor calls seedInitialState on updates.
 */
import * as THREE from 'three';
const CONTRACT = 'ql.continuous-field/v1';
const identityKeys = ['event_ref', 'subject_ref', 'registry_revision', 'geometry_ref', 'material_ref', 'model_ref'];
const need = (condition, message) => { if (!condition) throw new Error(message); };
const decimal = value => {
  need(typeof value === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(value), 'invalid exact cursor');
  const result = BigInt(value); need(result <= 18446744073709551615n, 'cursor overflow'); return result;
};
const finite = value => typeof value === 'number' && Number.isFinite(value);
const sameArray = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

export class RetainedFieldBinding {
  #sim; #a; #b; #slotsA; #slotsB; #ids; #constituents; #identity;
  #generation = null; #elapsed = null; #xyz; #last = null; #disposed = false; #centre;
  constructor(simulator, { initialFrame, targetA, targetB, slotsA, slotsB, vortexCentre = new THREE.Vector2() }) {
    need(simulator && typeof simulator.setTargetTextures === 'function', 'retained simulator required');
    const size = simulator.texWidth * simulator.texHeight;
    need(Number.isSafeInteger(size) && size > 0 && size <= 1048576, 'unsupported retained texture dimensions');
    need(slotsA.length === size && slotsB.length === size, 'incomplete supplied sample correspondence');
    this.#identity = Object.fromEntries(identityKeys.map(k => {
      need(typeof initialFrame[k] === 'string' && initialFrame[k].length > 0, 'missing event/source identity');
      return [k, initialFrame[k]];
    }));
    need(initialFrame.targets.length > 0 && initialFrame.targets.length <= 1048576, 'invalid supplied sample count');
    this.#ids = initialFrame.targets.map(p => p.identity);
    this.#constituents = initialFrame.targets.map(p => p.constituent);
    this.#ids.forEach((id, i) => need(Number.isSafeInteger(id) && id >= 0 && (i === 0 || id > this.#ids[i - 1]), 'unstable sample identity'));
    for (const slots of [slotsA, slotsB])
      for (const slot of slots) need(Number.isInteger(slot) && slot >= 0 && slot < this.#ids.length, 'unknown supplied sample slot');
    const copy = input => {
      need(input?.image?.width === simulator.texWidth && input?.image?.height === simulator.texHeight &&
           input.image.data instanceof Float32Array && input.image.data.length === size * 4, 'expected retained RGBA float target');
      const data = input.image.data.slice();
      need(data.every(Number.isFinite), 'nonfinite retained target');
      // Density lives in the supplied fourth channel. No colour or image is
      // resampled here; only native target positions change at identified slots.
      const texture = new THREE.DataTexture(data, simulator.texWidth, simulator.texHeight, THREE.RGBAFormat, THREE.FloatType);
      texture.minFilter = texture.magFilter = THREE.NearestFilter;
      texture.needsUpdate = true;
      return texture;
    };
    this.#sim = simulator; this.#centre = vortexCentre.clone();
    this.#slotsA = Uint32Array.from(slotsA); this.#slotsB = Uint32Array.from(slotsB);
    this.#xyz = new Float32Array(this.#ids.length * 3);
    this.#a = copy(targetA);
    try { this.#b = copy(targetB); this.apply(initialFrame); }
    catch (error) { this.#a.dispose(); this.#b?.dispose(); throw error; }
    this.rebind();
  }
  get targetA() { return this.#a; }
  get targetB() { return this.#b; }
  get lastReceipt() { return this.#last === null ? null : structuredClone(this.#last); }
  /** Pure admission, shared with the sound/field delivery owner. No texture,
   * cursor or particle is changed while a future audio interval is queued. */
  validate(frame) {
    return this.#checked(frame).repeated === false;
  }
  #checked(frame) {
    need(!this.#disposed && frame.schema === CONTRACT, 'unavailable or unsupported field');
    for (const key of identityKeys) need(frame[key] === this.#identity[key], 'field identity changed; explicit new binding required');
    need(frame.presentation_units_per_metre === 1, 'native target units must be metres');
    const generation = decimal(frame.generation), elapsed = decimal(frame.samples_elapsed);
    need(this.#generation === null || (generation >= this.#generation && elapsed >= this.#elapsed), 'stale native field');
    need(frame.targets.length === this.#ids.length, 'topology changed during continuation');
    // Validate the complete update before mutating a resident texture/cursor.
    for (let i = 0; i < this.#ids.length; i++) {
      const p = frame.targets[i];
      need(p.identity === this.#ids[i] && p.constituent === this.#constituents[i], 'sample identity/order/source changed');
      need(p.position.length === 3 && p.position.every(v => finite(v) && Math.abs(v) <= 3e38), 'invalid native target position');
    }
    need(frame.clock && typeof frame.clock === 'object' && frame.m2_identity?.event_ref === this.#identity.event_ref,
         'missing native clock or unrelated M2 identity');
    const receipt = structuredClone({ ...this.#identity, generation: frame.generation, samples_elapsed: frame.samples_elapsed,
      clock: frame.clock, m2_identity: frame.m2_identity, standing: frame.standing });
    const repeated = generation === this.#generation && elapsed === this.#elapsed;
    if (repeated) {
      need(JSON.stringify(receipt) === JSON.stringify(this.#last), 'conflicting source basis at the same native cursor');
      for (let i = 0; i < this.#ids.length; i++) for (let axis = 0; axis < 3; axis++)
        need(Math.fround(frame.targets[i].position[axis]) === this.#xyz[i * 3 + axis], 'conflicting payload at the same native cursor');
    }
    return { generation, elapsed, receipt, repeated };
  }
  apply(frame) {
    const { generation, elapsed, receipt, repeated } = this.#checked(frame);
    if (repeated) return false;
    for (let i = 0; i < this.#ids.length; i++) this.#xyz.set(frame.targets[i].position, i * 3);
    for (const [texture, slots] of [[this.#a, this.#slotsA], [this.#b, this.#slotsB]]) {
      const data = texture.image.data;
      for (let i = 0; i < slots.length; i++) {
        const offset = slots[i] * 3;
        data[i * 4] = this.#xyz[offset]; data[i * 4 + 1] = this.#xyz[offset + 1]; data[i * 4 + 2] = this.#xyz[offset + 2];
      }
      texture.needsUpdate = true;
    }
    this.#generation = generation; this.#elapsed = elapsed;
    this.#last = receipt;
    return true;
  }
  rebind() {
    need(!this.#disposed, 'binding disposed');
    this.#a.needsUpdate = this.#b.needsUpdate = true;
    this.#sim.setTargetTextures(this.#a, this.#b, this.#centre);
  }
  /** Explicit readback/checkpoint is not a zero-copy transport claim. */
  checkpoint(renderer) {
    need(!this.#disposed && renderer.capabilities.isWebGL2 && !renderer.getContext().isContextLost(), 'WebGL2 readback unavailable');
    const size = this.#sim.texWidth * this.#sim.texHeight * 4;
    const position = new Float32Array(size), velocity = new Float32Array(size);
    renderer.readRenderTargetPixels(this.#sim.currentPosTarget, 0, 0, this.#sim.texWidth, this.#sim.texHeight, position);
    renderer.readRenderTargetPixels(this.#sim.currentVelTarget, 0, 0, this.#sim.texWidth, this.#sim.texHeight, velocity);
    need(position.every(Number.isFinite) && velocity.every(Number.isFinite), 'invalid resident checkpoint');
    return { schema: 'ql.retained-gpu-checkpoint/v1', receipt: this.lastReceipt,
      width: this.#sim.texWidth, height: this.#sim.texHeight, position, velocity };
  }
  /** Restore both position AND velocity, once, after explicit context recovery.
   * The caller pauses updates and GPU stepping. No hidden reseed or elapsed-time
   * jump is inferred. This uses the retained simulator's public render targets.
   */
  restore(renderer, checkpoint) {
    need(!this.#disposed && !renderer.getContext().isContextLost(), 'context not available');
    need(checkpoint.schema === 'ql.retained-gpu-checkpoint/v1' && checkpoint.width === this.#sim.texWidth &&
      checkpoint.height === this.#sim.texHeight && JSON.stringify(checkpoint.receipt) === JSON.stringify(this.#last),
      'checkpoint belongs to another native state');
    const count = checkpoint.width * checkpoint.height * 4;
    for (const data of [checkpoint.position, checkpoint.velocity])
      need(data instanceof Float32Array && data.length === count && data.every(Number.isFinite), 'invalid full checkpoint');
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({ uniforms: { source: { value: null } },
      vertexShader: 'varying vec2 v; void main(){v=uv; gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: 'varying vec2 v; uniform sampler2D source; void main(){gl_FragColor=texture2D(source,v);}',
      depthTest: false, depthWrite: false, blending: THREE.NoBlending });
    const scene = new THREE.Scene(); scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.Camera(); const previous = renderer.getRenderTarget();
    try {
      for (const [data, targets] of [[checkpoint.position, [this.#sim.currentPosTarget, this.#sim.nextPosTarget]],
                                    [checkpoint.velocity, [this.#sim.currentVelTarget, this.#sim.nextVelTarget]]]) {
        const texture = new THREE.DataTexture(data, checkpoint.width, checkpoint.height, THREE.RGBAFormat, THREE.FloatType);
        texture.minFilter = texture.magFilter = THREE.NearestFilter; texture.needsUpdate = true;
        try {
          material.uniforms.source.value = texture;
          for (const target of targets) { renderer.setRenderTarget(target); renderer.render(scene, camera); }
        } finally { texture.dispose(); }
      }
    } finally { renderer.setRenderTarget(previous); geometry.dispose(); material.dispose(); }
    this.rebind();
    const verified = this.checkpoint(renderer);
    need(sameArray(verified.position, checkpoint.position) && sameArray(verified.velocity, checkpoint.velocity),
         'GPU recovery verification failed; do not resume live presentation');
  }
  dispose() { if (!this.#disposed) { this.#disposed = true; this.#a.dispose(); this.#b.dispose(); } }
}
