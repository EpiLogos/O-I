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
const NO_CARRY = "This voice sounds the symbol's own harmony: the chord of the classes its form covers where it stands. A name or a mode can stand in for it on the Sound page";
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
  const translated = sound.enabled && !sound.carry;
  const names = dropped.map((item) => item.field).join(", ");
  return { sound, migration: {
    dropped,
    translated,
    words: `This voice was written for an oscillator. Dropped ${names}: a symbol's voice carries the torus's sound and has no pitch of its own. ${translated ? `It sounded a pitch of its own and sounds its symbol now. ${NO_CARRY}.` : "It gained no name or mode."}`
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
const heardChanged = () => {
  for (const listener of [...muteListeners]) listener(objectSoundMuted);
};
function objectSoundIsMuted() {
  return objectSoundMuted;
}
function setObjectSoundMuted(muted) {
  objectSoundMuted = muted;
  heardChanged();
}
function onObjectSoundMuted(listener) {
  muteListeners.add(listener);
  return () => {
    muteListeners.delete(listener);
  };
}
function setFieldSound(owner, muted) {
  setObjectSoundMuted(muted);
  owner?.chooseSound(muted);
}
function fieldSoundMuted(owner) {
  return objectSoundMuted || !!owner && owner.reading.muted === true;
}
const PERSON_HOLDS = ["held by you", "manual hold"];
function fieldSoundClosed(owner, asked) {
  if (!owner || !asked || fieldSoundMuted(owner)) return null;
  const status = owner.reading.status;
  if (status === "opening") return null;
  if (status === "held") {
    const why = typeof owner.reading.reason === "string" ? owner.reading.reason.replace(/^Error: /, "").trim() : "";
    return !why || PERSON_HOLDS.includes(why) ? null : `The field's sound is closed: the field is held (${why.replace(/[.\s]*$/, "")}).`;
  }
  if (status === "following") {
    const audio = owner.audioState ?? null;
    return audio === null || audio === "running" ? null : `The field's sound is closed: its audio is ${audio}.`;
  }
  const said = typeof owner.reading.reason === "string" ? owner.reading.reason.replace(/^Error: /, "").trim() : "";
  return `The field's sound is closed: ${said ? said.replace(/[.\s]*$/, "") : "the field is not open"}.`;
}
const SOUND_LEVEL_MAX = 2;
const soundLevelValid = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= SOUND_LEVEL_MAX;
const EXPRESSION_MIX_DEFAULT = Object.freeze({ level: 1, main: 1, active: true, solo: false });
function expressionMixRefusal(value) {
  if (value === void 0) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "The Expression's mixer is a set of settings.";
  const mix = value;
  for (const key of Object.keys(mix)) if (!["level", "main", "active", "solo"].includes(key)) return `The Expression's mixer has no ${key}.`;
  if (mix.level !== void 0 && !soundLevelValid(mix.level) || mix.main !== void 0 && !soundLevelValid(mix.main)) return "A sound level runs from silence to +6 dB.";
  if (mix.active !== void 0 && typeof mix.active !== "boolean") return "The Expression plays or it does not (true or false).";
  if (mix.solo !== void 0 && typeof mix.solo !== "boolean") return "Solo is on or off (true or false).";
  return null;
}
const expressionMixOf = (mix) => ({
  level: mix?.level ?? EXPRESSION_MIX_DEFAULT.level,
  main: mix?.main ?? EXPRESSION_MIX_DEFAULT.main,
  active: mix?.active ?? EXPRESSION_MIX_DEFAULT.active,
  solo: mix?.solo ?? EXPRESSION_MIX_DEFAULT.solo
});
let expressionMix = EXPRESSION_MIX_DEFAULT;
let soloSilenced = false;
function expressionMixReading() {
  return expressionMix;
}
function setExpressionMix(mix) {
  const refused = expressionMixRefusal(mix);
  if (refused) return refused;
  const next = expressionMixOf(mix);
  if (next.level === expressionMix.level && next.main === expressionMix.main && next.active === expressionMix.active && next.solo === expressionMix.solo) return null;
  expressionMix = next;
  heardChanged();
  return null;
}
const FIELD_LEVEL_DB = Object.freeze({ min: -60, max: 0, default: -12 });
const fieldLevelValid = (value) => typeof value === "number" && Number.isFinite(value) && value >= FIELD_LEVEL_DB.min && value <= FIELD_LEVEL_DB.max;
const fieldLevelGain = (db) => 10 ** ((db ?? FIELD_LEVEL_DB.default) / 20);
let fieldLevel = FIELD_LEVEL_DB.default;
function fieldLevelReading() {
  return fieldLevel;
}
function setFieldLevel(db) {
  if (db !== void 0 && !fieldLevelValid(db)) return "The Field's Level runs from \u221260 to 0 dB.";
  const next = db ?? FIELD_LEVEL_DB.default;
  if (next === fieldLevel) return null;
  fieldLevel = next;
  heardChanged();
  return null;
}
function objectSoundLevels() {
  return { level: expressionMix.level, main: expressionMix.main, field: fieldLevelGain(fieldLevel) };
}
function soloSilencedHere() {
  return soloSilenced;
}
function setSoloSilenced(silenced) {
  if (silenced === soloSilenced) return;
  soloSilenced = silenced;
  heardChanged();
}
let layerMixes = /* @__PURE__ */ new Map();
const sameMixes = (a, b) => a.size === b.size && [...a].every(([ref, mix]) => {
  const other = b.get(ref);
  return !!other && other.level === mix.level && other.main === mix.main && other.active === mix.active && other.solo === mix.solo;
});
function setLayerMixes(mixes) {
  if (sameMixes(mixes, layerMixes)) return;
  layerMixes = new Map(mixes);
  heardChanged();
}
const soloedAway = (own, presented, layers) => !own.solo && (presented.solo || [...layers.values()].some((mix) => mix.solo));
function voiceMixOf(entityId, presented, layers, heard) {
  const at = entityId.indexOf("#"), held = at > 0 ? layers.get(entityId.slice(0, at)) : void 0;
  const own = held ?? presented;
  return { muted: heard.muted || heard.silenced || !own.active || soloedAway(own, presented, layers), levels: { level: own.level, main: presented.main, field: heard.field } };
}
const fieldVoiceMix = (entityId) => voiceMixOf(entityId, expressionMix, layerMixes, { muted: objectSoundMuted, silenced: soloSilenced, field: fieldLevelGain(fieldLevel) });
function expressionSilencedHere() {
  return objectSoundMuted || soloSilenced || !expressionMix.active || soloedAway(expressionMix, expressionMix, layerMixes);
}
const soundingGain = (gain, muted, levels) => muted ? 0 : gain * levels.level * levels.main * (levels.field ?? 1);
const expressionGain = (mix, silenced, field = 1) => soundingGain(1, silenced || !mix.active, { level: mix.level, main: mix.main, field });
function onExpressionGain(listener) {
  const tell = () => listener(expressionGain(expressionMix, objectSoundMuted || soloSilenced || soloedAway(expressionMix, expressionMix, layerMixes), fieldLevelGain(fieldLevel)));
  tell();
  return onObjectSoundMuted(tell);
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
    const d = DEFAULT_ENTITY_SOUND;
    voices.push({ entityId: entity.id, carry: sound.carry ? { ...sound.carry } : null, gain: sound.gain ?? d.gain, attack: sound.attack ?? d.attack, release: sound.release ?? d.release });
  }
  return { voices, silent };
}
const entitySoundVoices = (scene, active) => entitySoundPlan(scene, active).voices;
export {
  CARRY_KINDS,
  DEFAULT_ENTITY_SOUND,
  EXPRESSION_MIX_DEFAULT,
  FIELD_LEVEL_DB,
  NO_CARRY,
  PERSON_HOLDS,
  REMOVED_SOUND_FIELDS,
  REMOVED_SOUND_WORDS,
  SOUND_FIELDS,
  SOUND_LEVEL_MAX,
  VOICES_OFF,
  activeFromFocus,
  entitySoundPlan,
  entitySoundVoices,
  expressionGain,
  expressionMixOf,
  expressionMixReading,
  expressionMixRefusal,
  expressionSilencedHere,
  fieldLevelGain,
  fieldLevelReading,
  fieldLevelValid,
  fieldSoundClosed,
  fieldSoundMuted,
  fieldVoiceMix,
  migrateEntitySound,
  objectSoundIsMuted,
  objectSoundLevels,
  onExpressionGain,
  onObjectSoundMuted,
  setExpressionMix,
  setFieldLevel,
  setFieldSound,
  setLayerMixes,
  setObjectSoundMuted,
  setSoloSilenced,
  soloSilencedHere,
  soundLevelValid,
  soundingGain,
  validateEntitySound,
  validateVoiceCarry,
  voiceMixOf
};
