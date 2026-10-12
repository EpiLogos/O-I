import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GLYPHS,
  GLYPH_GROUPS,
  GLYPH_VIEWBOX,
  GROUP_LABELS,
  glyphNames,
  renderGlyph,
  renderGlyphChip,
  symbolMarkup,
} from "./glyphs.ts";

const dir = dirname(fileURLToPath(import.meta.url));
const names = glyphNames();

const sprite = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${GLYPH_VIEWBOX}">
  <!-- Glyph roster sprite. Each symbol id is the plain name. Colour is currentColor. -->
${names.map((name) => `  ${symbolMarkup(name)}`).join("\n")}
</svg>
`;
writeFileSync(join(dir, "roster.svg"), sprite);

function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const shared = [
  ["base", "central", "the diamond"],
  ["factory", "software-factory", "the hexagon"],
  ["panes", "four-fold", "the four-pane square"],
];

let md = `# Glyph roster

The icon language for the world shell. One sprite, [\`roster.svg\`](roster.svg). One typed module, [\`glyphs.ts\`](glyphs.ts). ${names.length} marks.

Every symbol is drawn on a 24×24 grid. Stroke marks use weight 1.5, round caps, and round joins. Marks the mockups filled stay filled: play, stop, record, the admit light, the beings figure, and the filled skill stand-ins.

A mark is coloured with \`currentColor\`. The button sets \`color\` to a token from \`packages/live-shell/ui/src/styles.css\`: \`var(--text)\`, \`var(--text-dim)\`, \`var(--text-faint)\`, \`var(--accent)\`, \`var(--rec)\`. Nothing inside a mark names a colour.

Geometry that already existed in the mockups is carried across. Skill stand-ins drawn on the 16-grid in \`agent-shell-mockup.html\` are scaled by 1.5. Where the mockup used a character, the mark is that character's plain meaning, and the entry says so.

## Use

Load the sprite once. Every use has an aria-label. The spoken name is the plain name, or a more specific phrase when the same mark means a mode's own verb (Play, Answer, Run, Walk).

\`\`\`html
<svg role="img" aria-label="Play" width="16" height="16" viewBox="0 0 24 24">
  <use href="roster.svg#play"/>
</svg>
\`\`\`

\`renderGlyph(name, { label, size })\` inlines the mark. \`renderGlyphUse\` points at the sprite. Both refuse an empty label.

The mockup tooltip pattern still applies to the control, not to the mark: \`data-i="Name|What it does"\`, read into the status line.

## States

\`refusing\`, \`disabled\`, and \`waiting\` are their own marks, drawn at full weight.

- A control the shell declines shows \`refusing\`.
- A control that is present and cannot be used shows \`disabled\`.
- A control that has not heard back shows \`waiting\`.
- A skill light that is on shows \`admit\`. A skill light that was refused shows \`deny\`.

A transport button's on state is the button's colour. Record's live colour is \`var(--rec)\`. Play's armed colour is \`var(--accent)\`. That colour is not a second glyph.

## Chips

Any text or image can become an engine glyph (\`AsciiToGlyphModal\`, \`ImageToGlyphModal\`, \`GlyphSampler\`). The chip is how that result sits in the shell. It is a UI frame, not the stage bake, and it does not carry the volume profiles in \`glyphVolume.ts\`.

| | |
|---|---|
| Sizes | 16, 20, 24. Default 24. |
| Frame | Square. Border \`1px solid var(--line)\`. Background \`var(--bg-0)\`. Ink inset 2. |
| Colour | \`currentColor\` for engine text and plain characters. An image keeps its own ink. |
| Engine or character | One line, \`var(--font-ui)\`. One grapheme is 0.7 of the inner box, the sampler's font-to-canvas ratio. A longer run shrinks so the advance stays inside 0.9 of the inner box. |
| Empty text | Drawn as \`O\`. That is the sampler's empty sample. |
| Newlines | Collapsed to spaces. The chip is one line. \`asciiLayout\` belongs to the bake. |
| Image | \`img\` with \`object-fit: contain\` inside the same frame. If the image fails, the chip shows \`waiting\`. |
| Label | \`aria-label\` is required. The engine text does not replace it. |

\`renderGlyphChip\` in \`glyphs.ts\` builds the chip. \`chipInk\` resolves the empty sample and the size.

## Shared drawings

${shared.map(([a, b, what]) => `- \`${a}\` and \`${b}\` share ${what}.`).join("\n")}
- Home uses \`earth\`.

## Left as they were

Bee portraits stay illustrations: they use each agent's own colour, which this roster does not bake in. Planet bodies stay the Earth projection's drawing. M0′–M5′ stay the text labels the mockup uses. Skill stand-ins keep the mockup's skill ids; an authored engine glyph replaces the picture through a chip.

When the widget-standards extraction names a control, that name is the one to follow. This roster uses the mockup's words and does not rename ahead of that extraction. The open alignment is in \`RESULT.json\`.

`;

