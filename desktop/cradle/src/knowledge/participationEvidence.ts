import {listFiles,readFile} from '../files/client';
import type {KernelTransportStatus} from '../kernel/types';
import type {DraftMember} from './constructionDraft';
/** A typed path chosen by the person resolves through Central's directory
 * reading; the renderer never constructs or parses a native source ref. */
export async function readParticipationEvidence(transport:KernelTransportStatus,path:string):Promise<NonNullable<DraftMember['facet_sources']>[number]> {
 const value=path.trim(),slash=value.lastIndexOf('/'),folder=slash<0?'':value.slice(0,slash),name=value.slice(slash+1);
 if(!name)throw Error('Choose an existing evidence file within this World.');
 const listing=await listFiles(transport,folder,true),entry=listing.entries.find(row=>row.kind==='file'&&row.name===name);
 if(!entry)throw Error('Central did not disclose this evidence file.');
 const reading=await readFile(transport,entry.location);
 return {source_ref:reading.source?.ref??reading.location.ref,revision:reading.revision,location:reading.location,title:entry.name};
}
