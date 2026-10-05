import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
// Import production TypeScript through the application's installed compiler. The
// application mixes extensionless and .js source specifiers for its bundler;
// resolve only those relative specifiers to an existing .ts source.
export async function resolve(specifier,context,nextResolve) {
  // A source-editor owner proposal is an exact replacement of the existing
  // Inspector producer. Its dependencies remain the application's real source.
  if(context.parentURL===process.env.OI_SOURCE_EDITOR_INSPECTOR_PROPOSAL&&specifier.startsWith('.')) {
    context={...context,parentURL:new URL('../expressions-app/field-studies-journeys/src/inspector.ts',import.meta.url).href};
  }
  if(specifier.startsWith('.')&&context.parentURL) {
    const candidates=specifier.endsWith('.js')?[specifier.slice(0,-3)+'.ts']:
      /\.[a-z0-9]+$/i.test(specifier)?[]:[specifier+'.ts',specifier+'/index.ts'];
    for(const candidate of candidates) {
      const url=new URL(candidate,context.parentURL);
      if(url.protocol==='file:'&&existsSync(url)) return nextResolve(url.href,context);
    }
  }
  return nextResolve(specifier,context);
}

export async function load(url,context,nextLoad) {
  if(url.startsWith('file:')&&url.endsWith('.ts')) {
    const result=ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{
      fileName:fileURLToPath(url),
      compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
    });
    return {format:'module',source:result.outputText,shortCircuit:true};
  }
  return nextLoad(url,context);
}