for (const group of GLYPH_GROUPS) {
  const inGroup = names.filter((name) => GLYPHS[name].group === group);
  md += `\n## ${GROUP_LABELS[group]}\n\n`;
  for (const name of inGroup) {
    const g = GLYPHS[name];
    md += `### ${name}\n\n${g.meaning}\n\n- **Usage.** ${g.usage}\n- **States.** ${g.states}\n- **Appears.** ${g.appears}\n\n`;
  }
}
writeFileSync(join(dir, "GlyphRoster.md"), md);

const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#EFEFED"/><circle cx="32" cy="32" r="18" fill="none" stroke="#111" stroke-width="3"/><circle cx="32" cy="32" r="6" fill="none" stroke="#111" stroke-width="3"/></svg>`;
const imageSrc = `data:image/svg+xml,${encodeURIComponent(sampleSvg)}`;

const chipSources = [
  ["Engine glyph", { kind: "engine", text: "☉" }, "Sol, an engine glyph"],
  ["Engine run", { kind: "engine", text: "FLOW" }, "FLOW, an engine glyph run"],
  ["Plain character", { kind: "character", text: "A" }, "Plain character A"],
  ["Empty falls back to O", { kind: "engine", text: "   " }, "Empty engine glyph"],
  ["Authored image", { kind: "image", src: imageSrc, alt: "Concentric sample" }, "Authored image chip"],
  ["Image missed, so waiting", { kind: "image", src: "missing-glyph.png", alt: "" }, "Missing image chip"],
];

function card(name) {
  const g = GLYPHS[name];
  const tip = esc(`${name}|${g.meaning}`);
  const sizes = [16, 20, 24]
    .map((size) => renderGlyph(name, { label: name, size }))
    .join("");
  return `<article class="card" data-i="${tip}">
    <div class="sizes">${sizes}</div>
    <h3>${esc(name)}</h3>
    <p>${esc(g.meaning)}</p>
  </article>`;
}

function board(theme, title, note) {
  const groups = GLYPH_GROUPS.map((group) => {
    const cards = names
      .filter((name) => GLYPHS[name].group === group)
      .map(card)
      .join("");
    return `<section><h2>${esc(GROUP_LABELS[group])}</h2><div class="grid">${cards}</div></section>`;
  }).join("");
  return `<section class="theme ${theme}"><header><h2>${esc(title)}</h2><p>${esc(note)}</p></header>${groups}</section>`;
}

const colours = [
  ["var(--text)", "text"],
  ["var(--accent)", "accent"],
  ["var(--rec)", "record"],
  ["var(--text-faint)", "faint"],
]
  .map(
    ([token, label]) =>
      `<span class="swatch" style="color:${token}">${renderGlyph("record", { label, size: 20 })}<small>${esc(label)}</small></span>`,
  )
  .join("");

const chips = chipSources
  .map(([label, source, aria]) => {
    const marks = [24, 16]
      .map((size) => renderGlyphChip({ source, label: aria, size }))
      .join("");
    return `<figure class="chip-ex"><div class="sizes">${marks}</div><figcaption>${esc(label)}</figcaption></figure>`;
  })
  .join("");

