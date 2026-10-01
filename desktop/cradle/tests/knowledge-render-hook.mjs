// Node's bounded production-renderer tests use the same source imports as Vite.
// Preserve imported data/text as data; this hook supplies no native responses.
import {readFile} from 'node:fs/promises';

export async function resolve(specifier,context,next) {
  // An optional prior-source replay must still share this renderer's React
  // instance, exactly as one bundled desktop application does.
  if(['react','react/jsx-runtime','react/jsx-dev-runtime','react-dom/server'].includes(specifier))return next(specifier,{...context,parentURL:new URL('../package.json',import.meta.url).href});
  if(specifier.endsWith('?raw')) return {url:new URL(specifier,context.parentURL).href,shortCircuit:true};
  return next(specifier,context);
}

export async function load(url,context,next) {
  if(url.endsWith('.json')||url.endsWith('?raw')) {
    const source=await readFile(new URL(url.replace(/\?raw$/,'')),'utf8');
    return {format:'module',shortCircuit:true,source:`export default ${url.endsWith('.json')?`JSON.parse(${JSON.stringify(source)})`:JSON.stringify(source)};`};
  }
  return next(url,context);
}
