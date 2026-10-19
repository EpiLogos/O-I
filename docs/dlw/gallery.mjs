// Builds the device gallery (packages/live-shell/ui/src/inhabitants/catalogue) into one self-contained HTML document for
// render.mjs to carry inside the manual, so the manual draws every device with no server running. Everything the gallery
// loads is inlined: its one script, its styles and fonts, every designed device module, and the page templates the
// Day, Document, Flow, Beings and Things devices draw (desktop/cradle/documents). Nothing in the gallery's source changes:
//   - the gallery reads its query from `location.search`; here it reads `__DLW_SEARCH__`, which the manual sets per frame;
//   - the templates' root (`__CRADLE_DOCUMENTS__`) becomes a marker, and a prelude serves each template from the copy
//     carried here, to the frames and to fetch.
import {readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'

export const DOCS_ROOT = 'about:blank#dlw-doc'
// The templates the designed devices open (catalogue/panels: day, central__document, central__flow-document, central__beings,
// central__things). A ```ui block whose src is one of them is drawn from the same copy.
export const TEMPLATES = ['ql-daily-die.html', 'ql-flow.html', 'oi-beings.html', 'oi-things.html']

// A script element's text can end it or swallow the page after it ("</script", or "<!--" before a "<script"), so what a
// script carries is JSON with every "<" escaped: no "<" is left for the HTML parser to read.
const json = value => JSON.stringify(value).replace(/</g, '\\u003c')
const styleSafe = text => text.replace(/<\/style/gi, '<\\/style')

/** The gallery as one HTML document (`html`, whose <head> opens with the prelude; the manual adds each frame's query after
 * `<head>`), and the templates it carries (`docs`, by file name). */
export async function buildGallery(repo) {
  const ui = join(repo, 'packages', 'live-shell', 'ui')
  const catalogue = join(ui, 'src', 'inhabitants', 'catalogue')
  const {build} = await import(pathToFileURL(join(ui, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href)
  const searchShim = {
    name: 'dlw-gallery-search',
    enforce: 'pre',
    transform(code, id) {
      if (id.startsWith(catalogue) && code.includes('location.search')) return code.replaceAll('location.search', '__DLW_SEARCH__')
    },
  }
  const result = await build({
    configFile: join(catalogue, 'vite.config.mjs'),
    logLevel: 'warn',
    cacheDir: join(tmpdir(), 'dlw-gallery-vite'),
    define: {__CRADLE_DOCUMENTS__: JSON.stringify(DOCS_ROOT)},
    plugins: [searchShim],
    build: {
      write: false,
      target: 'es2022',
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      cssCodeSplit: false,
      modulePreload: false,
      rollupOptions: {output: {inlineDynamicImports: true}},
    },
  })
  const output = (Array.isArray(result) ? result : [result]).flatMap(entry => entry.output)
  const chunks = output.filter(item => item.type === 'chunk')
  const styles = output.filter(item => item.type === 'asset' && item.fileName.endsWith('.css'))
  const other = output.filter(item => item.type === 'asset' && !item.fileName.endsWith('.css') && !item.fileName.endsWith('.html'))
  if (chunks.length !== 1 || other.length) {
    throw Error(`the gallery did not build to one script: ${chunks.length} scripts, other files ${other.map(item => item.fileName).join(', ') || 'none'}`)
  }
  const docs = Object.fromEntries(TEMPLATES.map(file => [file, readFileSync(join(repo, 'desktop', 'cradle', 'documents', file), 'utf8')]))
  // Serves the templates from the copy: a frame the gallery points at the marker draws the template in place, and a fetch of
  // one answers with its text. A template the copy lacks says so in the frame.
  const prelude = `<script>window.__DLW_SEARCH__=window.__DLW_SEARCH__??location.search;(()=>{const ROOT=${json(DOCS_ROOT)},DOCS=${json(docs)};
const fileOf=u=>typeof u==='string'&&u.startsWith(ROOT+'/')?u.slice(ROOT.length+1):null;
const serve=f=>{const u=f.getAttribute('src'),file=fileOf(u);if(file===null||f.dataset.dlwDoc===file)return;f.dataset.dlwDoc=file;
f.srcdoc=DOCS[file]??'<p style="font:13px system-ui;color:#888;padding:12px">'+file+' is not carried in this copy of the manual.</p>'};
new MutationObserver(ms=>{for(const m of ms){if(m.type==='attributes')serve(m.target);else for(const n of m.addedNodes)if(n.nodeType===1){if(n.tagName==='IFRAME')serve(n);n.querySelectorAll?.('iframe').forEach(serve)}}})
.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
const fetch0=window.fetch.bind(window);window.fetch=(input,init)=>{const file=fileOf(typeof input==='string'?input:input?.url);
if(file===null)return fetch0(input,init);return Promise.resolve(DOCS[file]===undefined?new Response('',{status:404}):new Response(DOCS[file],{headers:{'content-type':'text/html'}}))}})()</script>`
  const css = styles.map(item => styleSafe(String(item.source))).join('\n')
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Device catalogue</title>
${prelude}
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script type="application/json" id="dlw-gallery-code">${json(chunks[0].code)}</script>
<script>(()=>{const code=document.createElement('script');code.type='module';code.textContent=JSON.parse(document.getElementById('dlw-gallery-code').textContent);document.body.append(code)})()</script>
</body>
</html>
`
  return {html, docs}
}
