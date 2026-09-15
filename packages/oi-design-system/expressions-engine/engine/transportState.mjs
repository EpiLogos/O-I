function validateTransport(value) {
  const v = value;
  if (!v || v.version !== 1 || ![v.simTime, v.theta, v.phi].every((n) => Number.isFinite(n) && Math.abs(n) < 1e12) || v.simTime < 0 || !Array.isArray(v.lanes) || v.lanes.length > 256) throw new Error("Invalid transport recovery.");
  const keys = ["cycle", "lastTime", "phaseOffset", "rateHz", "startTime", "token", "randSeed", "lastStep", "lastValue", "nextValue"];
  for (const entry of v.lanes) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" || entry[0].length > 250 || !entry[1] || typeof entry[1] !== "object") throw new Error("Invalid automation recovery.");
    for (const [key, n] of Object.entries(entry[1])) if (!keys.includes(key) || !Number.isFinite(n) || Math.abs(n) > 1e15) throw new Error("Invalid automation runtime value.");
    for (const key of ["startTime", "token", "randSeed", "lastStep", "lastValue", "nextValue"]) if (!Number.isFinite(entry[1][key])) throw new Error("Incomplete automation recovery.");
  }
  return JSON.parse(JSON.stringify(v));
}
export {
  validateTransport
};
