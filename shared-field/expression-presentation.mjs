export const EXPRESSION_PRESENTATION_RENDERER = 'oi.presentation/expression/v1';
export const EXPRESSION_PRESENTATION_SCHEMA = 'oi.expression-presentation/v1';

const FALLBACK_KINDS = new Set(['image', 'video', 'html']);
const AVAILABILITY = new Set(['available', 'unavailable', 'withheld', 'stale']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function record(value, name) { if (!isRecord(value)) throw new TypeError(`${name} must be an object`); return value; }
function text(value, name) { if (typeof value !== 'string' || value.trim() === '' || value.length>2048) throw new TypeError(`${name} must be non-empty text within 2048 characters`); return value; }
function revision(value, name) { if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be an integer >= 1`); return value; }
function keys(value, allowed, name) { const extra=Object.keys(value).filter(key=>!allowed.has(key)); if(extra.length) throw new TypeError(`${name} contains unsupported keys: ${extra.join(', ')}`); }
function reading(value, name) {
  record(value, name);
  keys(value, new Set(['ref','revision','availability']), name);
  const availability = text(value.availability, `${name}.availability`);
  if (!AVAILABILITY.has(availability)) throw new TypeError(`${name}.availability is unsupported`);
  return {ref:text(value.ref, `${name}.ref`), revision:text(value.revision, `${name}.revision`), availability};
}
function subject(value, index) {
  const name=`expression presentation.subjects[${index}]`;record(value,name);
  keys(value,new Set(['ref','revision','availability','sources']),name);
  const {sources:_,...base}=value;const result=reading(base,name);
  if(!Array.isArray(value.sources))throw new TypeError(`${name}.sources must be an array`);if(value.sources.length>256)throw new TypeError(`${name}.sources exceeds 256 readings`);
  result.sources=value.sources.map((entry,i)=>reading(entry,`${name}.sources[${i}]`));
  return result;
}
function representation(value, index) {
  const name = `expression presentation.representations[${index}]`; record(value, name);
  keys(value, new Set(['kind','representation','provenance','media_type','href','html']), name);
  const kind = text(value.kind, `${name}.kind`);
  if (!FALLBACK_KINDS.has(kind)) throw new TypeError(`${name}.kind must be image, video, or html`);
  if(!Array.isArray(value.provenance)||value.provenance.length===0)throw new TypeError(`${name}.provenance must be a non-empty array`);if(value.provenance.length>256)throw new TypeError(`${name}.provenance exceeds 256 readings`);
  const result = {kind, representation:reading(value.representation, `${name}.representation`), provenance:value.provenance.map((entry, i) => reading(entry, `${name}.provenance[${i}]`))};
  if (typeof value.media_type === 'string' && value.media_type) result.media_type = value.media_type;
  if (typeof value.href === 'string' && value.href) result.href = value.href;
  if (typeof value.html === 'string' && value.html) result.html = value.html;
  return result;
}

export function validateExpressionPresentation(value) {
  record(value, 'expression presentation');
  keys(value, new Set(['schema','expression_ref','expression_revision','scene_ref','live_renderer_ref','live_availability','subjects','representations']), 'expression presentation');
  if (value.schema !== EXPRESSION_PRESENTATION_SCHEMA) throw new TypeError(`Unsupported Expression presentation schema: ${value.schema}`);
  if (!Array.isArray(value.subjects)) throw new TypeError('expression presentation.subjects must be an array');
  if (!Array.isArray(value.representations)) throw new TypeError('expression presentation.representations must be an array');
  if(value.subjects.length>256||value.representations.length>256)throw new TypeError('expression presentation exceeds 256 subjects or representations');
  const result = {schema:EXPRESSION_PRESENTATION_SCHEMA, expression_ref:text(value.expression_ref, 'expression presentation.expression_ref'), expression_revision:revision(value.expression_revision, 'expression presentation.expression_revision'), live_renderer_ref:text(value.live_renderer_ref, 'expression presentation.live_renderer_ref'), live_availability:text(value.live_availability, 'expression presentation.live_availability'), subjects:value.subjects.map(subject), representations:value.representations.map(representation)};
  if (!AVAILABILITY.has(result.live_availability)) throw new TypeError('expression presentation.live_availability is unsupported');
  if(!result.expression_ref.startsWith('expression:'))throw new TypeError('expression presentation.expression_ref must be a native Expression ref');
  if (value.scene_ref !== undefined) {result.scene_ref = text(value.scene_ref, 'expression presentation.scene_ref');if(!result.scene_ref.startsWith(`${result.expression_ref}:scene:`))throw new TypeError('expression presentation.scene_ref must belong to expression_ref');}
  const subjectRefs=result.subjects.map(item=>item.ref);if(new Set(subjectRefs).size!==subjectRefs.length)throw new TypeError('expression presentation subjects contain duplicate refs');
  return result;
}

export function expressionPresentationFromBinding(binding) {
  record(binding, 'WorldPresentation binding');
  if ((binding.portable_renderer ?? binding.component_ref) !== EXPRESSION_PRESENTATION_RENDERER) throw new TypeError('WorldPresentation binding is not an Expression renderer');
  const expression = validateExpressionPresentation(record(binding.props, 'WorldPresentation binding.props').expression);
  if (binding.subject_ref && !expression.subjects.some(subject => subject.ref === binding.subject_ref)) throw new TypeError('WorldPresentation binding.subject_ref must be present in expression subjects');
  return expression;
}

/** Resolve only against explicit client admission; manifests never load code or acquire authority. */
export function resolveExpressionPresentation(binding, capability = {}) {
  const expression = expressionPresentationFromBinding(binding); record(capability, 'Expression renderer capability');
  const admitted = capability.renderer_ref === expression.live_renderer_ref && capability.available === true;
  const subjectsAvailable = expression.subjects.every(subject => subject.availability === 'available' && subject.sources.every(source=>source.availability==='available'));
  if (admitted && expression.live_availability === 'available' && subjectsAvailable) return {state:'live', expression, renderer_ref:expression.live_renderer_ref, focus_available:capability.focus === true, capture_available:capability.capture === true};
  const fallback = expression.representations.find(item => item.representation.availability === 'available' && ((item.kind==='html'&&typeof item.html==='string'&&item.html.length>0)||((item.kind==='image'||item.kind==='video')&&typeof item.href==='string'&&item.href.length>0)));
  if (fallback) return {state:'fallback', expression, fallback};
  const reason = !subjectsAvailable ? 'subject_unavailable' : expression.live_availability !== 'available' ? `live_${expression.live_availability}` : 'renderer_unavailable';
  return {state:'unavailable', expression, reason};
}
