// Native Node type stripping plus the app's existing ts-register resolution.
// Read Vite ?raw imports from their actual source bytes; no owner response or
// successful Flow document is synthesized by this test loader.
import {readFile} from "node:fs/promises";
export async function resolve(specifier, context, next) {
  if (specifier.endsWith("?raw")) {
    return {url: new URL(specifier, context.parentURL).href, shortCircuit: true};
  }
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url.endsWith("?raw")) {
    const file = new URL(url); file.search = "";
    return {format: "module", source: `export default ${JSON.stringify(await readFile(file, "utf8"))};`, shortCircuit: true};
  }
  return next(url, context);
}
