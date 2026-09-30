/** Release only a verification-owned native Expression, preserving its exact
 * failed/successful result as a native file in the already controlled world.
 * Native Close refuses dirty work; no store bypass or destructive discard.
 */
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function closeControlledExpression(server,bridge,expression_ref,output,reason){
 assert.match(bridge,/^http:\/\/127\.0\.0\.1:\d+$/);
 assert.match(expression_ref,/^expression:(?:personal-body|controlled-atlas(?:-leaf|-ancestor)?|controlled-epii|controlled-act|controlled-presence)-[a-z0-9-]+$/);
 assert.ok(output.includes('/Control/agents/now/clearings/')&&output.includes('/T/'));
 const transport={kind:'bridge',url:bridge};
 const {hostedCompositionFile}=await server.ssrLoadModule('/src/expressions/hostedComposition.ts');
 const {expressionOperation}=await server.ssrLoadModule('/src/knowledge/constructionProjection.ts');
 const inspected=await expressionOperation(transport,{operation:'inspect',expression_ref});
 const name=`verification-${new URL(bridge).port}-${expression_ref.slice('expression:'.length)}-${randomUUID()}.expression.json`;
 const intent=await hostedCompositionFile(transport,{operation:'prepare',document:inspected.document,destination:{parent_path:'Work/controlled',name}});
 const archived=await hostedCompositionFile(transport,{operation:'perform',intent});
 const closed=await expressionOperation(transport,{operation:'close',expression_ref,actor:'agent:nara-native-verification'});
 assert.equal(closed.state,'closed');
 const result={bridge,expression_ref,reason,archived,closed};
 await writeFile(path.join(output,`closed-${new URL(bridge).port}-${expression_ref.slice('expression:'.length)}.json`),JSON.stringify(result,null,2));
 return result;
}
