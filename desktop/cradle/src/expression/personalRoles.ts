import type {ReadingRef,SubjectBinding} from "./types";

/** The Personal-Web Beings/Things page is a reference carrier. This adapter
 * reuses its native subject and source identities as Expression presentation
 * roles; it never derives identity from page title, family, or proximity. */
export interface PersonalPageRoleReading {
  profile:"oi.page/v1";
  meta:{family:"beings"|"things";revision:number};
  bindings:{subjectRef:string|null;sources:{ref:string;revision:string}[]};
}

export function personalPageSubjectBinding(page:PersonalPageRoleReading,nativeOwner:string):SubjectBinding {
  if(page.profile!=="oi.page/v1"||!Number.isSafeInteger(page.meta.revision)||page.meta.revision<0)throw new Error("Unsupported Personal-Web page reading");
  if(!page.bindings.subjectRef)throw new Error("Personal-Web page does not disclose a native subject ref");
  if(!nativeOwner.trim())throw new Error("Native owner is required");
  const sources:ReadingRef[]=page.bindings.sources.map(source=>{
    if(!source.ref.trim()||!source.revision.trim())throw new Error("Personal-Web source basis is incomplete");
    return {ref:source.ref,revision:source.revision,availability:"available"};
  });
  return {subject_ref:page.bindings.subjectRef,native_owner:nativeOwner,presentation_role:page.meta.family==="beings"?"being":"thing",sources,readings:[],actions:[]};
}
