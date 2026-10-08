import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const here=(path:string)=>fileURLToPath(new URL(path,import.meta.url));
/** The Expression renderer for the World package: the site's own `expression` entry (the same source as the published site's expression.html),
 * built alone, for the packaged layout `renderer/expression.html` beside `edition/`. The page declares where the edition is (`../edition/`)
 * and carries no site chrome files (no favicon: the package holds only what the renderer loads). Output: dist-renderer/ (or --outDir). */
export default defineConfig({
 base:'./',publicDir:false,
 plugins:[react(),{
  name:'world-package-renderer',
  transformIndexHtml:{order:'pre',handler:(html:string)=>html
   .replace(/<link rel="icon"[^>]*>/,'')
   .replace('<title>','<meta name="oi-edition-base" content="../edition/"/><title>')},
 }],
 resolve:{alias:{'@':here('./src'),'three':here('./node_modules/three')},dedupe:['three','react','react-dom']},
 build:{outDir:'dist-renderer',emptyOutDir:true,rollupOptions:{input:{expression:here('./expression.html')}}},
});
