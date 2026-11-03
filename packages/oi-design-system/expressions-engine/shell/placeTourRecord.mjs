const TOUR_LIMIT = 16;
const TOUR_STOP_LIMIT = 32;
const TOUR_CAPTION_MAX = 280;
const TOUR_HOLD_MAX_MS = 6e4;
const TOUR_NAME_MAX = 160;
const TOUR_REF_MAX = 1024;
const TOUR_MOMENT_EDGE_MAX = 64;
const TOUR_FLIGHT_MS = 1800;
const RESERVED_TOUR_NAMES = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
const STOP_KEYS = ["place_ref", "viewport", "caption", "hold_ms", "binding", "moment", "thing_ref"];
const MOMENT_KEYS = ["from", "to"];
const VIEWPORT_KEYS = ["x", "y", "zoom", "pitch", "bearing"];
const BINDING_KEYS = ["expression_ref", "scene_ref"];
function ref(value) {
  return typeof value === "string" && value.length > 0 && value.length <= TOUR_REF_MAX;
}
function finiteIn(value, low, high) {
  return typeof value === "number" && Number.isFinite(value) && value >= low && value <= high;
}
function onlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function placeTourNameProblem(name, existing) {
  const trimmed = name.trim();
  if (!trimmed) return "Name the tour first.";
  if (trimmed.length > TOUR_NAME_MAX) return `A tour name is at most ${TOUR_NAME_MAX} characters.`;
  if (RESERVED_TOUR_NAMES.has(trimmed)) return "That name is reserved; choose another.";
  if (!Object.hasOwn(existing, trimmed) && Object.keys(existing).length >= TOUR_LIMIT) return `A Scene keeps at most ${TOUR_LIMIT} tours. Remove one before recording another.`;
  return null;
}
function placeTourProblem(value) {
  if (!isObject(value) || !onlyKeys(value, ["stops"])) return "A tour is a list of stops.";
  const stops = value.stops;
  if (!Array.isArray(stops)) return "A tour is a list of stops.";
  if (stops.length === 0) return "A tour needs at least one stop.";
  if (stops.length > TOUR_STOP_LIMIT) return `A tour holds at most ${TOUR_STOP_LIMIT} stops.`;
  for (const [index, stop] of stops.entries()) {
    const at = `Stop ${index + 1}`;
    if (!isObject(stop) || !onlyKeys(stop, STOP_KEYS)) return `${at} carries a field a tour stop does not keep.`;
    if (stop.place_ref !== null && !ref(stop.place_ref)) return `${at} names a place ref that is not a ref.`;
    const viewport = stop.viewport;
    if (!isObject(viewport) || !onlyKeys(viewport, VIEWPORT_KEYS)) return `${at} viewport is not a camera.`;
    if (!finiteIn(viewport.x, -180, 180) || !finiteIn(viewport.y, -90, 90) || !finiteIn(viewport.zoom, 1e-3, 1e5)) return `${at} viewport is outside the globe or its zoom bound.`;
    if (!finiteIn(viewport.pitch ?? 0, 0, 85) || !finiteIn(viewport.bearing ?? 0, -180, 180)) return `${at} viewport pitch or bearing is outside its bound.`;
    if (stop.caption !== null && (typeof stop.caption !== "string" || stop.caption.length > TOUR_CAPTION_MAX)) return `${at} caption is at most ${TOUR_CAPTION_MAX} characters.`;
    if (!Number.isInteger(stop.hold_ms) || !finiteIn(stop.hold_ms, 0, TOUR_HOLD_MAX_MS)) return `${at} hold is between 0 and ${TOUR_HOLD_MAX_MS} ms.`;
    if (stop.binding !== void 0) {
      const binding = stop.binding;
      if (!isObject(binding) || !onlyKeys(binding, BINDING_KEYS) || !ref(binding.expression_ref) || !ref(binding.scene_ref)) return `${at} journey binding is not a pair of refs.`;
    }
    if (stop.moment !== void 0 && !placeTourMoment(stop.moment)) return `${at} moment is not a window: a from and a to, each a time of at most ${TOUR_MOMENT_EDGE_MAX} characters or open, and not both open.`;
    if (stop.thing_ref !== void 0 && !ref(stop.thing_ref)) return `${at} names a thing that is not a ref.`;
  }
  return null;
}
function placeTourMoment(value) {
  if (!isObject(value) || !onlyKeys(value, MOMENT_KEYS) || !MOMENT_KEYS.every((key) => Object.hasOwn(value, key))) return false;
  const edge = (bound) => bound === null || typeof bound === "string" && bound.length <= TOUR_MOMENT_EDGE_MAX;
  return edge(value.from) && edge(value.to) && (value.from !== null || value.to !== null);
}
function appendTourStop(tour, stop) {
  const record = { stops: [...tour.stops, stop] };
  const problem = placeTourProblem(record);
  return problem ? { record: tour, problem } : { record, problem: null };
}
function removeTourStop(tour, index) {
  return { stops: tour.stops.filter((_, at) => at !== index) };
}
function withStopBinding(tour, index, binding) {
  return { stops: tour.stops.map((stop, at) => {
    if (at !== index) return stop;
    const { binding: _previous, ...rest } = stop;
    return binding === null ? rest : { ...rest, binding: { expression_ref: binding.expression_ref, scene_ref: binding.scene_ref } };
  }) };
}
function resolveTourBindings(tour, beats) {
  return tour.stops.map((stop) => {
    if (!stop.binding) return { state: "none", binding: null, reason: null };
    const held = beats.some((beat) => beat.expression_ref === stop.binding.expression_ref && beat.scene_ref === stop.binding.scene_ref);
    if (held) return { state: "bound", binding: stop.binding, reason: null };
    return { state: "unbound", binding: stop.binding, reason: "The journey no longer holds this beat. The stop stays, and its binding stays on the record until you choose Not bound." };
  });
}
export {
  TOUR_CAPTION_MAX,
  TOUR_FLIGHT_MS,
  TOUR_HOLD_MAX_MS,
  TOUR_LIMIT,
  TOUR_MOMENT_EDGE_MAX,
  TOUR_NAME_MAX,
  TOUR_REF_MAX,
  TOUR_STOP_LIMIT,
  appendTourStop,
  placeTourMoment,
  placeTourNameProblem,
  placeTourProblem,
  removeTourStop,
  resolveTourBindings,
  withStopBinding
};
