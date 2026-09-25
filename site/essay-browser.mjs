/** Publish the essay vault into the Plate B shell.
 *
 * Source of truth: Antykathera-Essay-Work `submission-package/essay/`.
 * This is a publication index, not a second vault: markdown stays in the essay
 * repo; the site receives a catalog and rendered pages. quilt/, NOTES,
 * reference-notes, and navigation JSON are not published.
 */
import { marked } from 'marked';
import { posix } from 'node:path';

export const ESSAY_REMOTE = 'https://github.com/EpiLogos/Antykathera-Essay-Work.git';
export const ESSAY_REF = 'fix/publish-readiness-2026-09-24';
export const MANUSCRIPT_ID = 'manuscript/THE-RETURN-OF-ZERO';
export const READING_ROOT = 'README';

export const OFFICES = [
  { id: 'section-rooms', label: 'Rooms' },
  { id: 'symbolon', label: 'Symbolon' },
  { id: 'symbolon/matheme', label: 'Matheme', child: true },
  { id: 'symbolon/mytheme', label: 'Mytheme', child: true },
  { id: 'symbolon/episteme', label: 'Episteme', child: true },
  { id: 'manuscript', label: 'Manuscript' },
];

const SKIP_DIRS = new Set(['quilt', '.obsidian', 'reference-notes']);

export function isPublishedMarkdown(rel) {
  const parts = rel.split('/');
  if (parts.some((part) => !part || part.startsWith('.') || SKIP_DIRS.has(part))) return false;
  if (!rel.endsWith('.md')) return false;
  const base = parts[parts.length - 1];
  if (base === 'NOTES.md' || base.endsWith('-NOTES.md')) return false;
  return true;
}

export function officeFor(id) {
  if (id.startsWith('symbolon/matheme/')) return 'symbolon/matheme';
  if (id.startsWith('symbolon/mytheme/')) return 'symbolon/mytheme';
  if (id.startsWith('symbolon/episteme/')) return 'symbolon/episteme';
  if (id.startsWith('symbolon/')) return 'symbolon';
  if (id.startsWith('section-rooms/')) return 'section-rooms';
  if (id.startsWith('manuscript/')) return 'manuscript';
  return null;
}

export function publishedId(sourceRel) {
  const id = sourceRel.replace(/\\/g, '/').replace(/\.md$/i, '');
  if (id === 'THE-RETURN-OF-ZERO') return MANUSCRIPT_ID;
  return id;
}

function splitFrontmatter(raw) {
  if (!raw.startsWith('---\n') && !raw.startsWith('---\r\n')) return { data: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end < 0) return { data: {}, body: raw };
  const yaml = raw.slice(raw.indexOf('\n') + 1, end);
  const body = raw.slice(end + 4).replace(/^\r?\n/, '');
  const data = {};
  for (const line of yaml.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!value || value === '|' || value === '>' || value.startsWith('[') || value.startsWith('{')) continue;
    data[match[1]] = value;
  }
  return { data, body };
}

