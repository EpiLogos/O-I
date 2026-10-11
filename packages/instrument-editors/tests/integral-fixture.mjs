import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

// The full, contract-checked fixture remains owned by this checked-in test.
// Extract only its static READING literal; never import/execute the owner test.
export const INTEGRAL_FIXTURE_SOURCE='desktop/cradle/tests/techne-m0m5.test.mjs#READING';
const require=createRequire(import.meta.url);
const ts=require('../../../desktop/cradle/node_modules/typescript/lib/typescript.js');
export async function integralFixture(){
 const source=await readFile(new URL('../../../desktop/cradle/tests/techne-m0m5.test.mjs',import.meta.url),'utf8');
 const parsed=ts.createSourceFile(INTEGRAL_FIXTURE_SOURCE,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const declaration=parsed.statements.filter(ts.isVariableStatement).flatMap(statement=>Array.from(statement.declarationList.declarations)).find(item=>ts.isIdentifier(item.name)&&item.name.text==='READING');
 if(!declaration?.initializer)throw Error('The canonical checked-in READING fixture is unavailable.');
 const literal=declaration.initializer;
 return {reading:staticValue(literal),source:INTEGRAL_FIXTURE_SOURCE,literalSha256:createHash('sha256').update(literal.getText(parsed)).digest('hex')};
}
function staticValue(node){
 if(ts.isObjectLiteralExpression(node))return Object.fromEntries(node.properties.map(property=>{
  if(!ts.isPropertyAssignment(property)||!(ts.isIdentifier(property.name)||ts.isStringLiteral(property.name)))throw Error('The canonical fixture must remain a static object literal.');
  return [property.name.text,staticValue(property.initializer)];
 }));
 if(ts.isArrayLiteralExpression(node))return Array.from(node.elements,staticValue);
 if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return node.text;
 if(ts.isNumericLiteral(node))return Number(node.text);
 if(node.kind===ts.SyntaxKind.TrueKeyword)return true;
 if(node.kind===ts.SyntaxKind.FalseKeyword)return false;
 if(node.kind===ts.SyntaxKind.NullKeyword)return null;
 throw Error('Executable syntax is refused in the canonical fixture extractor.');
}
export function freezeReading(value){
 if(value&&typeof value==='object'){Object.values(value).forEach(freezeReading);Object.freeze(value);}
 return value;
}
