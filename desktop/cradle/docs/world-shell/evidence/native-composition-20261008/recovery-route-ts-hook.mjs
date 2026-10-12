import ts from '/Users/admin/Central/worktrees/env-1/o-i/desktop/cradle/node_modules/typescript/lib/typescript.js';
import {readFile} from 'node:fs/promises';
/** Native source harness resolution. No application code or owner reply is replaced. */
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.')) {
    const source = specifier.endsWith('.js') ? `${specifier.slice(0, -3)}.ts`
      : !/\.[cm]?[jt]s$/.test(specifier) ? `${specifier}.ts` : null;
    if (source) {
      try { return await next(source, context); } catch { /* Genuine JS may be the owner. */ }
    }
  }
  return next(specifier, context);
}

/** Normal TypeScript emission erases type-only usage in legacy source imports. */
export async function load(url, context, next) {
  if (url.endsWith('.ts') || url.endsWith('.tsx')) {
    const source = await readFile(new URL(url), 'utf8');
    const result = ts.transpileModule(source, {fileName: new URL(url).pathname, compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, verbatimModuleSyntax: false}});
    return {format: 'module', source: result.outputText, shortCircuit: true};
  }
  return next(url, context);
}
