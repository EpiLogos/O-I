import { clone, entity, uid } from "./model.mjs";
import { validateConnector, CONNECTOR_KEY_MAX, CONNECTOR_RECORD_MAX } from "./canvasConnectors.mjs";
import { CANVAS_OBJECT_KINDS, CANVAS_TOOL_SPEC, STICKY_DEFAULT_PALETTE, isCanvasObjectKind, isPaletteKey, isShapeFill, isShapeGeometry } from "./canvasShapes.mjs";
import { EMBED_CARD_SIZE, MEDIA_CARD_SIZE, embedHost, embedUrlRecord, isCentralPathRef, mediaFileName } from "./canvasEmbeds.mjs";
import { FRAME_TITLE_MAX, frameTitleRecord } from "./canvasFrames.mjs";
import { TIMELINE_CATEGORY_IDS as CATEGORY_IDS } from "./timelineCategoryIds.mjs";
import { TOUR_LIMIT, placeTourNameProblem, placeTourProblem } from "./placeTourRecord.mjs";
const TIMELINE_VIEW_LIMIT = 32;
const TIMELINE_VIEW_REF_LIMIT = 64;
const TIMELINE_REF_MAX = 512;
const TIMELINE_CENTER_YEAR_LIMIT = 1e10;
const TIMELINE_PIXELS_PER_YEAR_RANGE = [1e-9, 1e14];
const TIMELINE_CATEGORY_IDS = CATEGORY_IDS;
const TIMELINE_STYLE_KEYS = ["dotColour", "bgColour", "textColour"];
const color = (value) => typeof value === "string" && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value);
const finite = (v, low, high) => typeof v === "number" && Number.isFinite(v) && v >= low && v <= high;
const viewNameAllowed = (name) => !["__proto__", "constructor", "prototype"].includes(name.trim());
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
  for (const frame of Object.values(frames)) frame.memberRefs = frame.memberRefs.filter((ref) => ref !== id);
  for (const key of Object.keys(frames)) if (!frames[key].memberRefs.length) delete frames[key];
}
function validateViewBasis(value) {
  require2(object(value), "Invalid view basis");
  keys(value, ["subject_ref", "binding_ref"]);
  require2(["subject_ref", "binding_ref"].every((key) => typeof value[key] === "string" && value[key].length > 0 && text(value[key], 1024)), "Invalid view basis");
}
function validateResearchMaterial(value, ids) {
  require2(object(value), "Research material must be an object");
  keys(value, ["schema", "cards", "strokes", "views", "timeline", "frames", "namedViews", "connectors", "placeViews", "placeLayers", "timelineViews", "placeTours"]);
  require2(value.schema === "oi.research-scene/v1", "Unsupported research material");
  require2(new TextEncoder().encode(JSON.stringify(value)).length <= 262144, "Research material exceeds 256 KiB");
  for (const key of ["cards", "views", "timeline"]) require2(object(value[key]) && Object.keys(value[key]).length <= (key === "views" ? 16 : 256), "Research record count exceeds its bound");
  if (value.frames !== void 0) require2(object(value.frames) && Object.keys(value.frames).length <= 64, "Research frame count exceeds its bound");
  if (value.namedViews !== void 0) require2(object(value.namedViews) && Object.keys(value.namedViews).length <= 32, "Research named view count exceeds its bound");
  for (const [, frame] of Object.entries(value.frames ?? {})) {
    require2(object(frame), "Invalid frame");
    keys(frame, ["label", "title", "memberRefs", "z"]);
    require2(text(frame.label, 160) && !!frame.label, "Invalid frame label");
    if (frame.title !== void 0) require2(text(frame.title, FRAME_TITLE_MAX) && !!frame.title.trim(), "Invalid frame title");
    require2(Array.isArray(frame.memberRefs) && frame.memberRefs.length >= 1 && frame.memberRefs.length <= 64 && frame.memberRefs.every((ref) => typeof ref === "string" && ids.has(ref)), "Invalid frame membership");
    require2(Number.isInteger(frame.z), "Invalid frame order");
  }
  for (const [, view] of Object.entries(value.namedViews ?? {})) {
    require2(object(view), "Invalid named view");
    keys(view, ["viewport", "selectedRefs", "frameOrder", "basis"]);
    if (view.basis !== void 0) validateViewBasis(view.basis);
    validateViewport(view.viewport);
    require2(Array.isArray(view.selectedRefs) && view.selectedRefs.length <= 64 && view.selectedRefs.every((ref) => typeof ref === "string"), "Invalid view selection");
    require2(Array.isArray(view.frameOrder) && view.frameOrder.length <= 64 && view.frameOrder.every((ref) => typeof ref === "string"), "Invalid view frame order");
  }
  if (value.placeViews !== void 0) require2(object(value.placeViews) && Object.keys(value.placeViews).length <= PLACE_VIEW_LIMIT, "Place view count exceeds its bound");
  for (const [name, view] of Object.entries(value.placeViews ?? {})) {
    require2(text(name, 160) && !!name.trim(), "Invalid place view name");
    validatePlaceView(view);
  }
  if (value.placeLayers !== void 0) validatePlaceLayersRecord(value.placeLayers);
  if (value.timelineViews !== void 0) require2(object(value.timelineViews) && Object.keys(value.timelineViews).length <= TIMELINE_VIEW_LIMIT, "Timeline view count exceeds its bound");
  for (const [name, view] of Object.entries(value.timelineViews ?? {})) {
    require2(text(name, 160) && !!name.trim(), "Invalid timeline view name");
    validateTimelineView(view);
  }
  if (value.placeTours !== void 0) require2(object(value.placeTours) && Object.keys(value.placeTours).length <= TOUR_LIMIT, "Place tour count exceeds its bound");
  for (const [name, tour] of Object.entries(value.placeTours ?? {})) {
    require2(text(name, 160) && !!name.trim(), "Invalid place tour name");
    const problem = placeTourProblem(tour);
    require2(problem === null, problem ?? "");
  }
  for (const [id, card] of Object.entries(value.cards)) {
    require2(ids.has(id) && object(card), "Research card must address an existing occurrence");
    keys(card, ["type", "importedAt", "content", "caption", "color", "dotColour", "bgColour", "textColour", "size", "palette", "shape", "fill", "url", "media"]);
    require2(["note", "image", "embed", "media", ...CANVAS_OBJECT_KINDS].includes(card.type), "Unknown research card kind");
    require2(card.type === "embed" ? embedUrlRecord(card.url) === card.url : card.url === void 0, "Invalid embed link");
    require2(card.type === "media" ? isCentralPathRef(card.media) : card.media === void 0, "Invalid media reference");
    if (card.palette !== void 0) require2(card.type === "sticky" && isPaletteKey(card.palette), "Invalid sticky colour");
    if (card.type === "shape") require2(isShapeGeometry(card.shape) && (card.fill === void 0 || isShapeFill(card.fill)), "Invalid shape");
    else require2(card.shape === void 0 && card.fill === void 0, "Only shape cards carry a geometry or fill");
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
  if (value.connectors !== void 0) {
    require2(object(value.connectors) && Object.keys(value.connectors).length <= CONNECTOR_RECORD_MAX, "Connector count exceeds its bound");
    for (const [edgeId, connector] of Object.entries(value.connectors)) {
      require2(text(edgeId, CONNECTOR_KEY_MAX) && !!edgeId, "Invalid connector edge");
      validateConnector(connector);
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
    keys(layout, ["offsetY", "width", "height", "lane", "layoutRevision", "style"]);
    require2((layout.lane === void 0 || text(layout.lane, 1024)) && (layout.layoutRevision === void 0 || Number.isSafeInteger(layout.layoutRevision) && layout.layoutRevision >= 1), "Invalid timeline layout revision");
    require2(finite(layout.offsetY, -4e4, 4e4) && (layout.width === void 0 || finite(layout.width, 40, 4e4)) && (layout.height === void 0 || finite(layout.height, 40, 4e4)), "Invalid timeline layout");
    if (layout.style !== void 0) validateTimelineStyle(layout.style);
  }
}
function validateTimelineStyle(value) {
  require2(object(value), "Invalid timeline style");
  keys(value, TIMELINE_STYLE_KEYS);
  for (const key of TIMELINE_STYLE_KEYS) if (value[key] !== void 0) require2(color(value[key]), "Timeline colour is invalid");
}
function validateTimelineView(value) {
  const ref = (v) => typeof v === "string" && text(v, TIMELINE_REF_MAX) && v.length > 0;
  require2(object(value), "Invalid timeline view");
  keys(value, ["camera", "projection", "relationLinks", "filters", "chainId", "frameNodeId", "workingSetRefs"]);
  const [zoomLow, zoomHigh] = TIMELINE_PIXELS_PER_YEAR_RANGE;
  require2(object(value.camera), "Invalid timeline view camera");
  keys(value.camera, ["centerYear", "pixelsPerYear"]);
  require2(finite(value.camera.centerYear, -TIMELINE_CENTER_YEAR_LIMIT, TIMELINE_CENTER_YEAR_LIMIT) && finite(value.camera.pixelsPerYear, zoomLow, zoomHigh), "Timeline view camera exceeds its bound");
  require2(value.projection === "chronology" || value.projection === "relations", "Invalid timeline view projection");
  require2(typeof value.relationLinks === "boolean", "Invalid timeline view relation links");
  const filters = value.filters;
  require2(object(filters), "Invalid timeline view filters");
  keys(filters, ["hiddenCategories", "relationTypes", "tags"]);
  require2(Array.isArray(filters.hiddenCategories) && filters.hiddenCategories.length <= TIMELINE_CATEGORY_IDS.length && filters.hiddenCategories.every((id) => typeof id === "string" && TIMELINE_CATEGORY_IDS.includes(id)), "Invalid timeline view category filter");
  require2(filters.relationTypes === null || Array.isArray(filters.relationTypes) && filters.relationTypes.length <= 256 && filters.relationTypes.every((name) => text(name, 160) && !!name), "Invalid timeline view relation filter");
  require2(Array.isArray(filters.tags) && filters.tags.length <= 256 && filters.tags.every((tag) => text(tag, 160) && !!tag), "Invalid timeline view tag filter");
  require2(value.chainId === null || ref(value.chainId), "Invalid timeline view walk");
  if (value.frameNodeId !== void 0) require2(ref(value.frameNodeId), "Invalid timeline view frame");
  require2(Array.isArray(value.workingSetRefs) && value.workingSetRefs.length <= TIMELINE_VIEW_REF_LIMIT && value.workingSetRefs.every(ref) && new Set(value.workingSetRefs).size === value.workingSetRefs.length, "Invalid timeline view working set");
}
function validateViewport(v) {
  require2(object(v), "Invalid research viewport");
  keys(v, ["x", "y", "zoom", "pitch", "bearing"]);
  require2(finite(v.x, -1e8, 1e8) && finite(v.y, -1e8, 1e8) && finite(v.zoom, 1e-3, 1e5) && (v.pitch === void 0 || finite(v.pitch, 0, 85)) && (v.bearing === void 0 || finite(v.bearing, -180, 180)), "Research viewport exceeds its bound");
}
const PLACE_VIEW_LIMIT = 32;
const PLACE_STANDINGS = ["factual", "mythic", "owner-vocabulary"];
const PLACE_BASEMAP_IDS = ["offline-ground", "osm-street", "eox-sentinel2", "esri-imagery", "esri-place-names"];
function validatePlaceLayers(value) {
  keys(value, ["relations", "standing", "basemap"]);
  if (value.relations !== void 0) require2(Array.isArray(value.relations) && value.relations.length <= 256 && value.relations.every((name) => text(name, 160)), "Invalid place view layers");
  if (value.standing !== void 0) require2(Array.isArray(value.standing) && value.standing.length <= PLACE_STANDINGS.length && value.standing.every((name) => PLACE_STANDINGS.includes(name)), "Invalid place view standing");
  if (value.basemap !== void 0) {
    require2(object(value.basemap), "Invalid place view basemap");
    keys(value.basemap, ["terrainVisible", "layers"]);
    require2(typeof value.basemap.terrainVisible === "boolean" && object(value.basemap.layers), "Invalid place view basemap");
    for (const [id, layer] of Object.entries(value.basemap.layers)) {
      require2(PLACE_BASEMAP_IDS.includes(id), "Unknown basemap layer");
      require2(object(layer), "Invalid basemap layer");
      keys(layer, ["visible", "opacity"]);
      require2(typeof layer.visible === "boolean" && finite(layer.opacity, 0, 1), "Invalid basemap layer");
    }
  }
}
function validatePlaceLayersRecord(value) {
  require2(object(value), "Invalid place layers");
  validatePlaceLayers(value);
}
function validatePlaceView(value) {
  require2(object(value), "Invalid place view");
  keys(value, ["viewport", "relations", "standing", "basemap", "window", "filter"]);
  if (value.filter !== void 0) require2(placeViewFilter(value.filter), "Invalid place view filter");
  validateViewport(value.viewport);
  require2(finite(value.viewport.x, -180, 180) && finite(value.viewport.y, -90, 90), "Place view camera exceeds the globe");
  validatePlaceLayers({ relations: value.relations, standing: value.standing, basemap: value.basemap });
  require2(value.window !== void 0, "Invalid place view window");
  if (value.window !== null) {
    require2(object(value.window), "Invalid place view window");
    keys(value.window, ["from", "to"]);
    require2(["from", "to"].every((key) => value.window[key] === null || typeof value.window[key] === "string" && text(value.window[key], 64)), "Invalid place view window");
  }
}
const PLACE_VIEW_FILTER_MAX = 2048;
const PLACE_VIEW_FILTER_KEYS = ["w", "c", "e", "k", "a", "t"];
function placeViewFilter(value) {
  if (typeof value !== "string" || value.length > PLACE_VIEW_FILTER_MAX) return false;
  if (value === "") return true;
  const seen = /* @__PURE__ */ new Set();
  return value.split("&").every((part) => {
    const at = part.indexOf("=");
    const key = part.slice(0, at), rest = part.slice(at + 1);
    if (at < 1 || !PLACE_VIEW_FILTER_KEYS.includes(key) || seen.has(key) || !rest || !/^[A-Za-z0-9_.,-]+$/.test(rest)) return false;
    seen.add(key);
    return true;
  });
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
function canvasObjectChoice(kind, geometry) {
  if (kind === "sticky") return "sticky";
  if (kind === "text") return "text";
  require2(isShapeGeometry(geometry), "A shape needs a geometry");
  return geometry;
}
function applyResearchMaterial(scene, action) {
  const next = clone(scene);
  if (action.type === "batch") {
    require2(text(action.label, 160) && !!action.label.trim(), "Invalid batch label");
    require2(Array.isArray(action.actions) && action.actions.length >= 1 && action.actions.length <= 256, "A batch holds one to 256 changes");
    for (const step of action.actions) {
      require2(step.type !== "batch", "A batch cannot hold another batch");
      applyResearchStep(next, step);
    }
  } else applyResearchStep(next, action);
  require2(next.entities.length <= 32, "Scene authoring occurrence limit reached");
  validateResearchMaterial(next.research, new Set(next.entities.map((e) => e.id)));
  Object.assign(scene, next);
}
function applyResearchStep(next, action) {
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
      const choice = isCanvasObjectKind(action.kind) ? canvasObjectChoice(action.kind, action.geometry) : void 0;
      const link = action.kind === "embed" ? embedUrlRecord(action.url) : null;
      require2(action.kind !== "embed" || link !== null, "Invalid embed link");
      require2(action.kind !== "media" || isCentralPathRef(action.media), "Invalid media reference");
      const title = action.title ?? (choice ? CANVAS_TOOL_SPEC[choice].label : link !== null ? embedHost(link) : isCentralPathRef(action.media) ? mediaFileName(action.media) : action.kind === "image" ? "Image" : "Note");
      require2(text(title, 160) && !!title, "Invalid card title");
      const e = entity(title, title.slice(0, 120), { ...action.position, z: 0 });
      if (action.id !== void 0) require2(text(action.id, 128) && /^[A-Za-z0-9_-]+$/.test(action.id) && !next.entities.some((x) => x.id === action.id), "Invalid card id");
      e.id = action.id ?? uid("research");
      e.size = { x: 0.6, y: 0.4 };
      const c = { type: action.kind };
      if (action.kind === "note") c.content = "[]";
      if (action.kind === "note" || choice || action.kind === "embed" || action.kind === "media") {
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
      if (choice) {
        const spec = CANVAS_TOOL_SPEC[choice];
        c.size = { ...spec.size };
        if (action.kind === "sticky") c.palette = STICKY_DEFAULT_PALETTE;
        if (action.kind === "shape") {
          c.shape = spec.geometry;
          c.fill = "none";
        }
      }
      if (link !== null) {
        c.url = link;
        c.size = { ...EMBED_CARD_SIZE };
      }
      if (action.kind === "media" && isCentralPathRef(action.media)) {
        c.media = clone(action.media);
        c.size = { ...MEDIA_CARD_SIZE };
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
    case "frame-save": {
      require2(text(action.label, 160) && !!action.label.trim(), "Invalid frame label");
      require2(Array.isArray(action.memberRefs) && action.memberRefs.length >= 1 && action.memberRefs.length <= 64, "A frame needs at least one member");
      const members = [...new Set(action.memberRefs)];
      for (const ref of members) require2(next.entities.some((e) => e.id === ref), "Frame member is missing");
      const existing = research.frames[action.id];
      research.frames[action.id] = { label: action.label, ...existing?.title !== void 0 ? { title: existing.title } : {}, memberRefs: members, z: existing?.z ?? Object.keys(research.frames).length };
      break;
    }
    case "frame-remove":
      delete research.frames[action.id];
      break;
    case "frame-title": {
      const frame = research.frames[action.id];
      require2(frame, "Frame is missing");
      const title = frameTitleRecord(action.title);
      if (title === null) delete frame.title;
      else frame.title = title;
      break;
    }
    case "frame-order": {
      const frame = research.frames[action.id];
      require2(frame, "Frame is missing");
      const others = Object.entries(research.frames).filter(([id]) => id !== action.id).map(([, f]) => f.z);
      frame.z = action.direction === "front" ? (others.length ? Math.max(...others) : frame.z) + 1 : (others.length ? Math.min(...others) : frame.z) - 1;
      break;
    }
    case "view-save": {
      require2(text(action.name, 160) && !!action.name.trim(), "Invalid view name");
      require2(viewNameAllowed(action.name), "That view name is reserved");
      validateViewport(action.viewport);
      require2(Array.isArray(action.selectedRefs) && action.selectedRefs.length <= 64 && action.selectedRefs.every((ref) => typeof ref === "string"), "Invalid view selection");
      require2(Array.isArray(action.frameOrder) && action.frameOrder.length <= 64 && action.frameOrder.every((ref) => typeof ref === "string"), "Invalid view frame order");
      if (action.basis !== void 0) validateViewBasis(action.basis);
      research.namedViews[action.name] = { viewport: clone(action.viewport), selectedRefs: [...action.selectedRefs], frameOrder: [...action.frameOrder], ...action.basis ? { basis: clone(action.basis) } : {} };
      break;
    }
    case "view-remove":
      delete research.namedViews[action.name];
      break;
    case "place-view-save": {
      require2(text(action.name, 160) && !!action.name.trim(), "Invalid view name");
      require2(viewNameAllowed(action.name), "That view name is reserved");
      research.placeViews ??= {};
      research.placeViews[action.name] = clone(action.place);
      break;
    }
    case "place-view-remove": {
      if (research.placeViews) {
        delete research.placeViews[action.name];
        if (!Object.keys(research.placeViews).length) delete research.placeViews;
      }
      break;
    }
    case "place-layers-set": {
      validatePlaceLayersRecord(action.value);
      research.placeLayers = clone(action.value);
      break;
    }
    case "place-tour-save": {
      const nameProblem = placeTourNameProblem(action.name, research.placeTours ?? {});
      require2(nameProblem === null, nameProblem ?? "");
      const tourProblem = placeTourProblem(action.tour);
      require2(tourProblem === null, tourProblem ?? "");
      research.placeTours ??= {};
      research.placeTours[action.name.trim()] = clone(action.tour);
      break;
    }
    case "place-tour-remove": {
      if (research.placeTours) {
        delete research.placeTours[action.name];
        if (!Object.keys(research.placeTours).length) delete research.placeTours;
      }
      break;
    }
    case "timeline-view-save": {
      require2(text(action.name, 160) && !!action.name.trim(), "Invalid timeline view name");
      require2(viewNameAllowed(action.name), "That view name is reserved");
      validateTimelineView(action.view);
      research.timelineViews ??= {};
      research.timelineViews[action.name] = clone(action.view);
      break;
    }
    case "timeline-view-remove": {
      if (research.timelineViews) {
        delete research.timelineViews[action.name];
        if (!Object.keys(research.timelineViews).length) delete research.timelineViews;
      }
      break;
    }
  }
}
function applyConnectorRecord(scene, edgeId, value) {
  require2(text(edgeId, CONNECTOR_KEY_MAX) && !!edgeId, "Invalid connector edge");
  const next = clone(scene);
  const research = next.research ??= emptyResearchMaterial();
  research.frames ??= {};
  research.namedViews ??= {};
  const connectors = { ...research.connectors ?? {} };
  if (value === null) delete connectors[edgeId];
  else {
    validateConnector(value);
    connectors[edgeId] = clone(value);
  }
  if (Object.keys(connectors).length) research.connectors = connectors;
  else delete research.connectors;
  validateResearchMaterial(research, new Set(next.entities.map((e) => e.id)));
  Object.assign(scene, next);
}
function sceneInDocument(doc, sceneId) {
  const scene = doc.scenes.find((item) => item.id === sceneId);
  if (!scene) throw new Error("The active Scene changed; nothing was imported.");
  return scene;
}
function refusalText(error) {
  return error instanceof Error ? error.message : String(error);
}
async function runCanvasImport(host, input) {
  const { sceneId, label, actions, links } = input;
  const batch = { type: "batch", label, actions };
  const kinds = links.map((link) => host.relationKind(link.relationKind));
  if (!links.length) {
    try {
      host.store.composite(label, (doc) => {
        applyResearchMaterial(sceneInDocument(doc, sceneId), batch);
      });
    } catch (error) {
      throw new Error(`Import refused, nothing was imported: ${refusalText(error)}`);
    }
    let reason = "the native owner did not acknowledge the cards";
    try {
      if (await host.saveCards()) return { connected: 0, skipped: [] };
    } catch (error) {
      reason = refusalText(error);
    }
    host.store.withdrawNewestStep(label);
    throw new Error(`Import refused, nothing was imported: ${reason}.`);
  }
  const before = host.kernelDocument(), topBefore = host.store.undoStack.at(-1);
  host.store.openSpanningGesture(label);
  const bound = /* @__PURE__ */ new Set(), skipped = [];
  try {
    const refs = links.map(() => host.bindingRef());
    const lines = links.flatMap((link, index) => link.connector ? [{ index, ref: refs[index], record: link.connector }] : []);
    applyResearchMaterial(sceneInDocument(host.store.document, sceneId), batch);
    host.store.touch();
    const relate = (occurrenceOf) => {
      const changes = [];
      links.forEach((link, index) => {
        const from = occurrenceOf(link.sourceViewId), to = occurrenceOf(link.targetViewId);
        if (!from || !to) {
          skipped.push(`${link.named} not imported: an end has no native occurrence yet`);
          return;
        }
        bound.add(index);
        changes.push({ change: "relation_bind", binding: { binding_ref: refs[index], native_owner: "oi", relation: { ref: `${refs[index]}:${kinds[index]}`, revision: "1", availability: "available" }, from_entity_ref: from, to_entity_ref: to, provenance: [] } });
      });
      if (!changes.length) throw new Error("none of its connections has an end the owner holds");
      return changes;
    };
    const sides = lines.length ? (journey) => {
      const target = sceneInDocument(journey, sceneId);
      for (const { index, ref, record } of lines) if (bound.has(index)) applyConnectorRecord(target, ref, record);
    } : void 0;
    await host.act(label, relate, sides);
    if (host.store.spanningLabel !== null) throw new Error("the owner answered the import without recording it");
    return { connected: bound.size, skipped };
  } catch (error) {
    const reason = refusalText(error);
    if (host.store.undoStack.at(-1) !== topBefore) throw new Error(`Import landed as one step, but: ${reason}`);
    let returned = true;
    if (before !== null) try {
      await host.rollback(before);
    } catch {
      returned = false;
    }
    host.store.abandonSpanningGesture();
    throw new Error(returned ? `Import refused, nothing was imported: ${reason}.` : `Import refused: ${reason}. The owner kept some of its cards and could not be returned to its state; reconcile the Expression before editing it.`);
  }
}
export {
  PLACE_BASEMAP_IDS,
  PLACE_VIEW_FILTER_MAX,
  PLACE_VIEW_LIMIT,
  TIMELINE_CENTER_YEAR_LIMIT,
  TIMELINE_PIXELS_PER_YEAR_RANGE,
  TIMELINE_REF_MAX,
  TIMELINE_VIEW_LIMIT,
  TIMELINE_VIEW_REF_LIMIT,
  applyConnectorRecord,
  applyResearchMaterial,
  emptyResearchMaterial,
  notePlainText,
  placeViewFilter,
  pruneResearchOccurrence,
  runCanvasImport,
  validatePlaceLayersRecord,
  validatePlaceView,
  validateResearchContent,
  validateResearchMaterial,
  validateTimelineStyle,
  validateTimelineView,
  validateViewBasis
};
