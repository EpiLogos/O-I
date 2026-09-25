import {kernelOp} from "../kernel/bridge";
import type {DecisionEpisode,DecisionPreflight,DecisionProposal,DecisionReceipt,KernelOutcome,KernelTransportStatus} from "../kernel/types";

export async function prepareDecision(transport:KernelTransportStatus,proposal:DecisionProposal):Promise<DecisionPreflight>{
 const reply=await kernelOp(transport,{op:"decision_preflight",proposal});
 if(reply.outcome?.result!=="decision_preflight_reading")throw Error(reply.error??"The native owner returned no decision preflight.");
 return reply.outcome.preflight;
}
export async function authoriseDecisionEpisode(transport:KernelTransportStatus,preflight:DecisionPreflight):Promise<DecisionEpisode>{
 if(transport.kind!=="tauri")throw Error("An episode can only be allowed by the app’s native confirmation dialog.");
 const {invoke}=await import("@tauri-apps/api/core");
 const reply=await invoke<KernelOutcome>("decision_episode_authorise",{preflightRef:preflight.preflight_ref});
 if(reply.result!=="decision_episode_authorised")throw Error("The native confirmation did not issue an episode.");
 return reply.episode;
}
export async function executeDecision(transport:KernelTransportStatus,preflight:DecisionPreflight,episode:DecisionEpisode):Promise<DecisionReceipt>{
 const reply=await kernelOp(transport,{op:"decide",preflight_ref:preflight.preflight_ref,authority_ref:episode.authority_ref});
 if(reply.outcome?.result!=="decision_made")throw Error(reply.error??"The native owner returned no decision receipt.");
 return reply.outcome.receipt;
}
export async function revokeDecisionEpisode(transport:KernelTransportStatus,episode:DecisionEpisode):Promise<void>{
 const reply=await kernelOp(transport,{op:"decision_episode_revoke",authority_ref:episode.authority_ref});
 if(reply.outcome?.result!=="decision_episode_revoked")throw Error(reply.error??"The native owner did not revoke the episode.");
}
/** Exact tariff arithmetic at the form boundary. The kernel checks it again. */
export function decisionReservation(inputTokens:number,outputTokens:number,inputRate:number,outputRate:number):number{
 for(const value of [inputTokens,outputTokens,inputRate,outputRate])if(!Number.isSafeInteger(value)||value<0)throw Error("Tariff rates and token bounds must be whole, non-negative numbers.");
 const micro=(BigInt(inputTokens)*BigInt(inputRate)+BigInt(outputTokens)*BigInt(outputRate)+999999n)/1000000n;
 if(micro>BigInt(Number.MAX_SAFE_INTEGER))throw Error("The tariff exceeds the supported budget bound.");
 return Number(micro);
}
