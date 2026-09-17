import { createHash } from 'node:crypto';
import { validateProjection } from './index.mjs';
import { worldPresentationFromProjection } from './presentation-projection.mjs';

/**
 * Standalone HTML edition of a projected WorldPresentation.
 *
 * The edition is transport/presentation material: bytes a static host can
 * serve while the source workstation is offline. It is rendered only from the
 * Projection contract, so anything the Projection excluded cannot reach the
 * page, its embedded JSON or its manifest. The manifest digest identifies bytes;
 * it is not authorship, permission or confidentiality.
 */
export const WORLD_EDITION_MANIFEST_SCHEMA = 'oi.world-edition-manifest/v1';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function refLink(ref, exploreBase) {
  const href = `${exploreBase}?ref=${encodeURIComponent(ref)}`;
  return `<a class="ref" href="${escapeHtml(href)}">${escapeHtml(ref)}</a>`;
}

function renderBinding(binding, exploreBase) {
  const title = binding.props.title ?? binding.fallback.title ?? binding.component_ref;
  const body = binding.props.text ?? binding.fallback.text ?? '';
  const refs = Array.isArray(binding.props.refs) ? binding.props.refs : [];
  const renderer = binding.portable_renderer ?? binding.component_ref;
  const subject = binding.subject_ref ? `<div class="subject">${refLink(binding.subject_ref, exploreBase)}</div>` : '';
  const list = refs.length ? `<ul class="refs">${refs.map((ref) => `<li>${refLink(ref, exploreBase)}</li>`).join('')}</ul>` : '';
  return `<section class="binding" data-renderer="${escapeHtml(renderer)}" data-binding="${escapeHtml(binding.binding_ref)}">` +
    `<h3>${escapeHtml(title)}</h3>${body ? `<p>${escapeHtml(body)}</p>` : ''}${subject}${list}</section>`;
}

export function renderWorldEdition(projectionValue, options = {}) {
  const projection = validateProjection(projectionValue);
  const presentation = worldPresentationFromProjection(projection);
  const exploreBase = typeof options.explore_base === 'string' ? options.explore_base : '/explore.html';
  const regions = presentation.regions.map((region) =>
    `<section class="region" data-region="${escapeHtml(region.region_ref)}" data-role="${escapeHtml(region.role)}">` +
    (region.label ? `<h2>${escapeHtml(region.label)}</h2>` : '') +
    region.bindings.map((binding) => renderBinding(binding, exploreBase)).join('') +
    '</section>').join('');
  const embedded = JSON.stringify(projection).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(presentation.title)}</title>
<meta name="oi:projection-ref" content="${escapeHtml(projection.projection_ref)}">
<meta name="oi:projection-revision" content="${projection.projection_revision}">
<meta name="oi:world-ref" content="${escapeHtml(presentation.world_ref)}">
<meta name="oi:source-revision" content="${escapeHtml(projection.source.revision)}">
<style>
:root{color-scheme:light dark;--ink:#1c1b1a;--paper:#f7f5f1;--line:#d9d4cc;--accent:#2f5f8f}
@media(prefers-color-scheme:dark){:root{--ink:#e8e4dd;--paper:#151412;--line:#3a3733;--accent:#8fb6dd}}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 system-ui,sans-serif}
main{max-width:52rem;margin:0 auto;padding:2rem 1.25rem}
header.edition{border-bottom:1px solid var(--line);padding-bottom:1rem;margin-bottom:1.5rem}
header.edition small{display:block;opacity:.7;font-family:ui-monospace,monospace;font-size:.8rem;word-break:break-all}
.region{margin:1.5rem 0}.binding{border:1px solid var(--line);border-radius:.5rem;padding:1rem;margin:.75rem 0}
.binding h3{margin:0 0 .25rem}.refs{padding-left:1.25rem}a.ref{color:var(--accent);font-family:ui-monospace,monospace;font-size:.85rem;word-break:break-all}
</style>
</head>
<body>
<main>
<header class="edition">
<div class="mark">{O:I}</div>
<h1>${escapeHtml(presentation.title)}</h1>
${presentation.summary ? `<p>${escapeHtml(presentation.summary)}</p>` : ''}
<small>${escapeHtml(projection.projection_ref)} · revision ${projection.projection_revision} · source ${escapeHtml(projection.source.system)} ${escapeHtml(projection.source.revision)}</small>
<small>${refLink(presentation.world_ref, exploreBase)}</small>
</header>
${regions}
<footer><small>Projection edition. The native source remains canonical; this page is a selected outward representation and is not writable.</small></footer>
</main>
<script type="application/json" id="oi-projection">${embedded}</script>
</body>
</html>
`;
}

export function worldEditionManifest(projectionValue, html, options = {}) {
  const projection = validateProjection(projectionValue);
  const presentation = worldPresentationFromProjection(projection);
  return {
    schema: WORLD_EDITION_MANIFEST_SCHEMA,
    projection_ref: projection.projection_ref,
    projection_revision: projection.projection_revision,
    world_ref: presentation.world_ref,
    presentation_ref: presentation.presentation_ref,
    presentation_revision: presentation.revision,
    source: { ...projection.source },
    audience: { ...projection.audience },
    published_at: projection.published_at,
    page: options.page ?? 'index.html',
    projection_file: options.projection_file ?? 'projection.json',
    digest: { algorithm: 'sha256', value: createHash('sha256').update(html).digest('hex'), identifies: 'bytes', is_not: ['authorship', 'permission', 'confidentiality'] },
  };
}
