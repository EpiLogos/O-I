import type {EncounterStatus} from "../../encounter/client";

/** An explicit native status read proves liveness, never successful inference. */
export function connectionVerification(status:EncounterStatus):{connected:boolean;summary:string} {
 const connected=!!status.native_session_id&&status.resident!==false&&!status.error&&["Resident","TurnInFlight","InterruptRequested"].includes(status.state);
 if(status.error)return {connected:false,summary:"The harness reports a connection fault."};
 if(connected)return {connected:true,summary:status.state==="Resident"?"Connected. The native session is ready.":"Connected. A turn is in progress."};
 return {connected:false,summary:status.state==="Disconnected"||status.resident===false?"Disconnected. This conversation has no resident harness connection.":"The owner did not confirm a live native connection."};
}

/** The owner currently exposes a session selector, not a future-chat default. */
export const DEFAULT_MODEL_UNAVAILABLE="AIKit does not expose a default-model setting for this harness. New chats use the harness launch configuration; the current-chat model control applies only to that chat.";