const waitingInline = renderGlyph("waiting", { label: "Waiting", size: 16 });

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Glyph roster</title>
<style>
  .shell {
    --bg-0:#3f4348; --bg-1:#33363b; --bg-2:#43464c; --bg-3:#51565d;
    --line:#292c31; --line-strong:#656a70;
    --text:#e0e0dc; --text-dim:#b8bbb9; --text-faint:#919693;
    --accent:#ffbe00; --accent-dim:#b09035; --rec:#df716c;
    --font-ui:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    background:var(--bg-1); color:var(--text);
  }
  .paper {
    --paper:#EFEFED; --pfield:#FAFAF8; --ink:#111; --pmid:#6E6E6A; --pfaint:#A3A39E; --prule:#C9C9C4; --hl:#FFE97A;
    --bg-0:var(--pfield); --bg-1:var(--paper); --line:var(--prule); --line-strong:var(--pmid);
    --text:var(--ink); --text-dim:var(--pmid); --text-faint:var(--pfaint);
    --font-ui:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    background:var(--paper); color:var(--ink);
  }
  * { box-sizing:border-box }
  body { margin:0; font:13px/1.4 var(--font-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif); background:#1d1f22; color:#e0e0dc }
  .sheet { max-width:1180px; margin:0 auto; padding:28px 22px 48px }
  .mast h1 { font:500 28px/1.1 var(--font-ui, sans-serif); margin:0 0 8px; letter-spacing:-.02em }
  .mast p { margin:0 0 8px; max-width:68ch; color:#b8bbb9 }
  .info { margin:14px 0 22px; background:#26292d; padding:8px 10px; min-height:34px }
  .info b { font-weight:600; margin-right:8px }
  .theme { padding:18px 16px 8px; margin:0 0 18px }
  .theme > header h2 { margin:0 0 4px; font:600 15px/1.2 var(--font-ui, sans-serif) }
  .theme > header p { margin:0 0 14px; color:var(--text-dim); max-width:70ch }
  .theme section { margin:0 0 16px }
  .theme h2 { margin:0 0 8px; font:600 12px/1.2 var(--font-ui, sans-serif); color:var(--text-dim); letter-spacing:.04em; text-transform:uppercase }
  .grid { display:grid; grid-template-columns:repeat(6, minmax(0, 1fr)); gap:8px }
  .card { background:var(--bg-0); border:1px solid var(--line); padding:8px 8px 7px; min-height:108px }
  .card h3 { margin:6px 0 2px; font:600 12px/1.2 ui-monospace, monospace; color:var(--text) }
  .card p { margin:0; color:var(--text-dim); font-size:11px; line-height:1.35 }
  .sizes { display:flex; align-items:flex-end; gap:8px; min-height:24px; color:var(--text) }
  .sizes svg { display:block }
  .swatches { display:flex; gap:16px; align-items:center; margin:8px 0 0 }
  .swatch { display:flex; align-items:center; gap:6px }
  .swatch small { font-size:11px; color:var(--text-dim) }
  .chips { display:flex; flex-wrap:wrap; gap:12px; margin-top:8px }
  .chip-ex { margin:0; width:140px }
  .chip-ex figcaption { margin-top:6px; color:var(--text-dim); font-size:11px }
  .glyph-chip { display:inline-grid; place-items:center; border:1px solid var(--line); background:var(--bg-0); color:var(--text); overflow:hidden; line-height:1; vertical-align:bottom }
  .glyph-chip img { width:calc(100% - 4px); height:calc(100% - 4px); object-fit:contain }
  .glyph-chip-ink { font-family:var(--font-ui); line-height:1 }
  @media (max-width:900px) { .grid { grid-template-columns:repeat(3, minmax(0, 1fr)) } }
</style>
</head>
<body>
<div class="sheet">
  <header class="mast">
    <h1>Glyph roster</h1>
    <p>${names.length} marks on a 24 grid, shown at 16, 20, and 24. Shell tokens are the live-shell stylesheet. Paper tokens are the document tokens from the world-shell mockup. Hover a mark: the status line reads its data-i tooltip.</p>
    <div class="info" id="info"><b>Info</b>Hover a mark. The status line is the mockup's data-i pattern: a name, then what it does.</div>
  </header>
  ${board("shell", "Shell", "Tokens from packages/live-shell/ui/src/styles.css. Marks use currentColor, painted here as var(--text).")}
  <div class="shell" style="padding:12px 16px 16px;margin:-10px 0 18px">
    <h2 style="margin:0 0 6px;font:600 12px/1.2 sans-serif;letter-spacing:.04em;text-transform:uppercase;color:var(--text-dim)">Colour is the button</h2>
    <p style="margin:0;color:var(--text-dim);max-width:70ch">Record is one drawing. The control sets color to a token. These four use the shell tokens only.</p>
    <div class="swatches">${colours}</div>
  </div>
  ${board("paper", "Paper", "Document tokens from world-shell-mockup.html: paper, ink, pmid, pfaint, prule. Marks use currentColor, painted here as var(--ink).")}
  <section class="shell" style="padding:16px;margin:0">
    <h2 style="margin:0 0 6px;font:600 15px/1.2 sans-serif">Text and image as a chip</h2>
    <p style="margin:0 0 8px;color:var(--text-dim);max-width:70ch">The frame is the shell. The ink is an engine glyph, a plain character, or an authored image. Empty engine text is drawn as O. A missed image shows waiting.</p>
    <div class="chips">${chips}</div>
  </section>
</div>
<script>
const waiting = ${JSON.stringify(waitingInline)};
document.querySelectorAll('img[data-fallback="waiting"]').forEach((img) => {
  const fail = () => {
    const chip = img.closest('.glyph-chip');
    if (!chip) return;
    chip.innerHTML = waiting;
  };
  img.addEventListener('error', fail);
  if (img.complete && img.naturalWidth === 0) fail();
});
const info = document.getElementById('info');
document.addEventListener('mouseover', (e) => {
  const el = e.target.closest('[data-i]');
  if (!el) return;
  const [name, meaning] = el.dataset.i.split('|');
  info.innerHTML = '<b>' + name + '</b>' + (meaning || '');
});
</script>
</body>
</html>
`;
writeFileSync(join(dir, "roster-sheet.html"), html);
console.log(`glyphs ${names.length}`);
console.log(names.join(" "));
