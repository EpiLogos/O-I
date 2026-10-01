/** The portable authored HTML grammar, shared by publishers and readers.
 * It preserves inert prose, tables and code while removing executable material. */
export function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const ALLOWED_TAGS = new Set(['article', 'section', 'header', 'p', 'br', 'em', 'strong', 'i', 'b', 'u', 's', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'span', 'mark', 'sup', 'sub', 'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col']);
const DROPPED_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'form', 'input', 'button', 'textarea', 'select', 'link', 'meta', 'base', 'head', 'title']);

/**
 * Allowlist sanitiser for authored entry HTML. Only the tags above survive,
 * with no attributes except `href` on `<a>` (http/https/mailto), which
 * gains rel="noopener noreferrer". Dangerous elements are removed with
 * their content; unknown elements are unwrapped (content kept, tag dropped).
 */
export function sanitiseEntryHtml(html) {
  let out = '';
  let index = 0;
  const source = String(html ?? '');
  while (index < source.length) {
    const open = source.indexOf('<', index);
    if (open < 0) { out += source.slice(index); break; }
    out += source.slice(index, open);
    const close = source.indexOf('>', open);
    if (close < 0) { out += escapeHtml(source.slice(open)); break; }
    const tagText = source.slice(open + 1, close);
    if (tagText.startsWith('!--')) { const end = source.indexOf('-->', open); index = end < 0 ? source.length : end + 3; continue; }
    const match = /^\/?\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(tagText);
    if (!match) { out += escapeHtml(source.slice(open, close + 1)); index = close + 1; continue; }
    const name = match[1].toLowerCase();
    const closing = tagText.startsWith('/');
    if (DROPPED_WITH_CONTENT.has(name)) {
      if (!closing) {
        const endTag = new RegExp(`</${name}\\s*>`, 'i');
        endTag.lastIndex = 0;
        const rest = source.slice(close + 1);
        const found = endTag.exec(rest);
        index = found ? close + 1 + found.index + found[0].length : source.length;
      } else index = close + 1;
      continue;
    }
    if (!ALLOWED_TAGS.has(name)) { index = close + 1; continue; }
    if (closing) { out += name === 'br' || name === 'hr' ? '' : `</${name}>`; index = close + 1; continue; }
    if (name === 'a') {
      const href = /\shref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tagText);
      const raw = href ? (href[2] ?? href[3] ?? href[4] ?? '') : '';
      const safe = /^(https?:|mailto:)/i.test(raw.trim()) ? raw.trim() : '';
      out += safe ? `<a href="${escapeHtml(safe)}" rel="noopener noreferrer">` : '<a>';
    } else if (name === 'th' || name === 'td') {
      let attributes='';
      for (const attribute of ['colspan','rowspan']) {
        const match=new RegExp('\\s'+attribute+'\\s*=\\s*(?:"(\\d+)"|\'(\\d+)\'|(\\d+))','i').exec(tagText);
        const value=Number(match?.[1]??match?.[2]??match?.[3]);
        if(Number.isInteger(value)&&value>=1&&value<=1000)attributes+=` ${attribute}="${value}"`;
      }
      const scope=/\sscope\s*=\s*(?:"(row|col|rowgroup|colgroup)"|'(row|col|rowgroup|colgroup)'|(row|col|rowgroup|colgroup))/i.exec(tagText);
      if(name==='th'&&scope)attributes+=` scope="${(scope[1]??scope[2]??scope[3]).toLowerCase()}"`;
      out+=`<${name}${attributes}>`;
    } else if (name === 'br' || name === 'hr' || name === 'col') out += `<${name}>`;
    else out += `<${name}>`;
    index = close + 1;
  }
  return out;
}

export function htmlToText(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<\/li>/gi, '\n')
    .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n').trim();
}
