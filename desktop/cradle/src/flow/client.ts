export interface FlowRecord {flow_ref:string;source_ref:string;path:string;current_revision:string;scope_ref:string;privacy:string;title?:string;created_at_unix_seconds?:number;lifecycle?:string}
export interface FlowInspection {flow:FlowRecord;capabilities:{read:{available:boolean;reason?:string|null};write:{available:boolean;reason?:string|null};history:{available:boolean;reason?:string|null}}}
export type FlowRequest={action:"flow_inspect";project:string|null;flow_ref:string}|{action:"flow_create";project:string|null;actor:string;actor_kind:"human";local_stamp?:string;path?:string;title?:string}|{action:"flow_read";project:string|null;flow_ref:string}|{action:"flow_write";project:string|null;flow_ref:string;expected_revision:string;content:string;actor:string;actor_kind:"human"}|{action:"flow_list";project:string|null};
/** The kernel's typed flow route remains for the contemplate/commission
 * features against Central's knowledge-node actions; the human writing path
 * now uses the flow-instance module (queue cell E). The types here describe
 * that route's payloads verbatim. */
export {};
