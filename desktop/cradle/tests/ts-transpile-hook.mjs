/**
 * A module hook for node:test runs that must import app sources node's own
 * type stripping cannot run (TS parameter properties, `.js` specifiers that
 * name `.ts` files, CSS imports): each `.ts`/`.tsx` is transpiled with the
 * repo's own TypeScript, `.css` imports load as empty modules. Development
 * tooling only — never shipped. Register with `module.register`.
 */
import ts from "typescript";
import {readFile} from "node:fs/promises";

export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && specifier.endsWith(".js")) {
    try { return await next(`${specifier.slice(0, -3)}.ts`, context); } catch { /* a real .js */ }
  }
  if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier) && !specifier.endsWith(".css") && !specifier.endsWith(".json")) {
    for (const extension of [".ts", ".tsx"]) {
      try { return await next(`${specifier}${extension}`, context); } catch { /* try the next */ }
    }
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (/\.tsx?$/.test(url)) {
    const source = await readFile(new URL(url), "utf8");
    const output = ts.transpileModule(source, {fileName: url, compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText;
    return {format: "module", source: output, shortCircuit: true};
  }
  if (/\.css$/.test(url)) return {format: "module", source: "export default {}", shortCircuit: true};
  return next(url, context);
}
