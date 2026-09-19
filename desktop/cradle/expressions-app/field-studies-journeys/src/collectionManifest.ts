/** Collection import semantics (the library refit, gap D3): importing a
 * collection manifest restores it AS A COLLECTION — its membership and
 * ordering intact — never N loose expressions silently flattened. Every
 * manifest entry resolves to a restored member or a NAMED error; nothing
 * is dropped silently (restored + failed always equals the membership
 * count, so completeness is checkable, not promised).
 *
 * This path sits beside the existing single-document import
 * (importDocuments in nativeBridge.ts, whose shape it deliberately does
 * not change); wiring it into the Library UI is the named integration
 * seam. The manifest and provenance law itself lives in model.ts
 * (validateCollectionManifest / collectionMembership). */
import {validateJourney,validateCollectionManifest,collectionMembership,COLLECTION_PROVENANCE_SCHEMA} from './model.js';
import type {Journey,CollectionManifest,CollectionManifestEntry,CollectionProvenance} from './model.js';

export interface ImportedCollectionMember {slot:number;entry:CollectionManifestEntry;journey:Journey}
export interface CollectionMemberError {slot:number;id:string;file:string;message:string}
export interface CollectionImport {
 collection:{
  schema:string;
  /** The validated manifest, carried verbatim — provenance included. */
  manifest:CollectionManifest;
  /** The provenance envelope as it stood, or null on an old manifest. */
  provenance:CollectionProvenance|null;
  /** True only when the envelope declares the provenance schema this
   * build knows; an unknown envelope is carried, not rejected. */
  provenance_known:boolean;
  /** The full membership in manifest order — members and errors alike
   * are accounted against this list by slot. */
  membership:CollectionManifestEntry[];
  restored:number;
  failed:number;
 };
 members:ImportedCollectionMember[];
 errors:CollectionMemberError[];
}
/** Import a collection manifest. `readMember` resolves one entry to its
 * journey document (already parsed JSON) and may throw — the message is
 * carried verbatim, named with the entry's slot, id and file. Members
 * return in manifest order; a member whose file carries a different
 * expression id than the manifest names is a named error, never a silent
 * rewrite of identity. */
export async function importCollectionManifest(raw:unknown,readMember:(entry:CollectionManifestEntry)=>Promise<unknown>):Promise<CollectionImport> {
 const manifest=validateCollectionManifest(raw);
 const membership=collectionMembership(manifest);
 const members:ImportedCollectionMember[]=[],errors:CollectionMemberError[]=[];
 for(const [slot,entry] of membership.entries()){
  try{
   const journey=validateJourney(await readMember(entry));
   if(journey.id!==entry.id)throw new Error(`the file carries expression "${journey.id}" where the manifest names "${entry.id}"`);
   members.push({slot,entry,journey});
  }catch(e){errors.push({slot,id:entry.id,file:entry.file,message:e instanceof Error?e.message:String(e)});}
 }
 const provenance=manifest.provenance??null;
 return {collection:{schema:manifest.schema,manifest,provenance,provenance_known:provenance!==null&&provenance.schema===COLLECTION_PROVENANCE_SCHEMA,membership,restored:members.length,failed:errors.length},members,errors};
}
