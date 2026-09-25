/** Static architecture checks, not a second implementation of the product. */
import ts from 'typescript';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,relative} from 'node:path';
export const root=fileURLToPath(new URL('../../',import.meta.url));
export const repo=fileURLToPath(new URL('../../../../',import.meta.url));
export const law='docs/cradle/02-ARCHITECTURE.md §5–6, §12; desktop-agent-conformance-rectification-2026-09-23-1756.md Lane A';
export const read=path=>readFileSync(join(root,path),'utf8');
export const registry=name=>JSON.parse(read(`tests/conformance/${name}.json`));
export function files(dir,extensions=/\.(ts|tsx)$/){return readdirSync(join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(`${dir}/${e.name}`,extensions):extensions.test(e.name)?[`${dir}/${e.name}`]:[]).sort();}
export function source(file,text=read(file)){return ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);}
export function visit(node,fn){fn(node);ts.forEachChild(node,n=>visit(n,fn));}
const printer=ts.createPrinter({removeComments:true});
export const print=node=>printer.printNode(ts.EmitHint.Unspecified,node,node.getSourceFile()).trim();
export function storageSites(file,text=read(file)){
 const tree=source(file,text), declarations=new Map(),sites=[];
 visit(tree,n=>{if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer){const entries=declarations.get(n.name.text)??[];entries.push(n.initializer);declarations.set(n.name.text,entries);}if(ts.isFunctionDeclaration(n)&&n.name&&n.body)declarations.set(n.name.text,[n.body]);});
 const basis=key=>{const seen=new Set(),out=new Set();const walk=(n,depth)=>{if(depth>8)return;visit(n,part=>{if(ts.isIdentifier(part)&&!seen.has(part.text)){seen.add(part.text);for(const value of declarations.get(part.text)??[]){if(/(?:['"`]oi[.:-]|KEY|PREFIX|key\s*\(|encodeURIComponent)/.test(print(value)))out.add(`${part.text} = ${print(value)}`);walk(value,depth+1);}}});};if(key)walk(key,0);return [...out].sort();};
 visit(tree,n=>{if(!ts.isCallExpression(n))return;const expr=n.expression;if(!ts.isPropertyAccessExpression(expr)&&!ts.isElementAccessExpression(expr))return;const method=ts.isPropertyAccessExpression(expr)?expr.name.text:ts.isStringLiteral(expr.argumentExpression)?expr.argumentExpression.text:null;if(!['getItem','setItem','removeItem','clear','key'].includes(method))return;if(['clear','key'].includes(method)&&!/(?:localStorage|sessionStorage|storage)$/.test(print(expr.expression)))return;const key=n.arguments[0];sites.push({owner:file,receiver:print(expr.expression),method,key:key?print(key):'<all>',basis:basis(key)});});
 return [...new Map(sites.map(s=>[JSON.stringify(s),s])).values()].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
export function storageReferences(file,text=read(file)){
 const refs=[];visit(source(file,text),n=>{if(ts.isIdentifier(n)&&['localStorage','sessionStorage'].includes(n.text)){if(ts.isPropertySignature(n.parent))return;refs.push(n.text); }if(ts.isElementAccessExpression(n)&&ts.isStringLiteral(n.argumentExpression)&&['localStorage','sessionStorage'].includes(n.argumentExpression.text))refs.push(n.argumentExpression.text);});return [...new Set(refs)].sort();
}
export function rendererAuthority(file,text=read(file)){
 const findings=[];visit(source(file,text),n=>{
  if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier)&&/^(?:@tauri-apps\/plugin-(?:shell|fs|http)|node:|fs(?:\/|$)|child_process(?:\/|$))/.test(n.moduleSpecifier.text))findings.push({owner:file,kind:'privileged-import',expression:n.moduleSpecifier.text});
  if(ts.isCallExpression(n)||ts.isNewExpression(n)){
   const callee=print(n.expression);
   if(/(?:^|\.)(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)$/.test(callee))findings.push({owner:file,kind:'network',expression:print(n)});
   if(/(?:^|\.)(?:getCurrentWindow|Command)$/.test(callee))findings.push({owner:file,kind:callee.endsWith('Command')?'process':'window',expression:print(n.parent)});
   if(n.expression.kind===ts.SyntaxKind.ImportKeyword&&n.arguments?.[0]&&ts.isStringLiteral(n.arguments[0])&&/^(?:@tauri-apps\/plugin-(?:shell|fs|http)|node:|fs$|child_process$)/.test(n.arguments[0].text))findings.push({owner:file,kind:'privileged-import',expression:n.arguments[0].text});
  }
 });return findings;
}
/** Strip Rust comments and literals, retaining delimiters and identifiers. */
export function rustCode(text){return text.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|(?:br|r)(#+)"[\s\S]*?"\1|b?"(?:\\.|[^"\\])*"/g,match=>' '.repeat(match.length));}
/** Test fixtures can create/delete scratch files; they confer no shipped host authority. */
export function rustRuntime(text){let code=rustCode(text);const marker=/#\[cfg\(test\)\]\s*(?:pub\s+)?mod\s+\w+\s*\{/g;let match;while((match=marker.exec(code))){let depth=1,end=marker.lastIndex;while(depth&&end<code.length){if(code[end]==='{')depth++;else if(code[end]==='}')depth--;end++;}code=code.slice(0,match.index)+' '.repeat(end-match.index)+code.slice(end);marker.lastIndex=end;}return code;}

export function rustVariants(text,name){const code=rustCode(text),start=code.indexOf(`pub enum ${name} {`);if(start<0)throw Error(`missing enum ${name}`);const body=code.slice(start+`pub enum ${name} {`.length);let depth=0,expect=true,out=[];for(let i=0;i<body.length;i++){const ch=body[i];if(ch==='}'&&depth===0)break;if(expect&&depth===0){const match=body.slice(i).match(/^\s*([A-Z][A-Za-z0-9_]*)\s*(?:\{|\(|,)/);if(match){out.push(match[1].replace(/([a-z0-9])([A-Z])/g,'$1_$2').toLowerCase());i+=match[0].indexOf(match[1])+match[1].length-1;expect=false;continue;}}if(ch==='{'||ch==='('||ch==='[')depth++;if(ch==='}'||ch===')'||ch===']')depth--;if(ch===','&&depth===0)expect=true;}return out.sort();}
export function tsOps(text=read('src/kernel/types.ts')){let result=[];visit(source('types.ts',text),n=>{if(ts.isTypeAliasDeclaration(n)&&n.name.text==='KernelOp')visit(n.type,p=>{if(ts.isPropertySignature(p)&&p.name.getText()==='op'&&p.type&&ts.isLiteralTypeNode(p.type)&&ts.isStringLiteral(p.type.literal))result.push(p.type.literal.text);});});return result.sort();}

export function keyLiterals(file,text=read(file)){const values=[];visit(source(file,text),n=>{if(ts.isStringLiteralLike(n)&&/^oi[.:-]/.test(n.text))values.push(n.text);if(ts.isTemplateHead(n)&&/^oi[.:-]/.test(n.text))values.push(n.text+'${…}');});return [...new Set(values)].sort();}
