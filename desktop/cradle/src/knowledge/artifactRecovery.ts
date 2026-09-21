import type {CentralLocation, KernelTransportStatus} from '../kernel/types';
import type {ExpressionDocument} from '../expression/types';
import {requireSavedExpression} from './expressionSaveReceipt';
import {listFiles, readFile} from '../files/client';
import {ACTOR, type ApplyKernel} from './construction';
import {expressionOperation, sameComposition, type ArtifactReturn} from './constructionProjection';

/** An exact pending author operation, not an extra source store. Keep the
 * intended document until the native file is confirmed, including after a
 * transport interruption or process restart. Never retry with changed content. */
export interface ArtifactSaveIntent {
  schema: 'oi.wiki-artifact-save/v1';
  document: ExpressionDocument;
  destination: {parent: CentralLocation; name: string; operation_ref: string}
    | {location: CentralLocation; revision: string};
}
export type ArtifactInspection = {state: 'saved'; artifact: ArtifactReturn}
  | {state: 'absent'; detail: string} | {state: 'conflict'; detail: string};

export async function prepareArtifactSave(transport: KernelTransportStatus, reference: string, destination: ArtifactSaveIntent['destination']): Promise<ArtifactSaveIntent> {
  const current = await expressionOperation(transport, {operation: 'inspect', expression_ref: reference});
  if (!current.document || current.document.expression_ref !== reference) throw new Error('The working composition is unavailable; reopen it before saving.');
  return {schema: 'oi.wiki-artifact-save/v1', document: current.document, destination};
}

/** This is an independent native read, not a replay of the save. Matching all
 * document fields matters: ref/revision alone do not prove equal file bytes. */
export async function inspectArtifactSave(transport: KernelTransportStatus, intent: ArtifactSaveIntent): Promise<ArtifactInspection> {
  const destination = intent.destination;
  let location: CentralLocation;
  if ('location' in destination) location = destination.location;
  else {
    const directory = await listFiles(transport, destination.parent.path, true);
    if (directory.location.root !== destination.parent.root || directory.location.ref !== destination.parent.ref) throw new Error('The destination directory belongs to a different native ground.');
    const entry = directory.entries.find(item => item.name === destination.name);
    if (!entry) return {state: 'absent', detail: 'No file exists at the exact destination. The retained operation can be retried explicitly.'};
    if (entry.kind !== 'file') return {state: 'conflict', detail: 'Another native object occupies the chosen filename.'};
    location = entry.location;
  }
  const file = await readFile(transport, location);
  if (!sameComposition(file.location, location) || typeof file.revision !== 'string' || !file.revision) throw new Error('The pending artifact reading was redirected or has no native revision. Keep the exact save pending.');
  let document: unknown;
  try {document = JSON.parse(file.content);} catch {return {state: 'conflict', detail: 'The destination contains another kind of file. Nothing has been overwritten.'};}
  if (!sameComposition(document, intent.document)) return {state: 'conflict', detail: 'The destination does not match the retained composition. Keep the pending operation and inspect the other file.'};
  return {state: 'saved', artifact: {file, document: intent.document}};
}

export async function performArtifactSave(transport: KernelTransportStatus, intent: ArtifactSaveIntent, apply?: ApplyKernel): Promise<ArtifactReturn> {
  const {document, destination} = intent;
  const current = await expressionOperation(transport, {operation: 'inspect', expression_ref: document.expression_ref});
  if (!current.document || !sameComposition(current.document, document)) throw new Error('The working composition changed or was closed. Inspect the pending file save instead of replaying it with different contents.');
  const result = await expressionOperation(transport, 'location' in destination
    ? {operation: 'save', expression_ref: document.expression_ref, expected_revision: document.revision,
      location: destination.location, expected_file_revision: destination.revision, actor: ACTOR, actor_kind: 'human'}
    : {operation: 'save_as', expression_ref: document.expression_ref, expected_revision: document.revision,
      parent: destination.parent, name: destination.name, operation_ref: destination.operation_ref, actor: ACTOR, actor_kind: 'human'}, apply);
  requireSavedExpression(result);
  const inspected = await inspectArtifactSave(transport, intent);
  if (inspected.state !== 'saved') throw new Error(inspected.detail);
  if (!sameComposition(inspected.artifact.file.location, result.file.location) || inspected.artifact.file.revision !== result.file.revision) throw new Error('The native save receipt and independent file reading disagree. The exact operation is retained; inspect the destination before Return.');
  return inspected.artifact;
}

/** Explicit recovery reuses the native document validator and refuses to replace
 * a different live composition. It does not write or claim an artifact. */
export async function restorePendingArtifactDocument(transport: KernelTransportStatus, intent: ArtifactSaveIntent, apply?: ApplyKernel): Promise<ExpressionDocument> {
  const result = await expressionOperation(transport, {operation:'open',document:intent.document,actor:ACTOR}, apply);
  if(!result.document||!sameComposition(result.document,intent.document))throw new Error('The owner could not restore the exact retained composition. Keep the pending save and inspect the live document.');
  return result.document;
}

/** Read the exact file recorded by a completed save after a UI/kernel restart.
 * This is file verification only: it does not mount or overwrite a live draft. */
export async function readSavedArtifact(transport: KernelTransportStatus, held: {location: CentralLocation; revision: string; expression_ref: string}): Promise<ArtifactReturn> {
  const file = await readFile(transport, held.location);
  if (!sameComposition(file.location, held.location)) throw new Error('The saved artifact reading was redirected. Return remains pending at its original location.');
  if (file.revision !== held.revision) throw new Error('The saved Expression file has changed. Its previous Return will not be replayed against different bytes.');
  let document: Partial<ExpressionDocument>;
  try {document = JSON.parse(file.content);} catch {throw new Error('The saved artifact is no longer an Expression document.');}
  if (!document || document.schema !== 'oi.expression/v1' || document.expression_ref !== held.expression_ref
    || !Number.isSafeInteger(document.revision) || Number(document.revision) < 1
    || !Array.isArray(document.scenes) || !document.entities || typeof document.entities !== 'object' || Array.isArray(document.entities)
    || !document.relations || typeof document.relations !== 'object' || Array.isArray(document.relations)) throw new Error('The saved file no longer names the recorded Expression.');
  return {file, document: document as ExpressionDocument};
}
