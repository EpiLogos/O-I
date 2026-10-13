/** lane-1 A3–A4: connector presentation on the Research Canvas — the line kind
 * (straight, curved, elbow), an owner-written midpoint label, and the card
 * side each end binds to. This is presentation material keyed by the native
 * edge (binding) id, stored in `oi.research-scene/v1`. It never carries a
 * relation kind, a direction or an endpoint: those keep flowing through the
 * native relation operations unchanged. An absent record is today's curved,
 * auto-routed connector, byte-identical to before. Closed vocabularies only. */
export const CONNECTOR_KINDS=['straight','curved','elbow'] as const;
export type ConnectorKind=(typeof CONNECTOR_KINDS)[number];
export const CONNECTOR_SIDES=['top','right','bottom','left'] as const;
export type ConnectorSide=(typeof CONNECTOR_SIDES)[number];
export const CONNECTOR_LABEL_MAX=160;
/** Record budget: one connector per native edge, bounded like the other record collections. */
export const CONNECTOR_RECORD_MAX=256;
/** Edge (binding) ids are native refs; the key is bounded like every other ref in the material. */
export const CONNECTOR_KEY_MAX=1024;
const CONNECTOR_FIELDS=['kind','label','fromSide','toSide'];
export interface ResearchConnector {kind:ConnectorKind;label?:string;fromSide?:ConnectorSide;toSide?:ConnectorSide}
export function isConnectorKind(value:unknown):value is ConnectorKind{return typeof value==='string'&&(CONNECTOR_KINDS as readonly string[]).includes(value);}
export function isConnectorSide(value:unknown):value is ConnectorSide{return typeof value==='string'&&(CONNECTOR_SIDES as readonly string[]).includes(value);}
const labelFits=(label:string)=>Array.from(label).length<=CONNECTOR_LABEL_MAX;
/** Refuses anything outside the closed record: unknown fields, unknown kinds or sides, an empty or oversized label. */
export function validateConnector(value:unknown):asserts value is ResearchConnector{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid connector');
 const record=value as Record<string,unknown>;
 if(Object.keys(record).some(key=>!CONNECTOR_FIELDS.includes(key)))throw new Error('Unknown connector field');
 if(!isConnectorKind(record.kind))throw new Error('Invalid connector kind');
 if(record.label!==undefined&&!(typeof record.label==='string'&&record.label.trim().length>0&&labelFits(record.label)))throw new Error('Invalid connector label');
 if(record.fromSide!==undefined&&!isConnectorSide(record.fromSide))throw new Error('Invalid connector side');
 if(record.toSide!==undefined&&!isConnectorSide(record.toSide))throw new Error('Invalid connector side');
}
/** The stored form of an owner's edit. A label is trimmed and capped; an empty
 * label clears it. The result is null when it equals the default (curved,
 * auto sides, no label), so the record is absent rather than stored. */
export function connectorRecord(input:{kind:ConnectorKind;label?:string;fromSide?:ConnectorSide;toSide?:ConnectorSide}):ResearchConnector|null{
 const label=(input.label??'').trim();
 const capped=Array.from(label).slice(0,CONNECTOR_LABEL_MAX).join('');
 const next:ResearchConnector={kind:input.kind};
 if(capped)next.label=capped;
 if(input.fromSide)next.fromSide=input.fromSide;
 if(input.toSide)next.toSide=input.toSide;
 return next.kind==='curved'&&!next.label&&!next.fromSide&&!next.toSide?null:next;
}
/** A reconnect keeps the owner's kind and label and takes the sides the
 * handles now name. */
export function connectorWithSides(current:ResearchConnector|undefined,sides:{fromSide?:ConnectorSide;toSide?:ConnectorSide}):ResearchConnector|null{
 return connectorRecord({kind:current?.kind??'curved',label:current?.label,fromSide:sides.fromSide,toSide:sides.toSide});
}
/** The card side a rendered handle id names (`source-top`, `target-left`).
 * Anything else reads as auto (undefined). */
export function sideFromHandleId(handleId:string|null|undefined,role:'source'|'target'):ConnectorSide|undefined{
 if(!handleId||!handleId.startsWith(`${role}-`))return undefined;
 const side=handleId.slice(role.length+1);
 return isConnectorSide(side)?side:undefined;
}
/** What the canvas renders for one edge: its line kind, its midpoint label, and
 * the handle ids of any bound side. Auto ends carry no handle id, so the
 * canvas keeps its default routing. */
export function connectorPresentation(record:ResearchConnector|undefined):{kind:ConnectorKind;label?:string;sourceHandleId?:string;targetHandleId?:string}{
 return {
  kind:record?.kind??'curved',
  label:record?.label,
  sourceHandleId:record?.fromSide?`source-${record.fromSide}`:undefined,
  targetHandleId:record?.toSide?`target-${record.toSide}`:undefined,
 };
}
