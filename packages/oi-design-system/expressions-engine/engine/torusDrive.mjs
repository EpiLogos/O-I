import { bodyOf, readRoles } from "./torusObject.mjs";
const KEY_SOURCES = ["torus", "sky", "manual"];
const isKeySource = (value) => typeof value === "string" && KEY_SOURCES.includes(value);
function rolesOf(reading) {
  const body = reading?.body;
  const amplitudes = Array.isArray(body?.amplitudes) ? new Map(body.amplitudes.map((a) => [a.mode_ref, [a.re, a.im]])) : null;
  return readRoles(body ? bodyOf(body.influence) : null, amplitudes, reading ? "The owner states no eight voices and four boundaries for the torus yet, so the plate reads no voices or boundaries." : void 0);
}
function pulseRateFor(drive) {
  if (!drive || drive.kind === "torus") return null;
  const hz = drive.targetHz;
  return typeof hz === "number" && Number.isFinite(hz) && hz > 0 ? hz : null;
}
const pitches = (tones) => (tones ?? []).filter((hz) => typeof hz === "number" && Number.isFinite(hz) && hz > 0);
const SILENCE = "The torus is silent";
class TorusDriveState {
  last = [];
  resolve(args) {
    const roles = rolesOf(args.reading);
    const { keySource, reading } = args;
    if (keySource === "manual") {
      return { source: "manual", tonesHz: [args.manualHz], silent: false, held: false, reason: null, roles };
    }
    const given = keySource === "sky" ? reading?.sky : reading?.torus;
    const tones = pitches(given?.tonesHz);
    if (tones.length > 0) {
      this.last = tones;
      return { source: keySource, tonesHz: [...tones], silent: false, held: false, reason: null, roles };
    }
    const because = !reading ? "No instrument is open" : keySource === "sky" ? reading.sky.absentBecause ?? "The sky gives no voices" : reading.torus.silentBecause ?? "The torus gives no voices";
    const holds = this.last.length > 0;
    const reason = keySource === "sky" ? `${because}. ${holds ? "The plate holds its last drive." : "The plate has no drive yet."}` : `${SILENCE}: ${because}. ${holds ? "The plate holds its last drive." : "The plate has no drive yet."}`;
    return { source: keySource, tonesHz: [...this.last], silent: true, held: holds, reason, roles };
  }
}
export {
  KEY_SOURCES,
  TorusDriveState,
  isKeySource,
  pulseRateFor,
  rolesOf
};
