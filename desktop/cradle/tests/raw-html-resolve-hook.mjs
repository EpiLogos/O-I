import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";

export async function resolve(specifier, context, next) {
  const rawHtml = /^(.*\.html)\?raw(?:\.ts)?$/.exec(specifier);
  if (specifier.startsWith(".") && rawHtml) {
    const resolved = await next(rawHtml[1], context);
    return {...resolved, url: `${resolved.url}?raw`, format: "module", shortCircuit: true};
  }
  if (specifier.startsWith(".") && (specifier.endsWith("?raw") || /\.html$/.test(specifier))) {
    const target = specifier.endsWith("?raw") ? specifier.slice(0, -"?raw".length) : specifier;
    const resolved = await next(target, context);
    return {...resolved, url: `${resolved.url}?raw`, format: "module", shortCircuit: true};
  }
  const resolved = await next(specifier, context);
  if (resolved.url.startsWith("file:") && /\.html(?:\?raw)?$/.test(resolved.url)) {
    return {...resolved, format: "module", shortCircuit: true};
  }
  return resolved;
}

export async function load(url, context, next) {
  if (url.startsWith("file:") && /\.html(?:\?raw)?$/.test(url)) {
    const path = fileURLToPath(url.replace(/\?raw$/, ""));
    const source = await readFile(path, "utf8");
    return {format: "module", source: `export default ${JSON.stringify(source)};`, shortCircuit: true};
  }
  return next(url, context);
}
