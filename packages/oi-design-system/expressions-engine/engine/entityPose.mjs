import { effectiveLinks, resolveSequence } from "./fieldModel.mjs";
function resolveEntityPose(entity, simTime, drivePhase, manualMorph, holdRatio) {
  const sequence = resolveSequence(entity, simTime, drivePhase, manualMorph, holdRatio);
  const links = effectiveLinks(entity);
  const a = links[sequence.linkIndex];
  const b = links[sequence.nextIndex];
  const t = sequence.progress;
  const mix = (x, y) => x + (y - x) * t;
  const sa = a?.state, sb = b?.state;
  const fa = sa?.forces ?? entity.forces, fb = sb?.forces ?? entity.forces;
  return {
    entityId: entity.id,
    x: entity.x + (a?.x ?? 0) * (1 - t) + (b?.x ?? 0) * t,
    y: entity.y + (a?.y ?? 0) * (1 - t) + (b?.y ?? 0) * t,
    z: entity.z + (a?.z ?? 0) * (1 - t) + (b?.z ?? 0) * t,
    scale: mix(sa?.scale ?? entity.scale, sb?.scale ?? entity.scale),
    extent: {
      width: mix(sa?.extent?.width ?? entity.extent?.width ?? 400, sb?.extent?.width ?? entity.extent?.width ?? 400),
      height: mix(sa?.extent?.height ?? entity.extent?.height ?? 400, sb?.extent?.height ?? entity.extent?.height ?? 400),
      rotation: mix(sa?.extent?.rotation ?? entity.extent?.rotation ?? 0, sb?.extent?.rotation ?? entity.extent?.rotation ?? 0),
      normalized: entity.extent?.normalized ?? true
    },
    tint: t < 0.5 ? sa?.tint ?? entity.tint : sb?.tint ?? entity.tint,
    tintWeight: mix(sa?.tintWeight ?? entity.tintWeight, sb?.tintWeight ?? entity.tintWeight),
    forces: {
      mode: t < 0.5 ? fa.mode : fb.mode,
      strength: mix(fa.strength, fb.strength),
      radius: mix(fa.radius, fb.radius),
      spin: mix(fa.spin, fb.spin)
    },
    sequence
  };
}
export {
  resolveEntityPose
};
