function geometryCandidates(value) {
  if (!value.entityId || !value.revision || value.points.length < 2 || value.points.length > 4096 || !value.segments.length || value.segments.length > 8192) throw Error("Invalid bounded formation geometry.");
  if (value.points.some((p) => p.length !== 3 || p.some((n) => !Number.isFinite(n) || Math.abs(n) > 1))) throw Error("Formation geometry must fit its normalized local frame.");
  const candidates = [];
  for (const edge of value.segments) {
    if (edge.length !== 2 || edge.some((i) => !Number.isSafeInteger(i) || i < 0 || i >= value.points.length) || edge[0] === edge[1]) throw Error("Formation geometry has an invalid segment.");
    const a = value.points[edge[0]], b = value.points[edge[1]];
    const steps = Math.max(1, Math.ceil(Math.hypot(...a.map((n, i) => n - b[i])) * 200));
    if (candidates.length + steps + 1 > 65536) throw Error("Formation geometry exceeds the target sampling budget.");
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      candidates.push({ x: 200 * (a[0] + (b[0] - a[0]) * t), y: 200 * (a[1] + (b[1] - a[1]) * t), z: 200 * (a[2] + (b[2] - a[2]) * t), density: 1 });
    }
  }
  return candidates;
}
export {
  geometryCandidates
};