function firstHeading(body) {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

function stripFirstHeading(body) {
  return body.replace(/^\s*#\s+.+\r?\n+/, '');
}

function metaLine(data) {
  const parts = [];
  if (data.page_type) parts.push(data.page_type.replace(/-/g, ' '));
  if (data.stage) parts.push(data.stage.replace(/-/g, ' '));
  if (data.station) parts.push(data.station);
  if (data.position) parts.push(data.position);
  if (data.claim_status) parts.push(data.claim_status);
  return parts.join(' · ');
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function protect(text, pattern, store, token) {
  return text.replace(pattern, (block) => {
    const index = store.length;
    store.push(block);
    return token(index);
  });
}

function essayHref(id, hash = '') {
  const path = id.split('/').map(encodeURIComponent).join('/');
  return `/essay/${path}${hash}`;
}

function buildIndexes(entries) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const byLower = new Map(entries.map((entry) => [entry.id.toLowerCase(), entry.id]));
  const byBase = new Map();
  const byTitle = new Map();
  for (const entry of entries) {
    const base = entry.id.split('/').pop().toLowerCase();
    const bases = byBase.get(base) ?? [];
    bases.push(entry.id);
    byBase.set(base, bases);
    const title = entry.title.toLowerCase();
    const titles = byTitle.get(title) ?? [];
    titles.push(entry.id);
    byTitle.set(title, titles);
  }
  return { byId, byLower, byBase, byTitle };
}

function lookupPath(raw, indexes) {
  const id = raw.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\.md$/i, '').replace(/\/+$/, '');
  if (!id || id.startsWith('..')) return null;
  if (id === 'THE-RETURN-OF-ZERO') return MANUSCRIPT_ID;
  if (indexes.byId.has(id)) return id;
  return indexes.byLower.get(id.toLowerCase()) ?? null;
}

function lookupWiki(raw, indexes) {
  const exact = lookupPath(raw.trim(), indexes);
  if (exact) return exact;
  const base = raw.trim().split('/').pop().replace(/\.md$/i, '').toLowerCase();
  const bases = indexes.byBase.get(base);
  if (bases?.length === 1) return bases[0];
  const titles = indexes.byTitle.get(raw.trim().toLowerCase());
  if (titles?.length === 1) return titles[0];
  return null;
}

function rewriteLinks(text, sourceRel, indexes) {
  const withoutEmbeds = text.replace(/!?\[\[([^\]|#]+)(#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_full, target, hash, label) => {
    const id = lookupWiki(target, indexes);
    const visible = (label || target).trim();
    if (!id) return visible;
    return `[${visible}](${essayHref(id, hash || '')})`;
  });
  return withoutEmbeds.replace(/\[([^\]]+)\]\((<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\)/g, (full, label, raw) => {
    let dest = raw.trim();
    if (dest.startsWith('<') && dest.endsWith('>')) dest = dest.slice(1, -1);
    if (dest.startsWith('/essay/')) return full;
    if (/^[a-z][a-z0-9+.-]*:/i.test(dest) || dest.startsWith('#') || dest.startsWith('/')) return dest.startsWith('/') ? label : full;
    const hashAt = dest.indexOf('#');
    const hash = hashAt >= 0 ? dest.slice(hashAt) : '';
    const pathPart = hashAt >= 0 ? dest.slice(0, hashAt) : dest;
    let decoded = pathPart;
    try { decoded = decodeURIComponent(pathPart); } catch { /* keep */ }
    const dir = posix.dirname(sourceRel);
    const joined = posix.normalize(posix.join(dir, decoded));
    const id = lookupPath(joined, indexes);
    if (!id) return label;
    return `[${label}](${essayHref(id, hash)})`;
  });
}

function collectLinks(text) {
  const ids = [];
  const seen = new Set();
  for (const match of text.matchAll(/\]\(\/essay\/([^)#\s]+)/g)) {
    let id = match[1];
    try { id = decodeURIComponent(id); } catch { /* keep */ }
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function liftFootnotes(text) {
  const defs = new Map();
  const body = text.replace(/^\[\^([^\]]+)\]:[ \t]*(.+)$/gm, (_line, id, note) => {
    defs.set(id, note.trim());
    return '';
  });
  const order = [];
  const withRefs = body.replace(/\[\^([^\]]+)\]/g, (original, id) => {
    if (!defs.has(id)) return original;
    if (!order.includes(id)) order.push(id);
    const safe = id.replace(/[^A-Za-z0-9_-]/g, '');
    const num = order.indexOf(id) + 1;
    return `<sup class="fn"><a href="#fn-${safe}" id="fnref-${safe}">${num}</a></sup>`;
  });
  return { text: withRefs, defs, order };
}

function renderMarkdown(sourceRel, raw, indexes) {
  const { data, body } = splitFrontmatter(raw);
  const title = data.title || firstHeading(body) || posix.basename(sourceRel, '.md');
  const prose = stripFirstHeading(body);
  const fences = [];
  const codes = [];
  const maths = [];
  let text = protect(prose, /```[\s\S]*?```/g, fences, (index) => `\n\n%%FENCE${index}%%\n\n`);
  text = protect(text, /`[^`\n]+`/g, codes, (index) => `%%CODE${index}%%`);
  text = protect(text, /\$\$[\s\S]+?\$\$/g, maths, (index) => `%%MATH${index}%%`);
  text = rewriteLinks(text, sourceRel, indexes);
  text = text.replace(/%%FENCE(\d+)%%/g, (_m, index) => fences[Number(index)]);
  text = text.replace(/%%CODE(\d+)%%/g, (_m, index) => codes[Number(index)]);
  const { text: footnoted, defs, order } = liftFootnotes(text);
  const links = collectLinks(`${footnoted}\n${[...defs.values()].join('\n')}`);
  let html = marked.parse(footnoted, { gfm: true, async: false });
  html = html.replace(/<p>%%MATH(\d+)%%<\/p>/g, (_m, index) => {
    const latex = maths[Number(index)].replace(/^\$\$/, '').replace(/\$\$$/, '').trim();
    return `<div class="math-display">$$${escapeHtml(latex)}$$</div>`;
  });
  html = html.replace(/%%MATH(\d+)%%/g, (_m, index) => {
    const latex = maths[Number(index)].replace(/^\$\$/, '').replace(/\$\$$/, '').trim();
    return `$$${escapeHtml(latex)}$$`;
  });
  html = html.replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noreferrer"');
  if (order.length) {
    const items = order.map((id) => {
      const safe = id.replace(/[^A-Za-z0-9_-]/g, '');
      const note = marked.parseInline(defs.get(id), { async: false });
      return `<li id="fn-${safe}">${note} <a href="#fnref-${safe}">↩</a></li>`;
    }).join('');
    html += `<section class="footnotes"><ol>${items}</ol></section>`;
  }
  return { title, meta: metaLine(data), html, links };
}

export function publishVault(files, source) {
  const entries = [];
  for (const file of files) {
    if (!isPublishedMarkdown(file.rel)) continue;
    const { data, body } = splitFrontmatter(file.text);
    const id = publishedId(file.rel);
    entries.push({
      id,
      sourceRel: file.rel,
      title: data.title || firstHeading(body) || posix.basename(file.rel, '.md'),
      text: file.text,
    });
  }
  const indexes = buildIndexes(entries);
  const pages = [];
  for (const entry of entries) {
    const rendered = renderMarkdown(entry.sourceRel, entry.text, indexes);
    pages.push({
      id: entry.id,
      office: officeFor(entry.id),
      title: rendered.title,
      meta: rendered.meta,
      html: rendered.html,
      links: rendered.links.filter((id) => indexes.byId.has(id) && id !== entry.id),
    });
  }
  pages.sort((a, b) => a.id.localeCompare(b.id));
  const catalog = {
    schema: 'oi.essay-browser/v1',
    source,
    readingRoot: READING_ROOT,
    manuscript: MANUSCRIPT_ID,
    aliases: {
      'THE-RETURN-OF-ZERO': MANUSCRIPT_ID,
      read: MANUSCRIPT_ID,
      manuscript: MANUSCRIPT_ID,
      index: READING_ROOT,
      README: READING_ROOT,
    },
    offices: OFFICES,
    files: pages.map(({ id, office, title, links }) => ({ id, office, title, links })),
  };
  return { catalog, pages };
}
