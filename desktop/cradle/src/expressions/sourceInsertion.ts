/** Native Library selection becomes one source-bound occurrence. The Library
 * label is presentation; its native owner supplies identity and revision. */
import type {KernelTransportStatus,KnowledgeReading} from '../kernel/types';
import type {SubjectBinding,ReadingRef} from '../expression/types';
import type {LibraryItem} from '../library/scope';
import {listFiles,readFileBytes} from '../files/client';
import {readRegister} from '../knowledge/construction';
import {knowledge} from '../knowledge/client';
import {sameCollectionLocation} from './collectionReadings';
export interface NativeInsertionTarget {host_id:string;host_epoch:number;expression_ref:string;revision:number;scene_ref:string}
export interface LibraryInsertionCapture {target:NativeInsertionTarget;workspaceId:string;mode:string}
export interface VerifiedInsertionSource {title:string;binding:SubjectBinding}
export async function verifyInsertionSource(transport:KernelTransportStatus,item:LibraryItem,signal?:AbortSignal):Promise<VerifiedInsertionSource>{
 signal?.throwIfAborted();
 if(item.fixture)throw Error('A fixture cannot be inserted as native source material.');
 let ref:string,revision:string,owner:string;
 const registerReadings:ReadingRef[]=[],registerSources:ReadingRef[]=[];
 if(item.sourceLocation){
  const location=item.sourceLocation;
  if(item.ref!==location.ref)throw Error('The Library item no longer names its exact source location.');
  const slash=location.path.lastIndexOf('/'),directory=await listFiles(transport,slash<0?'.':location.path.slice(0,slash),true);
  signal?.throwIfAborted();
  const entry=directory.entries.find(row=>sameCollectionLocation(row.location,location));
  if(!entry||entry.kind!=='file'||!entry.retrieval_allowed)throw Error('The source owner does not admit reading this exact file.');
  // Binary-safe owner reading verifies identity/revision; bytes stay here.
  // This inserts a source binding, not an invented image-admission receipt.
  const reading=await readFileBytes(transport,location);
  signal?.throwIfAborted();
  if(!sameCollectionLocation(reading.location,location))throw Error('The source owner returned another file.');
  ref=reading.location.ref;revision=reading.revision;owner='central';
 }else if(item.address){
  const reading=await knowledge<KnowledgeReading>(transport,item.project,{action:'read',address:item.address},{signal,fresh:true});
  signal?.throwIfAborted();
  if(reading.resource!==item.ref||reading.resource!==item.address.value)throw Error('The source owner redirected this Library selection.');
  if(!reading.revision||!reading.provider)throw Error('The source owner did not disclose a binding revision.');
  ref=reading.resource;revision=reading.revision;owner=reading.provider;
  if(item.address.kind==='wiki'){
   // Resolve through the explicitly selected native register, never through
   // opaque ID fragments. Retain the owner's real basis so an ordinary
   // authored Scene can later open this source through the existing resolver.
   const register=await readRegister(transport,item.project);signal?.throwIfAborted();
   const raw:unknown=JSON.parse(register.file.content);
   const rows=Array.isArray(raw)?raw:raw&&typeof raw==='object'&&'objects' in raw&&Array.isArray(raw.objects)?raw.objects:[];
   if(!rows.some(row=>row&&typeof row==='object'&&row.ref===ref))throw Error('The selected Wiki source is not disclosed in this native register; open its owning register before inserting it.');
   registerReadings.push({ref:`wiki:${register.file.location.path}`,revision:register.file.revision,availability:'available'});
   registerSources.push({ref:register.source_ref,revision:register.file.revision,availability:'available'});
  }
 }else throw Error('This Library item has no native source reading address.');
 if(!revision||item.revision!==undefined&&item.revision!==revision)throw Error('The selected source changed; refresh the Library before inserting it.');
 const basis={ref,revision,availability:'available' as const};
 return {title:item.title.trim()||'Source',binding:{subject_ref:ref,native_owner:owner,presentation_role:'thing',sources:[basis,...registerSources],readings:[basis,...registerReadings],actions:[]}};
}
