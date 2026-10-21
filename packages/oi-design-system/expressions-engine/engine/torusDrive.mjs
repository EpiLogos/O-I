const KEY_SOURCES = ["torus", "sky", "manual"];
const isKeySource = (value) => typeof value === "string" && KEY_SOURCES.includes(value);
const ROLES_ABSENT = "M2\u2032 reads eight audible roles and four nodes from the torus (the Vimar\u015B\u0101 reading's audio_octet_hz and nodal_quartet), but no source says which plate mode each role or node drives, so the plate is driven by the pitches the torus plays.";
const pitches = (tones) => (tones ?? []).filter((hz) => typeof hz === "number" && Number.isFinite(hz) && hz > 0);
const SILENCE = "The torus is silent";
class TorusDriveState {
  last = [];
  resolve(args) {
    const roles = { standing: "absent", reason: ROLES_ABSENT };
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
  ROLES_ABSENT,
  TorusDriveState,
  isKeySource
};
