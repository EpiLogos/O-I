/** Narrow native lease API. No executable, pane, cwd or command text crosses
 * from the renderer. Native confirmation and exact owner resolution issue it. */
import {invoke} from "@tauri-apps/api/core";
export interface Dimensions {cols:number;rows:number}
export interface ClientLease {client_id:string;seq:number}
export interface ClientBatch {seq:number;bytes:number[];eof:boolean}
export const takeover=(project:string,agentSession:string,binding:string,dimensions:Dimensions)=>invoke<ClientLease>("working_surface_takeover",{project,agentSession,binding,dimensions});
export const poll=(clientId:string,seq:number)=>invoke<ClientBatch>("working_surface_client_poll",{clientId,seq});
export const input=(clientId:string,data:string)=>invoke<void>("working_surface_client_input",{clientId,data});
export const resize=(clientId:string,dimensions:Dimensions)=>invoke<void>("working_surface_client_resize",{clientId,dimensions});
export const release=(clientId:string)=>invoke<void>("working_surface_release",{clientId});
