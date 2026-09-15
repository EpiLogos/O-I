/** Shared presentation operation. An optional existing Expression identity is
 * carried into the canonical AgentLayer; omission opens its explicit chooser.
 * Semantic state remains in KernelOp::Expression. */
export const EXPRESSION_COMPOSE_EVENT="oi:expression-compose";
export function summonExpression(expressionRef?:string){
 if(expressionRef!==undefined&&!expressionRef.startsWith("expression:"))throw new Error("Expression summon requires an existing Expression ref");
 window.dispatchEvent(new CustomEvent(EXPRESSION_COMPOSE_EVENT,{detail:{expressionRef}}));
}
