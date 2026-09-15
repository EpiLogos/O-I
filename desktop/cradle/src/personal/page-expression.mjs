import {EXPRESSION_PRESENTATION_RENDERER, validateExpressionPresentation} from '../../../../shared-field/expression-presentation.mjs';

/** Turn a Personal Web page's first-class body into the canonical WorldPresentation binding. */
export function pageExpressionBinding(page, fileRevision) {
  if (!page?.page?.expression) return null;
  if (typeof fileRevision !== 'string' || !fileRevision) throw new Error('Beings/Things: page Expression requires the exact file revision');
  const expression = validateExpressionPresentation(page.page.expression);
  const subjectRef = page.bindings?.subjectRef;
  if (subjectRef && !expression.subjects.some(subject => subject.ref === subjectRef)) throw new Error('Beings/Things: page subject and Expression subjects do not match');
  return {
    binding_ref: `page:${page.meta.documentId ?? 'unminted'}:expression`,
    component_ref: EXPRESSION_PRESENTATION_RENDERER,
    portable_renderer: EXPRESSION_PRESENTATION_RENDERER,
    ...(subjectRef ? {subject_ref:subjectRef} : {}),
    props: {expression},
    fallback: {title:page.meta.title || expression.expression_ref, text:'This page carries an Expression body with an explicit portable fallback.'},
    provenance: [
      {kind:'personal-web-page', ref:page.bindings.worldRef ?? `page:${page.meta.documentId ?? 'unminted'}`, source_system:'central', revision:fileRevision},
      {kind:'expression', ref:expression.expression_ref, source_system:'o-i', revision:String(expression.expression_revision)},
    ],
  };
}
