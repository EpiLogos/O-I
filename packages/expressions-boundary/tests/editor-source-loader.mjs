/** The existing TypeScript compiler loads production app sources with their
 * legacy .js specifiers. No source changes or application bundle is emitted. */
import ts from '../../../desktop/cradle/node_modules/typescript/lib/typescript.js';
import {readFile} from 'node:fs/promises';
export async function resolve(specifier, context, next) {
  try {return await next(specifier, context)} catch (error) {
    if (specifier.startsWith('.') && specifier.endsWith('.js')) return next(specifier.slice(0,-3)+'.ts',context);
    if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) return next(specifier+'.ts',context);
    throw error;
  }
}
export async function load(url, context, next) {
  // A production module's stylesheet is the bundler's; under node it is an empty module, as in the shell's own loaders.
  if (url.endsWith('.css')) return {format:'module',shortCircuit:true,source:'export {}'};
  if (!url.endsWith('.ts') && !url.endsWith('.tsx')) return next(url,context);
  const source = await readFile(new URL(url),'utf8');
  return {format:'module',shortCircuit:true,source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}
