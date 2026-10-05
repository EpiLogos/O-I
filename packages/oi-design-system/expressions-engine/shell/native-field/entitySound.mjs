const SOUND_FIELDS = ["enabled", "frequencyHz", "followCymatic", "gain", "waveform", "attack", "release", "pan"];
const SOUND_WAVEFORMS = ["sine", "triangle", "square", "sawtooth"];
const DEFAULT_ENTITY_SOUND = Object.freeze({
  enabled: false,
  frequencyHz: 220,
  followCymatic: true,
  gain: 0.2,
  waveform: "sine",
  attack: 0.08,
  release: 0.8,
  pan: 0
});
const finite = (value, low, high) => typeof value === "number" && Number.isFinite(value) && value >= low && value <= high;
function validateEntitySound(value) {
  if (value === void 0) return void 0;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid entity sound: expected an object");
  const sound = value;
  const unknown = Object.keys(sound).find((key) => !SOUND_FIELDS.includes(key));
  if (unknown) throw new Error(`Invalid entity sound: unsupported field ${unknown}`);
  if (typeof sound.enabled !== "boolean") throw new Error("Invalid entity sound: enabled must be a boolean");
  if (sound.followCymatic !== void 0 && typeof sound.followCymatic !== "boolean") throw new Error("Invalid entity sound: followCymatic must be a boolean");
  for (const [key, low, high] of [["frequencyHz", 1, 2e4], ["gain", 0, 1], ["attack", 0, 10], ["release", 0, 30], ["pan", -1, 1]]) {
    if (sound[key] !== void 0 && !finite(sound[key], low, high)) throw new Error(`Invalid entity sound: ${key} must sit inside [${low}, ${high}]`);
  }
  if (sound.waveform !== void 0 && !SOUND_WAVEFORMS.includes(sound.waveform)) throw new Error("Invalid entity sound: unsupported waveform");
  return value;
}
function activeFromFocus(focus) {
  if (!focus) return void 0;
  const active = /* @__PURE__ */ new Set([focus.entityId]);
  if (focus.nextEntityId && (focus.blend ?? 0) > 0.5) active.add(focus.nextEntityId);
  return active;
}
const muteListeners = /* @__PURE__ */ new Set();
let objectSoundMuted = false;
function objectSoundIsMuted() {
  return objectSoundMuted;
}
function setObjectSoundMuted(muted) {
  objectSoundMuted = muted;
  for (const listener of [...muteListeners]) listener(muted);
}
function onObjectSoundMuted(listener) {
  muteListeners.add(listener);
  return () => {
    muteListeners.delete(listener);
  };
}
function entitySoundVoices(scene, active) {
  const fieldHz = scene.field?.params?.frequency;
  const voices = [];
  for (const entity of scene.entities) {
    const sound = entity.sound;
    if (!sound?.enabled || entity.enabled === false || active && !active.has(entity.id)) continue;
    const d = DEFAULT_ENTITY_SOUND;
    const follow = sound.followCymatic ?? sound.frequencyHz === void 0;
    const hz = follow ? entity.templateFrequency ?? fieldHz ?? sound.frequencyHz ?? d.frequencyHz : sound.frequencyHz ?? d.frequencyHz;
    voices.push({
      voiceRef: JSON.stringify(["authored", entity.id]),
      entityId: entity.id,
      frequencyHz: Math.min(2e4, Math.max(1, hz)),
      gain: sound.gain ?? d.gain,
      waveform: sound.waveform ?? d.waveform,
      attack: sound.attack ?? d.attack,
      release: sound.release ?? d.release,
      pan: sound.pan ?? d.pan
    });
  }
  return voices;
}
function presentEntitySoundVoices(plan, scene, active) {
  validateVoicePlan(plan);
  const present = new Set(scene.entities.filter((entity) => entity.enabled !== false).map((entity) => entity.id));
  return plan.filter((voice) => present.has(voice.entityId) && (!active || active.has(voice.entityId))).map((voice) => ({ ...voice }));
}
function validateVoicePlan(plan) {
  const refs = /* @__PURE__ */ new Set();
  for (const voice of plan) {
    if (!voice || typeof voice.voiceRef !== "string" || !voice.voiceRef || refs.has(voice.voiceRef) || typeof voice.entityId !== "string" || !voice.entityId) throw new Error("Invalid sound voice: a unique voiceRef and target entityId are required");
    refs.add(voice.voiceRef);
    for (const [key, low, high] of [["frequencyHz", 1, 2e4], ["gain", 0, 1], ["attack", 0, 10], ["release", 0, 30], ["pan", -1, 1]])
      if (!finite(voice[key], low, high)) throw new Error(`Invalid sound voice: ${key} must sit inside [${low}, ${high}]`);
    if (!SOUND_WAVEFORMS.includes(voice.waveform)) throw new Error("Invalid sound voice: unsupported waveform");
  }
}
class EntitySoundBank {
  constructor(createContext = () => typeof AudioContext === "function" ? new AudioContext() : null) {
    this.createContext = createContext;
    this.release = onObjectSoundMuted((muted) => this.setMuted(muted));
  }
  context = null;
  voices = /* @__PURE__ */ new Map();
  retiring = /* @__PURE__ */ new Set();
  muted = objectSoundIsMuted();
  signature = "";
  gestureArmed = false;
  disarmGesture = () => {
  };
  release;
  /** Follow the current Scene (and optional active set). Cheap when unchanged. */
  sync(scene, active) {
    return this.syncVoices(entitySoundVoices(scene, active));
  }
  /** Receive an already-qualified private plan without changing the Scene. */
  syncVoices(plan) {
    validateVoicePlan(plan);
    const received = plan.map((voice) => ({ ...voice }));
    const signature = JSON.stringify(received);
    if (signature === this.signature) return received;
    if (!received.length && !this.voices.size) {
      this.signature = signature;
      return received;
    }
    const context = this.ensureContext();
    if (!context) return received;
    this.signature = signature;
    const now = context.currentTime;
    const wanted = new Map(received.map((voice) => [voice.voiceRef, voice]));
    for (const [id, held] of this.voices) if (!wanted.has(id)) {
      held.amp.gain.cancelScheduledValues(now);
      held.amp.gain.setValueAtTime(held.amp.gain.value, now);
      held.amp.gain.linearRampToValueAtTime(0, now + held.voice.release);
      held.oscillator.stop(now + held.voice.release + 0.05);
      this.retiring.add(held);
      this.voices.delete(id);
    }
    for (const voice of received) {
      let held = this.voices.get(voice.voiceRef);
      if (!held) {
        for (const previous of this.retiring) if (previous.voice.voiceRef === voice.voiceRef) this.stopImmediately(previous);
        const oscillator = context.createOscillator(), amp = context.createGain();
        const panner = typeof context.createStereoPanner === "function" ? context.createStereoPanner() : null;
        amp.gain.setValueAtTime(0, now);
        oscillator.connect(amp);
        if (panner) {
          amp.connect(panner);
          panner.connect(context.destination);
        } else amp.connect(context.destination);
        oscillator.start(now);
        held = { voice, oscillator, amp, panner };
        const resident = held;
        oscillator.onended = () => {
          oscillator.disconnect();
          amp.disconnect();
          panner?.disconnect();
          this.retiring.delete(resident);
        };
        this.voices.set(voice.voiceRef, held);
      }
      held.oscillator.type = voice.waveform;
      held.oscillator.frequency.setTargetAtTime(voice.frequencyHz, now, 0.02);
      held.panner?.pan.setTargetAtTime(voice.pan, now, 0.02);
      held.amp.gain.cancelScheduledValues(now);
      held.amp.gain.setValueAtTime(held.amp.gain.value, now);
      held.amp.gain.linearRampToValueAtTime(this.muted ? 0 : voice.gain, now + Math.max(5e-3, voice.attack));
      held.voice = voice;
    }
    return received;
  }
  setMuted(muted) {
    this.muted = muted;
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    for (const held of this.voices.values()) {
      held.amp.gain.cancelScheduledValues(now);
      held.amp.gain.setValueAtTime(held.amp.gain.value, now);
      held.amp.gain.linearRampToValueAtTime(muted ? 0 : held.voice.gain, now + (muted ? held.voice.release : held.voice.attack) + 5e-3);
    }
    if (muted) for (const held of this.retiring) {
      this.stopImmediately(held);
    }
  }
  inspect() {
    return { muted: this.muted, state: this.context?.state ?? "unopened", retiringVoiceCount: this.retiring.size, voices: [...this.voices.values()].map((held) => ({ ...held.voice })) };
  }
  /** Custody release clears active and retiring nodes immediately. It keeps
   * the reusable context/mute subscription; focus departure still uses sync's
   * authored release curve. No old personal basis overlaps a new admission. */
  clear() {
    this.disarmGesture();
    for (const held of [...this.voices.values(), ...this.retiring]) this.stopImmediately(held);
    this.retiring.clear();
    this.voices.clear();
    this.signature = "";
  }
  dispose() {
    this.release();
    this.clear();
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") void context.close().catch(() => {
    });
  }
  stopImmediately(held) {
    const now = this.context?.currentTime ?? 0;
    held.amp.gain.cancelScheduledValues(now);
    held.amp.gain.setValueAtTime(0, now);
    held.oscillator.onended = null;
    try {
      held.oscillator.stop(now);
    } catch {
    }
    held.oscillator.disconnect();
    held.amp.disconnect();
    held.panner?.disconnect();
    this.retiring.delete(held);
  }
  ensureContext() {
    if (!this.context) this.context = this.createContext();
    const context = this.context;
    if (context && context.state === "suspended" && !this.gestureArmed && typeof window !== "undefined") {
      this.gestureArmed = true;
      this.disarmGesture = () => {
        window.removeEventListener("pointerdown", resume, true);
        window.removeEventListener("keydown", resume, true);
        this.gestureArmed = false;
      };
      const resume = () => {
        this.disarmGesture();
        void context.resume().catch(() => {
        });
      };
      window.addEventListener("pointerdown", resume, true);
      window.addEventListener("keydown", resume, true);
    }
    return context;
  }
}
export {
  DEFAULT_ENTITY_SOUND,
  EntitySoundBank,
  SOUND_FIELDS,
  SOUND_WAVEFORMS,
  activeFromFocus,
  entitySoundVoices,
  objectSoundIsMuted,
  onObjectSoundMuted,
  presentEntitySoundVoices,
  setObjectSoundMuted,
  validateEntitySound
};
