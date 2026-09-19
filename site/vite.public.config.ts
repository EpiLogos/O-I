import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const here=(path:string)=>fileURLToPath(new URL(path,import.meta.url));
/** The read-only site has no dependency on a live field service or SDK generator. */
export default defineConfig({base:'./',plugins:[react()],resolve:{alias:{'@':here('./src'),'three':here('./node_modules/three')},dedupe:['three','react','react-dom']},build:{rollupOptions:{input:Object.fromEntries(['index','shell','library','oi','products','shared-field','research','build'].map(name=>[name,here(`./${name}.html`)]))}}});
