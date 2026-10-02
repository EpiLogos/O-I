import { clone, entity, uid } from "./model.mjs";
const color = (value) => typeof value === "string" && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value);
const finite = (v, low, high) => typeof v === "number" && Number.isFinite(v) && v >= low && v <= high;
const text = (v, max = 4096) => typeof v === "string" && v.length <= max;
const object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
function require2(value, message) {
  if (!value) throw new Error(message);
}
function keys(value, allowed) {
  require2(Object.keys(value).every((key) => allowed.includes(key)), "Unknown research presentation field");
}
function validateResearchContent(content) {
  require2(text(content, 65536), "Research note exceeds 64 KiB");
  const blocks = JSON.parse(content);
  require2(Array.isArray(blocks) && blocks.length <= 256, "Research note requires bounded BlockNote blocks");
  const inspect = (v, depth = 0) => {
    require2(depth <= 24, "Research note nesting exceeds its bound");
    if (Array.isArray(v)) {
      require2(v.length <= 1024, "Research note array exceeds its bound");
      v.forEach((x) => inspect(x, depth + 1));
    } else if (object(v)) for (const [key, value] of Object.entries(v)) {
      require2(!["__proto__", "prototype", "constructor"].includes(key), "Unsafe note property");
      if (key === "type") require2(!["image", "video", "audio", "file"].includes(String(value)), "Insert media through the native image/resource action");
      if (key === "href") require2(typeof value === "string" && /^(https?:|mailto:)/i.test(value), "Unsupported note link");
      if (key === "url") require2(!value, "Note media requires a native resource binding");
      inspect(value, depth + 1);
    }
    else require2(v === null || typeof v === "boolean" || typeof v === "string" || typeof v === "number" && Number.isFinite(v), "Invalid note value");
  };
  inspect(blocks);
}
function emptyResearchMaterial() {
  return { schema: "oi.research-scene/v1", cards: {}, strokes: [], views: {}, timeline: {}, frames: {}, namedViews: {} };
}
function pruneResearchOccurrence(scene, id) {
  if (!scene.research) return;
  delete scene.research.cards[id];
  const frames = scene.research.frames ??= {};
  const namedViews = scene.research.namedViews ??= {};
  for (const frame of Object.values(frames)) frame.memberRefs = frame.memberRefs.filter((ref) => ref !== id);
  for (const key of Object.keys(frames)) if (!frames[key].memberRefs.length) delete frames[key];
  for (const view of Object.values(namedViews)) view.selectedRefs = view.selectedRefs.filter((ref) => ref !== id);
}
function validateResearchMaterial(value, ids) {
  require2(object(value), "Research material must be an object");
  keys(value, ["schema", "cards", "strokes", "views", "timeline", "frames", "namedViews"]);
  require2(value.schema === "oi.research-scene/v1", "Unsupported research material");
  require2(new TextEncoder().encode(JSON.stringify(value)).length <= 262144, "Research material exceeds 256 KiB");
  for (const key of ["cards", "views", "timeline"]) require2(object(value[key]) && Object.keys(value[key]).length <= (key === "views" ? 16 : 256), "Research record count exceeds its bound");
  if (value.frames !== void 0) require2(object(value.frames) && Object.keys(value.frames).length <= 64, "Research frame count exceeds its bound");
  if (value.namedViews !== void 0) require2(object(value.namedViews) && Object.keys(value.namedViews).length <= 32, "Research named view count exceeds its bound");
  for (const [, frame] of Object.entries(value.frames ?? {})) {
    require2(object(frame), "Invalid frame");
    keys(frame, ["label", "memberRefs", "z"]);
    require2(text(frame.label, 160) && !!frame.label, "Invalid frame label");
    require2(Array.isArray(frame.memberRefs) && frame.memberRefs.length >= 1 && frame.memberRefs.length <= 64 && frame.memberRefs.every((ref) => typeof ref === "string" && ids.has(ref)), "Invalid frame membership");
    require2(Number.isInteger(frame.z), "Invalid frame order");
  }
  for (const [, view] of Object.entries(value.namedViews ?? {})) {
    require2(object(view), "Invalid named view");
    keys(view, ["viewport", "selectedRefs", "frameOrder"]);
    validateViewport(view.viewport);
    require2(Array.isArray(view.selectedRefs) && view.selectedRefs.length <= 64 && view.selectedRefs.every((ref) => typeof ref === "string"), "Invalid view selection");
    require2(Array.isArray(view.frameOrder) && view.frameOrder.length <= 64 && view.frameOrder.every((ref) => typeof ref === "string"), "Invalid view frame order");
  }
  for (const [id, card] of Object.entries(value.cards)) {
    require2(ids.has(id) && object(card), "Research card must address an existing occurrence");
    keys(card, ["type", "importedAt", "content", "caption", "color", "dotColour", "bgColour", "textColour", "size"]);
    require2(["note", "image"].includes(card.type), "Unknown research card kind");
    if (card.importedAt !== void 0) require2(card.type === "image" && text(card.importedAt, 64) && Number.isFinite(Date.parse(card.importedAt)), "Invalid image import time");
    if (card.content !== void 0) {
      require2(card.type === "note", "Only note cards carry note content");
      validateResearchContent(card.content);
    }
    for (const key of ["caption"]) if (card[key] !== void 0) require2(text(card[key]), "Research caption exceeds its bound");
    for (const key of ["color", "dotColour", "bgColour", "textColour"]) if (card[key] !== void 0) require2(color(card[key]), "Research colour is invalid");
    if (card.size !== void 0) {
      require2(object(card.size), "Invalid card display size");
      keys(card.size, ["width", "height"]);
      require2(finite(card.size.width, 40, 4e4) && finite(card.size.height, 40, 4e4), "Invalid card display size");
    }
  }
  require2(Array.isArray(value.strokes) && value.strokes.length <= 128, "Annotation count exceeds its bound");
  const seen = /* @__PURE__ */ new Set();
  for (const stroke of value.strokes) {
    require2(object(stroke), "Invalid annotation");
    keys(stroke, ["id", "points", "color", "width", "opacity", "createdAt"]);
    require2(text(stroke.id, 160) && !!stroke.id && !seen.has(stroke.id), "Duplicate annotation");
    seen.add(stroke.id);
    require2(color(stroke.color) && finite(stroke.width, 0.1, 100) && finite(stroke.opacity, 0, 1) && text(stroke.createdAt, 64) && Number.isFinite(Date.parse(stroke.createdAt)), "Invalid annotation style");
    require2(Array.isArray(stroke.points) && stroke.points.length > 0 && stroke.points.length <= 4096, "Annotation point budget exceeded");
    for (const p of stroke.points) require2(object(p) && finite(p.x, -4e4, 4e4) && finite(p.y, -4e4, 4e4) && (p.pressure === void 0 || finite(p.pressure, 0, 1)), "Invalid annotation point");
  }
  for (const view of Object.values(value.views)) validateViewport(view);
  for (const layout of Object.values(value.timeline)) {
    require2(object(layout), "Invalid timeline layout");
    keys(layout, ["offsetY", "width", "height", "lane", "layoutRevision"]);
    require2((layout.lane === void 0 || text(layout.lane, 1024)) && (layout.layoutRevision === void 0 || Number.isSafeInteger(layout.layoutRevision) && layout.layoutRevision >= 1), "Invalid timeline layout revision");
    require2(finite(layout.offsetY, -4e4, 4e4) && (layout.width === void 0 || finite(layout.width, 40, 4e4)) && (layout.height === void 0 || finite(layout.height, 40, 4e4)), "Invalid timeline layout");
  }
}
function validateViewport(v) {
  require2(object(v), "Invalid research viewport");
  keys(v, ["x", "y", "zoom"]);
  require2(finite(v.x, -1e8, 1e8) && finite(v.y, -1e8, 1e8) && finite(v.zoom, 1e-3, 1e5), "Research viewport exceeds its bound");
}
function notePlainText(content) {
  try {
    const blocks = JSON.parse(content);
    if (!Array.isArray(blocks)) return "";
    return blocks.map((raw) => {
      if (!raw || raw.type !== "paragraph" || !Array.isArray(raw.content)) return "";
      return raw.content.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join("");
    }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return "";
  }
}
function applyResearchMaterial(scene, action) {
  const next = clone(scene);
  const research = next.research ??= emptyResearchMaterial();
  research.frames ??= {};
  research.namedViews ??= {};
  const target = (id) => {
    const found = next.entities.find((e) => e.id === id);
    require2(found && !found.locked, "Occurrence is missing or locked");
    return found;
  };
  const card = (id) => {
    const e = target(id);
    return research.cards[id] ??= { type: e.source?.kind === "image" ? "image" : "note" };
  };
  switch (action.type) {
    // Canvas display size is Research Canvas presentation only. It must never
    // reach the entity's own `size`, which is the Expression's expressive
    // body — resizing a card on this Canvas is not editing the source.
    case "resize": {
      require2(finite(action.width, 40, 4e4) && finite(action.height, 40, 4e4), "Invalid card size");
      card(action.id).size = { width: action.width, height: action.height };
      break;
    }
    case "duplicate": {
      const original = target(action.id), copy = clone(original);
      copy.id = uid("research");
      copy.name = original.name + " copy";
      copy.position.x += 0.1;
      copy.position.y -= 0.1;
      delete copy.native;
      next.entities.push(copy);
      if (research.cards[action.id]) research.cards[copy.id] = clone(research.cards[action.id]);
      break;
    }
    case "create-card": {
      require2(finite(action.position.x, -100, 100) && finite(action.position.y, -100, 100), "Invalid card position");
      const title = action.title ?? (action.kind === "image" ? "Image" : "Note");
      require2(text(title, 160) && !!title, "Invalid card title");
      const e = entity(title, title.slice(0, 120), { ...action.position, z: 0 });
      e.id = uid("research");
      e.size = { x: 0.6, y: 0.4 };
      const c = { type: action.kind };
      if (action.kind === "note") {
        c.content = "[]";
        e.shape = "disc";
        e.text = "";
        for (const step of e.sequence.steps) {
          step.shape = "disc";
          step.text = "";
        }
      }
      if (action.kind === "image") {
        require2(typeof action.dataUrl === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(action.dataUrl), "Choose a PNG/JPEG/WebP image");
        require2(action.dataUrl.length <= 262144, "Image exceeds native document budget; select a smaller image");
        c.importedAt = (/* @__PURE__ */ new Date()).toISOString();
        e.source = { kind: "image", image: { dataUrl: action.dataUrl, mode: "luminance", threshold: 0.5, invert: false, scale: 1, name: title } };
      }
      next.entities.push(e);
      research.cards[e.id] = c;
      break;
    }
    case "card-content": {
      const c = card(action.id);
      require2(c.type === "note", "Only note cards own rich note content");
      validateResearchContent(action.content);
      c.content = action.content;
      const e = target(action.id);
      const flat = notePlainText(action.content);
      e.text = flat;
      e.name = flat.split("\n")[0].slice(0, 160) || "Note";
      for (const step of e.sequence.steps) {
        step.text = flat.slice(0, 120);
      }
      break;
    }
    case "card-caption":
      card(action.id).caption = action.caption;
      break;
    case "card-style":
      Object.assign(card(action.id), action.patch);
      break;
    case "annotation-add":
      research.strokes.push(clone(action.stroke));
      break;
    case "annotation-remove":
      research.strokes = research.strokes.filter((s) => s.id !== action.id);
      break;
    case "viewport":
      research.views[action.key] = clone(action.value);
      break;
    case "timeline-layout": {
      const previous = research.timeline[action.id];
      require2(action.expectedRevision === (previous?.layoutRevision ?? null), "Timeline layout changed; reload before editing again");
      research.timeline[action.id] = { ...clone(action.value), layoutRevision: (previous?.layoutRevision ?? 0) + 1 };
      break;
    }
    // A frame is a presentation grouping over existing occurrence ids — never
    // a constellation-membership change (that is the native owner's business
    // through its own explicit Action). Re-saving an existing frame id keeps
    // its current z so re-labelling or re-grouping never silently re-orders it.
    case "frame-save": {
      require2(text(action.label, 160) && !!action.label.trim(), "Invalid frame label");
      require2(Array.isArray(action.memberRefs) && action.memberRefs.length >= 1 && action.memberRefs.length <= 64, "A frame needs at least one member");
      const members = [...new Set(action.memberRefs)];
      for (const ref of members) require2(next.entities.some((e) => e.id === ref), "Frame member is missing");
      const existing = research.frames[action.id];
      research.frames[action.id] = { label: action.label, memberRefs: members, z: existing?.z ?? Object.keys(research.frames).length };
      break;
    }
    case "frame-remove":
      delete research.frames[action.id];
      break;
    case "frame-order": {
      const frame = research.frames[action.id];
      require2(frame, "Frame is missing");
      const others = Object.entries(research.frames).filter(([id]) => id !== action.id).map(([, f]) => f.z);
      frame.z = action.direction === "front" ? (others.length ? Math.max(...others) : frame.z) + 1 : (others.length ? Math.min(...others) : frame.z) - 1;
      break;
    }
    // A saved view restores camera plus the presentation state a person would
    // expect it to: which cards were selected, and which frame sits on top —
    // never a second copy of graph material.
    case "view-save": {
      require2(text(action.name, 160) && !!action.name.trim(), "Invalid view name");
      validateViewport(action.viewport);
      require2(Array.isArray(action.selectedRefs) && action.selectedRefs.length <= 64 && action.selectedRefs.every((ref) => typeof ref === "string"), "Invalid view selection");
      require2(Array.isArray(action.frameOrder) && action.frameOrder.length <= 64 && action.frameOrder.every((ref) => typeof ref === "string"), "Invalid view frame order");
      research.namedViews[action.name] = { viewport: clone(action.viewport), selectedRefs: [...action.selectedRefs], frameOrder: [...action.frameOrder] };
      break;
    }
    case "view-remove":
      delete research.namedViews[action.name];
      break;
  }
  require2(next.entities.length <= 32, "Scene authoring occurrence limit reached");
  validateResearchMaterial(research, new Set(next.entities.map((e) => e.id)));
  Object.assign(scene, next);
}
export {
  applyResearchMaterial,
  emptyResearchMaterial,
  pruneResearchOccurrence,
  validateResearchContent,
  validateResearchMaterial
};
