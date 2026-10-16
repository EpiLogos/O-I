// Renders a page of the manual (DLW.md by default, or the name of another page beside it) into the
// standalone HTML beside it. The Markdown is the source; run this from the repo root after editing it (needs `npm ci` in
// site/ for the marked parser).
import {readFileSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {Marked} from '../../site/node_modules/marked/lib/marked.esm.js'

const here = dirname(fileURLToPath(import.meta.url))
// The device gallery (packages/live-shell/ui/src/inhabitants/catalogue, on the build branch). Override with DLW_GALLERY.
const GALLERY = process.env.DLW_GALLERY || 'http://127.0.0.1:5208/'
const name = process.argv[2] || 'DLW'
const source = readFileSync(join(here, `${name}.md`), 'utf8')
const heading = (source.match(/^# (.+)$/m) ?? [null, name])[1]
const title = name === 'DLW' ? 'Digital Logos Workstation' : heading
const description = name === 'DLW' ? 'The Digital Logos Workstation: a reference for the instrument, and an account of what it is for.'
  : `${heading}: how every device of the Digital Logos Workstation looks and answers the hand, with live reference devices.`

const plain = html => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
const slugs = new Map()
const slug = text => {
  const base = plain(text).toLowerCase().replace(/[●◐○]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section'
  const n = slugs.get(base) ?? 0
  slugs.set(base, n + 1)
  return n ? `${base}-${n}` : base
}

const toc = []
const marked = new Marked({
  gfm: true,
  renderer: {
    heading({tokens, depth}) {
      const inner = this.parser.parseInline(tokens)
      const id = slug(inner)
      const isPart = depth === 1 && /^(Part|Appendices)/.test(plain(inner))
      if (isPart || depth === 2) toc.push({depth, id, text: plain(inner).replace(/\s*[●◐○].*$/, '')})
      const cls = isPart ? ' class="part"' : depth === 1 ? ' class="title"' : ''
      return `<h${depth} id="${id}"${cls}><a class="anchor" href="#${id}" aria-hidden="true">#</a>${inner}</h${depth}>\n`
    },
    table(token) {
      return `<div class="table-wrap">${this.constructor.prototype.table.call(this, token)}</div>\n`
    },
    // A ```ui block embeds the device's real UI beside its spec:
    //   src: path relative to this folder · device: <family>:<face> · clip: <mode> · height: px · caption: text
    code({text, lang}) {
      if (lang !== 'ui') return false
      const f = Object.fromEntries(text.split('\n').map(l => l.split(/:\s*/)).filter(([k, v]) => k && v).map(([k, ...v]) => [k.trim(), v.join(':').trim()]))
      // device: <family>:<face> embeds the device gallery (the shell's own runtime, every view) instead of a page.
      if (f.device) Object.assign(f, {src: `${GALLERY}?device=${f.device}&view=${f.view || 'all'}`, width: f.width || '1100', height: f.height || '760'})
      // clip: <mode> embeds the mode's Clip view, drawn by the gallery at the detail area's size and expanded.
      if (f.clip) Object.assign(f, {src: `${GALLERY}?clip=${f.clip.replace(/^clip:/, '')}`, width: f.width || '1240', height: f.height || '1000'})
      const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
      // Drawn at its design width (default 1440 px), scaled to fit the column.
      const w = parseInt(f.width || '1440', 10), h = parseInt(f.height || '560', 10)
      return `<figure class="ui"><div class="ui-stage" data-w="${w}" data-h="${h}"><iframe src="${esc(f.src)}" loading="lazy" style="width:${w}px;height:${h}px" sandbox="allow-scripts allow-same-origin" title="${esc(f.caption)}"></iframe></div><figcaption>${esc(f.caption)} · <a href="${esc(f.src)}" target="_blank" rel="noopener">open on its own</a></figcaption></figure>\n`
    },
  },
})

// Status marks: style ● ◐ ○ as marks, but leave the record glyph in
// "Record ●" / "● Record" alone.
const marks = html => html.replace(/(Record\s)?([●◐○])(?!\s?Record)/g, (all, rec, glyph) => {
  if (rec) return all
  const kind = {'●': 'built', '◐': 'part', '○': 'designed'}[glyph]
  return `<span class="mark mark-${kind}" title="${{built: 'built', part: 'in part', designed: 'designed'}[kind]}">${glyph}</span>`
})

const body = marks(marked.parse(source))
const tocHtml = toc.map(entry => entry.depth === 1
  ? `<li class="toc-part"><a href="#${entry.id}">${entry.text}</a></li>`
  : `<li><a href="#${entry.id}">${entry.text}</a></li>`).join('\n')

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<style>
:root{
  --bg:#f4f3f1;--panel:#ffffff;--ink:#1d1f21;--dim:#5b6066;--faint:#8b9096;
  --line:#dcdad6;--line-strong:#c4c1bb;--accent:#d98e00;--accent-ink:#8a5a00;
  --sel:#2f6fb3;--th:#ecebe8;--code:#efeeeb;--built:#3f8f5a;--part:#c08400;--designed:#8b9096;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#1e2023;--panel:#26292d;--ink:#e3e5e7;--dim:#a2a7ad;--faint:#71767c;
  --line:#3a3e43;--line-strong:#4b5056;--accent:#ffbe00;--accent-ink:#ffbe00;
  --sel:#7ec3e6;--th:#2e3135;--code:#2e3135;--built:#6cc28a;--part:#ffbe00;--designed:#71767c;
}}
:root[data-theme="dark"]{
  --bg:#1e2023;--panel:#26292d;--ink:#e3e5e7;--dim:#a2a7ad;--faint:#71767c;
  --line:#3a3e43;--line-strong:#4b5056;--accent:#ffbe00;--accent-ink:#ffbe00;
  --sel:#7ec3e6;--th:#2e3135;--code:#2e3135;--built:#6cc28a;--part:#ffbe00;--designed:#71767c;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:16px}
body{margin:0;background:var(--bg);color:var(--ink);font:15.5px/1.62 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
.layout{display:grid;grid-template-columns:280px minmax(0,1fr);max-width:1320px;margin:0 auto}
nav{position:sticky;top:0;height:100vh;overflow:auto;padding:28px 18px 40px 24px;border-right:1px solid var(--line);font-size:13px}
nav .brand{font-weight:650;letter-spacing:.02em;margin:0 0 4px}
nav .sub{color:var(--faint);margin:0 0 18px;font-size:12px}
nav ol{list-style:none;margin:0;padding:0}
nav li a{display:block;padding:3px 8px;border-left:2px solid transparent;color:var(--dim);text-decoration:none;border-radius:0 4px 4px 0}
nav li a:hover{color:var(--ink);background:var(--th)}
nav li a.on{color:var(--ink);border-left-color:var(--accent)}
nav .toc-part a{margin-top:14px;color:var(--ink);font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.08em}
main{padding:40px 48px 120px;min-width:0}
article{max-width:980px}
h1,h2,h3,h4{line-height:1.25;position:relative}
h1{font-size:34px;font-weight:700;letter-spacing:-.01em;margin:0 0 10px}
h1.title{font-size:38px;margin-top:8px}
h1.part{margin-top:80px;padding-top:28px;border-top:3px solid var(--accent);font-size:28px}
h2{font-size:23px;font-weight:650;margin:56px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--line)}
h3{font-size:17px;font-weight:650;margin:32px 0 8px}
h4{font-size:15px;margin:24px 0 6px}
.anchor{position:absolute;left:-20px;color:var(--faint);text-decoration:none;opacity:0;font-weight:400}
h1:hover .anchor,h2:hover .anchor,h3:hover .anchor{opacity:1}
p,li{max-width:74ch}
a{color:var(--sel)}
strong{font-weight:640}
em{font-style:italic}
hr{border:0;border-top:1px solid var(--line);margin:36px 0}
code{font:12.5px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--code);padding:1px 5px;border-radius:4px;overflow-wrap:anywhere}
blockquote{margin:16px 0;padding:4px 16px;border-left:3px solid var(--accent);color:var(--dim)}
.table-wrap{overflow-x:auto;margin:14px 0 20px;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
table{border-collapse:collapse;width:100%;min-width:560px;font-size:13.5px;line-height:1.45}
th,td{text-align:left;vertical-align:top;padding:7px 11px;border-bottom:1px solid var(--line)}
th{background:var(--th);font-weight:620;font-size:12px;letter-spacing:.02em;white-space:nowrap}
tr:last-child td{border-bottom:0}
td:first-child{font-weight:560}
td p{margin:0}
.mark{display:inline-block;font-size:.85em;line-height:1;margin:0 .1em;vertical-align:.05em}
.mark-built{color:var(--built)}.mark-part{color:var(--part)}.mark-designed{color:var(--designed)}
h2 .mark,h3 .mark{font-weight:400}
.theme{position:fixed;right:16px;top:12px;border:1px solid var(--line-strong);background:var(--panel);color:var(--dim);border-radius:6px;font-size:12px;padding:4px 9px;cursor:pointer}
.menu{display:none}
@media (max-width:900px){
  .layout{display:block}
  nav{position:fixed;inset:0 30% 0 0;max-width:320px;background:var(--panel);z-index:5;transform:translateX(-102%);transition:transform .2s;height:100%}
  nav.open{transform:none;box-shadow:0 0 40px #0005}
  .menu{display:block;position:fixed;left:16px;top:12px;z-index:6;border:1px solid var(--line-strong);background:var(--panel);color:var(--ink);border-radius:6px;font-size:12px;padding:4px 9px}
  main{padding:56px 16px 80px}
  h1{font-size:27px}h1.title{font-size:38px;margin-top:8px}
h1.part{font-size:23px}h2{font-size:20px}
  .anchor{display:none}
}
figure.ui{margin:18px 0 26px;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--panel)}
figure.ui .ui-stage{position:relative;overflow:hidden;background:#fff}
figure.ui iframe{display:block;border:0;background:#fff;transform-origin:0 0;position:absolute;left:0;top:0}
figure.ui figcaption{font-size:12.5px;color:var(--dim);padding:8px 12px;border-top:1px solid var(--line)}
@media print{nav,.theme,.menu{display:none}.layout{display:block}main{padding:0}}
</style>
</head>
<body>
<button class="menu" type="button" aria-label="Contents">Contents</button>
<button class="theme" type="button" aria-label="Toggle colour theme">Theme</button>
<div class="layout">
<nav aria-label="Contents">
<p class="brand">${title}</p>
<p class="sub">${name === 'DLW' ? 'Reference · O:I' : '<a href="DLW.html">Digital Logos Workstation</a> · O:I'}</p>
<ol>
${tocHtml}
</ol>
</nav>
<main><article>
${body}
</article></main>
</div>
<script>
(()=>{
  const root=document.documentElement
  try{const t=localStorage.getItem('dlw-theme');if(t)root.dataset.theme=t}catch(e){}
  document.querySelector('.theme').onclick=()=>{
    const dark=root.dataset.theme?root.dataset.theme==='dark':matchMedia('(prefers-color-scheme: dark)').matches
    root.dataset.theme=dark?'light':'dark'
    try{localStorage.setItem('dlw-theme',root.dataset.theme)}catch(e){}
  }
  const fit=()=>document.querySelectorAll('.ui-stage').forEach(st=>{const w=+st.dataset.w,h=+st.dataset.h,k=Math.min(1,st.clientWidth/w);st.style.height=(h*k)+'px';st.firstElementChild.style.transform='scale('+k+')'})
  fit();addEventListener('resize',fit)
  // The device gallery tells the page its height: the embed grows to every view it draws.
  addEventListener('message',e=>{const h=e.data&&e.data.dlwGallery&&+e.data.dlwGallery.h;if(!h)return;document.querySelectorAll('.ui-stage iframe').forEach(f=>{if(f.contentWindow===e.source){f.style.height=h+'px';f.parentElement.dataset.h=h;fit()}})})
  const nav=document.querySelector('nav')
  document.querySelector('.menu').onclick=()=>nav.classList.toggle('open')
  nav.addEventListener('click',e=>{if(e.target.closest('a'))nav.classList.remove('open')})
  const links=[...nav.querySelectorAll('a')],byId=new Map(links.map(a=>[a.hash.slice(1),a]))
  const seen=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){links.forEach(a=>a.classList.remove('on'));byId.get(e.target.id)?.classList.add('on')}},{rootMargin:'0px 0px -75% 0px'})
  document.querySelectorAll('article h1[id],article h2[id]').forEach(h=>seen.observe(h))
})()
</script>
</body>
</html>
`

writeFileSync(join(here, `${name}.html`), page)
console.log(`${name}.html written: ${page.length} bytes, ${toc.length} contents entries`)
