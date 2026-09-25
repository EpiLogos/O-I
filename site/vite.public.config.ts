import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {copyFileSync} from 'node:fs';
import {essayShellPlugin} from './essay-vite-plugin';
const here=(path:string)=>fileURLToPath(new URL(path,import.meta.url));
/** The published site has no live-service or SDK-generator dependency. The old
 * Explore address enters the same reading surface; the full live client remains
 * available through the separate native build, not copied into public payloads. */
export default defineConfig({base:'./',publicDir:here('./.public-edition'),plugins:[react(),essayShellPlugin(),{
 name:'public-reading-compatibility',
 configureServer(server){server.middlewares.use((request,_response,next)=>{if(request.url)request.url=request.url.replace(/^\/explore\.html(?=\?|$)/,'/library.html');next();});},
 writeBundle(){copyFileSync(here('./dist/library.html'),here('./dist/explore.html'));}
}],resolve:{alias:{'@':here('./src'),'three':here('./node_modules/three')},dedupe:['three','react','react-dom']},build:{rollupOptions:{input:Object.fromEntries(['index','shell','library','oi','products','shared-field','research','build'].map(name=>[name,here(`./${name}.html`)]))}}});
