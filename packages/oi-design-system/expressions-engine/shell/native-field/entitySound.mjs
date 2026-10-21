const SOUND_FIELDS = ["enabled", "carry", "gain", "attack", "release"];
const CARRY_KINDS = ["mode", "name"];
const REMOVED_SOUND_FIELDS = ["frequencyHz", "followCymatic", "waveform", "pan"];
const REMOVED_SOUND_WORDS = Object.freeze({
  frequencyHz: "a symbol's voice carries the torus's sound and has no pitch of its own: its pitches are the degrees of its mode over the torus's root",
  followCymatic: "a symbol's voice carries the torus's sound and does not follow a plate's frequency: its pitches are the degrees of its mode",
  waveform: "a symbol's voice has no oscillator, so it has no waveform: it is the torus's own sound",
  pan: "a symbol's voice stands where its symbol stands, so its stereo place is the symbol's place on the stage"
});
const DEFAULT_ENTITY_SOUND = Object.freeze({
  enabled: false,
  gain: 0.2,
  attack: 0.08,
  release: 0.8
});
const NO_CARRY = "This voice has no name or mode yet: choose one on the Sound page";
const VOICES_OFF = "Symbol voices are off for this scene: no symbol carries the torus's sound";
const finite = (value, low, high) => typeof value === "number" && Number.isFinite(value) && value >= low && value <= high;
const plain = (value) => !!value && typeof value === "object" && !Array.isArray(value);
function validateVoiceCarry(value) {
  if (!plain(value)) throw new Error("Invalid entity sound: carry must be {kind, ref}");
  const unknown = Object.keys(value).find((key) => key !== "kind" && key !== "ref");
  if (unknown) throw new Error(`Invalid entity sound: unsupported carry field ${unknown}`);
  if (!CARRY_KINDS.includes(value.kind)) throw new Error("Invalid entity sound: carry kind must be mode or name");
  if (typeof value.ref !== "string" || !value.ref || value.ref.length > 200) throw new Error("Invalid entity sound: carry ref must be a name or a catalogue key of 1 to 200 characters");
  return { kind: value.kind, ref: value.ref };
}
function validateEntitySound(value) {
  if (value === void 0) return void 0;
  if (!plain(value)) throw new Error("Invalid entity sound: expected an object");
  const sound = value;
  const removed = REMOVED_SOUND_FIELDS.find((key) => key in sound);
  if (removed) throw new Error(`Invalid entity sound: ${removed} was removed: ${REMOVED_SOUND_WORDS[removed]}`);
  const unknown = Object.keys(sound).find((key) => !SOUND_FIELDS.includes(key));
  if (unknown) throw new Error(`Invalid entity sound: unsupported field ${unknown}`);
  if (typeof sound.enabled !== "boolean") throw new Error("Invalid entity sound: enabled must be a boolean");
  for (const [key, low, high] of [["gain", 0, 1], ["attack", 0, 10], ["release", 0, 30]]) {
    if (sound[key] !== void 0 && !finite(sound[key], low, high)) throw new Error(`Invalid entity sound: ${key} must sit inside [${low}, ${high}]`);
  }
  const out = { enabled: sound.enabled };
  if (sound.carry !== void 0) out.carry = validateVoiceCarry(sound.carry);
  for (const key of ["gain", "attack", "release"]) if (sound[key] !== void 0) out[key] = sound[key];
  return out;
}
function migrateEntitySound(value) {
  if (value === void 0) return { sound: void 0, migration: null };
  if (!plain(value)) throw new Error("Invalid entity sound: expected an object");
  const dropped = REMOVED_SOUND_FIELDS.filter((field) => field in value).map((field) => ({ field, was: value[field] }));
  const kept = Object.fromEntries(Object.entries(value).filter(([key]) => !REMOVED_SOUND_FIELDS.includes(key)));
  const sound = validateEntitySound(kept);
  if (!dropped.length) return { sound, migration: null };
  const silenced = sound.enabled && !sound.carry;
  const names = dropped.map((item) => item.field).join(", ");
  return { sound, migration: {
    dropped,
    silenced,
    words: `This voice was written for an oscillator. Dropped ${names}: a symbol's voice now carries a name or mode of the torus's sound. ${silenced ? `It was sounding and is silent now. ${NO_CARRY}.` : "It gained no name or mode."}`
  } };
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
function entitySoundPlan(scene, active) {
  const voices = [], silent = [];
  const on = scene.composition?.symbolVoices !== false;
  for (const entity of scene.entities) {
    const sound = entity.sound;
    if (!sound?.enabled || entity.enabled === false || active && !active.has(entity.id)) continue;
    if (!on) {
      silent.push({ entityId: entity.id, because: VOICES_OFF });
      continue;
    }
    if (!sound.carry) {
      silent.push({ entityId: entity.id, because: NO_CARRY });
      continue;
    }
    const d = DEFAULT_ENTITY_SOUND;
    voices.push({ entityId: entity.id, carry: { ...sound.carry }, gain: sound.gain ?? d.gain, attack: sound.attack ?? d.attack, release: sound.release ?? d.release });
  }
  return { voices, silent };
}
const entitySoundVoices = (scene, active) => entitySoundPlan(scene, active).voices;
export {
  CARRY_KINDS,
  DEFAULT_ENTITY_SOUND,
  NO_CARRY,
  REMOVED_SOUND_FIELDS,
  REMOVED_SOUND_WORDS,
  SOUND_FIELDS,
  VOICES_OFF,
  activeFromFocus,
  entitySoundPlan,
  entitySoundVoices,
  migrateEntitySound,
  objectSoundIsMuted,
  onObjectSoundMuted,
  setObjectSoundMuted,
  validateEntitySound,
  validateVoiceCarry
};
