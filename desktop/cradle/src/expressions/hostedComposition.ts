/** Bounded file operations for the existing imported Expressions application.
 * The Wiki's native artifact recovery path is the owner of save/readback laws;
 * this module supplies receiving forms, not a second save or source service. */
import {listFiles, readFile} from '../files/client';
import {prepareArtifactSave, performArtifactSave, inspectArtifactSave, type ArtifactSaveIntent} from '../knowledge/artifactRecovery';
import {expressionOperation, sameComposition} from '../knowledge/constructionProjection';
import type {CentralLocation, KernelTransportStatus} from '../kernel/types';
import type {ExpressionDocument} from '../expression/types';

type ObjectValue=Record<string,unknown>;
function object(value:unknown):ObjectValue {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('A structured native file request is required');
 return value as ObjectValue;
}
function fields(value:ObjectValue,allowed:string[]):void {
 if(Object.keys(value).some(key=>!allowed.includes(key)))throw new Error('Unsupported native file request field');
}
function text(value:unknown):string {
 if(typeof value!=='string'||!value.trim()||value.length>4096||value.includes('\0'))throw new Error('A bounded native file name or reference is required');
 return value;
}
function relative(value:unknown):string {
 const path=text(value);
 if(path.startsWith('/')||path.includes('\\')||path.split('/').some(part=>part==='..'||!part))throw new Error('Choose a Central-relative path without parent traversal');
 return path;
}
function location(raw:unknown,allowRoot=false):CentralLocation {
 const value=object(raw);fields(value,['schema','ref','root','path']);
 if(value.schema!=='central.path-ref/v1')throw new Error('The location is not owner-disclosed Central ground');
 return {schema:'central.path-ref/v1',ref:text(value.ref),root:text(value.root),path:allowRoot&&value.path===''?'':relative(value.path)};
}
function document(raw:unknown):ExpressionDocument {
 const value=object(raw);
 if(value.schema!=='oi.expression/v1'||typeof value.expression_ref!=='string'||!value.expression_ref.startsWith('expression:')||!Number.isSafeInteger(value.revision)||Number(value.revision)<1)throw new Error('An exact native Expression basis is required');
 // Native effects are always checked again by the owner's Document validator.
 return value as unknown as ExpressionDocument;
}
function intent(raw:unknown):ArtifactSaveIntent {
 const value=object(raw);fields(value,['schema','document','destination']);
 if(value.schema!=='oi.wiki-artifact-save/v1')throw new Error('Unsupported native artifact save intent');
 const destination=object(value.destination);
 if('location'in destination){fields(destination,['location','revision']);return {schema:'oi.wiki-artifact-save/v1',document:document(value.document),destination:{location:location(destination.location),revision:text(destination.revision)}};}
 fields(destination,['parent','name','operation_ref']);
 const name=relative(destination.name);if(name.includes('/'))throw new Error('The artifact name is one filename, not a redirected path');
 return {schema:'oi.wiki-artifact-save/v1',document:document(value.document),destination:{parent:location(destination.parent,true),name,operation_ref:text(destination.operation_ref)}};
}
export async function hostedCompositionFile(transport:KernelTransportStatus,raw:unknown):Promise<unknown> {
 const request=object(raw),operation=request.operation;
 if(operation==='prepare'){
  fields(request,['operation','document','destination']);
  const basis=document(request.document),choice=object(request.destination);
  let destination:ArtifactSaveIntent['destination'];
  if('location'in choice){fields(choice,['location','revision']);destination={location:location(choice.location),revision:text(choice.revision)};}
  else {
   fields(choice,['parent_path','name']);
   const parent=await listFiles(transport,relative(choice.parent_path),true);
   const name=relative(choice.name);if(name.includes('/'))throw new Error('Choose a filename within the disclosed parent');
   destination={parent:parent.location,name,operation_ref:`operation:expression-file:${crypto.randomUUID()}`};
  }
  const prepared=await prepareArtifactSave(transport,basis.expression_ref,destination);
  if(!sameComposition(prepared.document,basis))throw new Error('The native composition changed before file save; preserve the draft and reconcile');
  return prepared;
 }
 if(operation==='perform'||operation==='inspect'){
  fields(request,['operation','intent']);
  const held=intent(request.intent);
  return operation==='perform'?performArtifactSave(transport,held):inspectArtifactSave(transport,held);
 }
 if(operation==='open'){
  fields(request,['operation','path']);
  const path=relative(request.path),slash=path.lastIndexOf('/');
  const directory=await listFiles(transport,slash<0?'.':path.slice(0,slash),true);
  const entry=directory.entries.find(value=>value.name===path.slice(slash+1)&&value.kind==='file');
  if(!entry||!entry.retrieval_allowed)throw new Error('The owner does not disclose that Expression file for reading');
  const file=await readFile(transport,entry.location),basis=document(JSON.parse(file.content));
  if(!sameComposition(file.location,entry.location)||!file.revision)throw new Error('Native file readback was redirected or has no revision');
  const opened=await expressionOperation(transport,{operation:'open',document:basis,actor:'human:expressions-app'});
  if(!opened.document||!sameComposition(opened.document,basis))throw new Error('The file differs from the current native working composition; no live work was overwritten');
  return {document:opened.document,file};
 }
 throw new Error(`Unsupported Expression file operation: ${String(operation)}`);
}
