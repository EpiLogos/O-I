function automationLeader(lanes, lane) {
  const seen = /* @__PURE__ */ new Set();
  let current = lane;
  while (current.syncWith) {
    if (seen.has(current.id)) throw new Error("Automation links cannot form a cycle.");
    seen.add(current.id);
    const parent = lanes.find((l) => l.id === current.syncWith);
    if (!parent) throw new Error("Linked automation is missing.");
    current = parent;
  }
  if (seen.has(current.id)) throw new Error("Automation links cannot form a cycle.");
  return current;
}
function resolvedAutomation(lanes, lane) {
  const leader = automationLeader(lanes, lane);
  if (leader === lane) return lane;
  return { ...lane, type: leader.type, wave: leader.wave, rate: leader.rate, phase: leader.phase, duration: leader.duration, delay: leader.delay, loop: leader.loop, easing: leader.easing, firedAt: leader.firedAt, enabled: lane.enabled && leader.enabled };
}
function linkAutomation(lanes, id, parentId) {
  const lane = lanes.find((l) => l.id === id);
  if (!lane) throw new Error("Automation no longer exists.");
  const before = lane.syncWith;
  if (!parentId) {
    const resolved = resolvedAutomation(lanes, lane);
    Object.assign(lane, resolved);
    delete lane.syncWith;
    delete lane.clockId;
    return;
  }
  lane.syncWith = parentId;
  try {
    automationLeader(lanes, lane);
  } catch (error) {
    lane.syncWith = before;
    throw error;
  }
}
function removeAutomation(lanes, id) {
  for (const lane of lanes.filter((l) => l.syncWith === id)) linkAutomation(lanes, lane.id, "");
  return lanes.filter((l) => l.id !== id);
}
function validateAutomationLinks(lanes) {
  const ids = /* @__PURE__ */ new Set();
  for (const lane of lanes) {
    if (ids.has(lane.id)) throw new Error("Duplicate automation id.");
    ids.add(lane.id);
    if (lane.clockId !== void 0) {
      if (typeof lane.clockId !== "string") throw new Error("Invalid automation clock.");
      if (!lane.clockId) delete lane.clockId;
    }
    if (lane.syncWith !== void 0 && typeof lane.syncWith !== "string") throw new Error("Invalid automation link.");
    automationLeader(lanes, lane);
  }
}
function automationGroups(lanes) {
  return lanes.filter((l) => !l.syncWith).map((leader) => ({ leader, targets: lanes.filter((l) => automationLeader(lanes, l).id === leader.id) }));
}
function removeGroupTarget(lanes, id) {
  const lane = lanes.find((l) => l.id === id);
  if (!lane) return lanes;
  const leader = automationLeader(lanes, lane);
  if (leader.id !== id) return lanes.filter((l) => l.id !== id);
  const targets = lanes.filter((l) => l.id !== id && automationLeader(lanes, l).id === id), next = targets[0];
  if (next) {
    Object.assign(next, resolvedAutomation(lanes, next));
    delete next.syncWith;
    next.clockId = leader.clockId || leader.nativeId || leader.id;
    for (const target of targets.slice(1)) target.syncWith = next.id;
  }
  return lanes.filter((l) => l.id !== id);
}
function offsetAutomatedTarget(lanes, target, delta) {
  const lane = lanes.filter((l) => l.target === target && resolvedAutomation(lanes, l).enabled).at(-1);
  if (!lane || lane.blend !== "replace" || !Number.isFinite(delta)) return false;
  lane.min += delta;
  lane.max += delta;
  return true;
}
export {
  automationGroups,
  automationLeader,
  linkAutomation,
  offsetAutomatedTarget,
  removeAutomation,
  removeGroupTarget,
  resolvedAutomation,
  validateAutomationLinks
};
