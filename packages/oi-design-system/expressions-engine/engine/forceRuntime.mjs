const MAX_FORCE_EMITTERS = 18;
function compileEntityForceEmitters(entities, poses, legacyPoints = []) {
  const poseById = new Map(poses.map((pose) => [pose.entityId, pose]));
  const emitters = [];
  const seen = new Set(entities.map((entity) => entity.id));
  for (const entity of entities) {
    const pose = poseById.get(entity.id);
    const forces = pose?.forces ?? entity.forces;
    if (!entity.enabled || forces.mode === "none" && Math.abs(forces.spin) < 1e-9) continue;
    emitters.push({
      id: `entity:${entity.id}`,
      sourceEntityId: entity.id,
      position: pose ? { x: pose.x, y: pose.y, z: pose.z } : { x: entity.x, y: entity.y, z: entity.z },
      law: forces.mode === "vortex" ? "vortex" : "radial",
      polarity: forces.mode === "repel" ? "repel" : "attract",
      strength: forces.mode === "none" ? 0 : forces.strength,
      radius: Math.max(5, forces.radius),
      spin: forces.spin,
      // Preserve the existing laws exactly: formation forces are planar; pin forces are 3D.
      metric: entity.kind === "pin" ? "world3d" : "compositionPlane",
      enabled: true
    });
  }
  for (const point of legacyPoints) {
    if (seen.has(point.id) || point.active === false || Math.abs(point.strength) < 1e-9 && Math.abs(point.spin ?? 0) < 1e-9) continue;
    emitters.push({
      id: `legacy-pin:${point.id}`,
      position: { x: point.x, y: point.y, z: point.z ?? 0 },
      law: point.mode === "vortex" ? "vortex" : "radial",
      polarity: point.mode === "repel" ? "repel" : "attract",
      strength: point.strength,
      radius: Math.max(5, point.radius),
      spin: point.spin ?? 0,
      metric: "world3d",
      enabled: true
    });
  }
  return emitters.slice(0, MAX_FORCE_EMITTERS);
}
function relationalCarrierStates(positions, config) {
  if (!config?.enabled) return [];
  return positions.map((position, index) => ({
    id: `relational:${index}`,
    position: { ...position },
    strength: config.attractorGravity ?? 1.5,
    spin: (index % 2 === 0 ? 1 : -1) * (config.relationalSpin ?? 1.2),
    radius: config.swirlRadius ?? 500
  }));
}
export {
  MAX_FORCE_EMITTERS,
  compileEntityForceEmitters,
  relationalCarrierStates
};
