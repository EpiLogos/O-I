import type {ReadingRef,SubjectBinding} from "./types";

export type Disclosure<T>={availability:"available";value:T;reading:ReadingRef}|{availability:"unavailable"|"withheld"|"stale";reading?:ReadingRef};
export interface AgentPresentationReading {
  agentSessionRef:string;
  owner:"ai-kit";
  identity:ReadingRef;
  agentRef:Disclosure<string>;
  personality:Disclosure<Record<string,string|number|boolean>>;
  presence:Disclosure<string>;
  currentSubject:Disclosure<string>;
  activity:Disclosure<{activity_ref:string;state:string}>;
  methods:Disclosure<ReadingRef[]>;
  capabilities:Disclosure<ReadingRef[]>;
}

/** Session-local presentation input. Values can influence material treatment,
 * while the returned binding retains the same AgentSession and no authority. */
export function agentBeingBinding(reading:AgentPresentationReading):SubjectBinding {
  if(!reading.agentSessionRef.startsWith("agent-session/")||reading.identity.availability!=="available")throw new Error("AIKit AgentSession identity is unavailable");
  if(reading.agentRef.availability!=="available"||!reading.agentRef.value.trim())throw new Error("AIKit does not disclose the Agent identity represented by this session");
  const qualified=[reading.identity];
  for(const disclosure of [reading.agentRef,reading.personality,reading.presence,reading.currentSubject,reading.activity,reading.methods,reading.capabilities])if(disclosure.reading)qualified.push(disclosure.reading);
  return {subject_ref:reading.agentRef.value,native_owner:reading.owner,presentation_role:"being",sources:[reading.identity],readings:qualified.slice(1),actions:[]};
}

export function availableAgentPresentation(reading:AgentPresentationReading){
  return {
    personality:reading.personality.availability==="available"?reading.personality.value:null,
    presence:reading.presence.availability==="available"?reading.presence.value:null,
    currentSubject:reading.currentSubject.availability==="available"?reading.currentSubject.value:null,
    activity:reading.activity.availability==="available"?reading.activity.value:null,
    methods:reading.methods.availability==="available"?reading.methods.value:null,
    capabilities:reading.capabilities.availability==="available"?reading.capabilities.value:null,
  };
}
