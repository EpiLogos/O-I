/**
 * A small, dependency-free Markdown → HTML converter for the FND-04
 * Markdown rendered view. Not CommonMark-complete: headings, paragraphs,
 * fenced code, unordered/ordered lists, GFM tables, emphasis, links and
 * images.
 * Everything else is escaped, never interpreted as raw HTML — the
 * rendered view has no ambient trust beyond what this converter
 * recognises. Images and relative links are resolved through
 * `resolveAsset` (the material route), never left as bare relative
 * paths the iframe's opaque origin could not otherwise reach.
 */
export interface MarkdownOptions {
  /** Resolve a relative asset/link path to a fetchable material URL. */
  resolveAsset: (path: string) => string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isAbsoluteUrl(target: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//");
}

// A resolved material URL is arbitrary owner-controlled text (a temp/user
// directory name, say) and can contain "_" or "*" -- the exact characters
// the emphasis passes below key on. Splicing an already-built <img>/<a>
// tag into the working text before those passes run would let a URL's own
// underscores be misread as emphasis markers, corrupting the tag -- and,
// for src/href, corrupting the resolved material reference itself (this
// broke real image loading before code/img/link output was protected: a
// temp path containing a single "_" paired across two JSON fields of the
// same encoded location was enough to wrap most of the URL in `<em>`).
// So every already-rendered fragment (code spans, images, links) is pulled
// out behind a numeric placeholder first and spliced back in only after
// emphasis processing is done, mirroring how CommonMark implementations
// protect inline code and raw HTML from further inline parsing.
function renderInline(raw: string, resolveAsset: (path: string) => string): string {
  const escaped = escapeHtml(raw);
  const protectedSpans: string[] = [];
  const protect = (html: string): string => {
    protectedSpans.push(html);
    return " " + (protectedSpans.length - 1) + " ";
  };
  let text = escaped.replace(/`([^`]+)`/g, (_match, code: string) => protect("<code>" + code + "</code>"));
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_match, alt: string, src: string) => {
    const resolved = isAbsoluteUrl(src) ? src : resolveAsset(src);
    return protect(`<img alt="${alt}" src="${resolved}">`);
  });
  text = text.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (_match, label: string, href: string) => {
    const resolved = isAbsoluteUrl(href) ? href : resolveAsset(href);
    return protect(`<a href="${resolved}" rel="noreferrer noopener">${label}</a>`);
  });
  text = text.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_match, a?: string, b?: string) => `<strong>${a ?? b}</strong>`);
  text = text.replace(/\*([^*]+)\*|_([^_]+)_/g, (_match, a?: string, b?: string) => `<em>${a ?? b}</em>`);
  text = text.replace(/ (\d+) /g, (_match, index: string) => protectedSpans[Number(index)]);
  return text;
}

export function renderMarkdown(source: string, options: MarkdownOptions): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(`<p>${renderInline(paragraph.join(" "), options.resolveAsset)}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      const tag = list.ordered ? "ol" : "ul";
      const items = list.items.map(item => `<li>${renderInline(item, options.resolveAsset)}</li>`).join("");
      blocks.push(`<${tag}>${items}</${tag}>`);
      list = null;
    }
  };

  // GFM tables: a header row of pipe-separated cells, a delimiter row of
  // `---`/`:-:` cells, then body rows until a blank line. Only the two
  // shapes this document set uses (plain and header-aligned cells); cells
  // render through the same inline pass as everything else and stay
  // escaped.
  const splitRow = (line: string): string[] =>
    line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.trim());
  const isDelimiterRow = (line: string): boolean => {
    if (!line.includes("-") || !line.includes("|")) return false;
    const cells = splitRow(line);
    return cells.length > 0 && cells.every(cell => /^:?-+:?$/.test(cell));
  };
  const renderTable = (header: string[]): string => {
    index += 2; // header + delimiter
    const rows: string[][] = [];
    while (index < lines.length && lines[index].trim() !== "" && lines[index].includes("|")) {
      const cells = splitRow(lines[index]);
      while (cells.length < header.length) cells.push("");
      rows.push(cells.slice(0, header.length));
      index++;
    }
    const head = `<thead><tr>${header.map(cell => `<th>${renderInline(cell, options.resolveAsset)}</th>`).join("")}</tr></thead>`;
    const body = `<tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${renderInline(cell, options.resolveAsset)}</td>`).join("")}</tr>`).join("")}</tbody>`;
    return `<table>${head}${body}</table>`;
  };

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const fence = /^```/.exec(line);
    const unordered = /^[-*+]\s+(.*)$/.exec(line);
    const ordered = /^\d+\.\s+(.*)$/.exec(line);

    if (fence) {
      flushParagraph();
      flushList();
      const codeLines: string[] = [];
      index++;
      while (index < lines.length && !/^```/.test(lines[index])) {
        codeLines.push(lines[index]);
        index++;
      }
      index++; // skip the closing fence (or end of input)
      blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInline(heading[2], options.resolveAsset)}</h${level}>`);
      index++;
      continue;
    }
    if (line.includes("|") && index + 1 < lines.length && isDelimiterRow(lines[index + 1])) {
      // A table may interrupt a paragraph (GFM): the pending paragraph is
      // flushed first, then the header row opens the table.
      flushParagraph();
      flushList();
      blocks.push(renderTable(splitRow(line)));
      continue;
    }
    if (unordered) {
      flushParagraph();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(unordered[1]);
      index++;
      continue;
    }
    if (ordered) {
      flushParagraph();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[1]);
      index++;
      continue;
    }
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      index++;
      continue;
    }
    paragraph.push(line.trim());
    index++;
  }
  flushParagraph();
  flushList();
  return blocks.join("\n");
}
