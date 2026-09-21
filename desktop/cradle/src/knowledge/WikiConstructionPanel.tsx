import {useEffect, useRef, useState} from 'react';
import {useKernel} from '../kernel/KernelProvider';
import {useExpressionStage, type StagePresentation} from '../stage/ExpressionStage';
import {expressionConfig} from '../expression/engineProjection';
import {summonExpression} from '../expression/summon';
import type {ExpressionDocument} from '../expression/types';
import type {SurfaceBinding} from '../surface/types';
import type {WikiNavigate} from './wikiDocument';
import type {WikiPassage} from './selection';
import {listFiles} from '../files/client';
import {CONSTRUCTION, authoringForms, newRef, readRegister, saveConstruction,
  type AuthoringForm, type ConstructionRequest, type SavedConstruction, type WikiRegister} from './construction';
import {emptyDraft, fromNative, withForm, withPassage, withoutMember, draftRequest, type ConstructionDraft} from './constructionDraft';
import {projectConstruction, attachCompositionReturn, compositionReturnRequest, compositionAttached, compositionReturnRecorded, reopenComposition, type ArtifactReturn} from './constructionProjection';
import {prepareArtifactSave, performArtifactSave, inspectArtifactSave, restorePendingArtifactDocument, readSavedArtifact, type ArtifactSaveIntent} from './artifactRecovery';
import './wikiConstruction.css';

import {memberAnchor, type ConstructionCheckpoint} from './constructionCheckpoint';
export type {ConstructionCheckpoint} from './constructionCheckpoint';
type Props = {binding: SurfaceBinding; open: boolean; incoming?: WikiPassage; checkpoint?: ConstructionCheckpoint; onCheckpoint: (value: ConstructionCheckpoint) => void; onClose: () => void; onNavigate: WikiNavigate; onSaved: () => void; requestedFrame?: string};
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

/** A source-backed authoring drawer in the existing Wiki surface. Committed
 * work belongs to the native register. Only unsaved input/checkpoints are held
 * by the containing surface, alongside its reading/camera history. */
export function WikiConstructionPanel({binding, open, incoming, checkpoint, onCheckpoint, onClose, onNavigate, onSaved, requestedFrame}: Props) {
  const kernel = useKernel(), stage = useExpressionStage();
  const [register, setRegister] = useState<WikiRegister>(), [forms, setForms] = useState<AuthoringForm[]>([]);
  const [draft, setDraft] = useState<ConstructionDraft>(() => checkpoint?.draft ?? emptyDraft());
  const [pending, setPending] = useState<ConstructionRequest | undefined>(checkpoint?.pending);
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [saved, setSaved] = useState<SavedConstruction>(), [dirty, setDirty] = useState(checkpoint ? !checkpoint.saved : false);
  const [document, setDocument] = useState<ExpressionDocument>(), [artifact, setArtifact] = useState<ArtifactReturn>();
  const [artifactLocation,setArtifactLocation]=useState(checkpoint?.artifact);
  const [artifactSave,setArtifactSave]=useState<ArtifactSaveIntent|undefined>(checkpoint?.artifactSave);
  const [folder, setFolder] = useState(''), [filename, setFilename] = useState('');
  const [showDiscard, setShowDiscard] = useState(false);
  const presentation = useRef<StagePresentation | null>(null), host = useRef<HTMLDivElement>(null);
  const current = useRef(draft); current.current = draft;
  const pendingReturn = pending?.changes.length === 1 && pending.changes[0].change === 'composition_attach';
  const artifactPointer = artifact ? {location: artifact.file.location, revision: artifact.file.revision, expression_ref: artifact.document.expression_ref} : artifactLocation;
  const wantedFrame = useRef<string>();
  const alive = useRef(true), initialized = useRef(false), incomingKey = useRef<WikiPassage>();
  const checkpointRef = useRef(onCheckpoint); checkpointRef.current = onCheckpoint;

  const update = (value: ConstructionDraft) => {setDraft(value); setDirty(true); setError(''); setNotice('');};
  const closePresentation = () => {presentation.current?.release(); presentation.current = null;};
  useEffect(() => {alive.current = true; return () => {alive.current = false; closePresentation();};}, []);
  useEffect(() => {if (!open) closePresentation();}, [open]);
  useEffect(() => {
    try {checkpointRef.current({draft, pending, saved: !dirty, artifactSave,
      artifact: artifact ? {location: artifact.file.location, revision: artifact.file.revision, expression_ref: artifact.document.expression_ref} : artifactLocation});}
    catch(error){setError(`Recovery could not be saved on this device: ${message(error)}`);}
  }, [draft, pending, dirty, artifact, artifactLocation, artifactSave]);
  const read = async () => {
    const result = await readRegister(kernel.transport, binding.project);
    if (alive.current) {
      setRegister(result);
      setDraft(value => value.space_ref || value.basis ? value : {...value, space_ref: result.spaces[0]?.ref ?? ''});
      if (!folder) {
        const path = result.file.location.path;
        const marker = '/ProjectCentral/';
        setFolder(path.includes(marker) ? path.slice(0, path.indexOf(marker)) : 'Work');
      }
    }
    return result;
  };
  useEffect(() => {
    if (!open || initialized.current) return;
    initialized.current = true; setBusy('Reading native constellations…');
    void read().catch(error => {if (alive.current) setError(message(error));}).finally(() => {if (alive.current) setBusy('');});
    void authoringForms(kernel.transport, binding.project).then(value => {if (alive.current) setForms(value);}, () => {if (alive.current) setNotice('QL authoring forms are unavailable from this owner. Ordinary constellation work remains available.');});
  }, [open]);
  useEffect(() => {
    if (!incoming || incomingKey.current === incoming) return;
    if (pending) {setError('Inspect the previous save before adding another passage. Your current source selection is still in the reader.'); return;}
    incomingKey.current = incoming;
    try {update(withPassage(current.current, incoming));} catch (error) {setError(message(error));}
  }, [incoming, pending]);

  const acceptSaved = (value: SavedConstruction) => {
    setSaved(value); setPending(undefined); setDraft(fromNative(value.reading.frame, value.reading.relations)); setDirty(false);
    setNotice(value.indexed_availability_proven ? 'Saved and found through native Wiki/search.' : 'Saved in the native Wiki. Search readback has not yet confirmed availability.');
    onSaved();
  };
  const save = async () => {
    if (!register) return;
    setError(''); setBusy('Saving constellation…');
    let request: ConstructionRequest;
    try {request = pending ?? draftRequest(draft);} catch (error) {setError(message(error)); setBusy(''); return;}
    try {
      checkpointRef.current({draft,pending:request,saved:!dirty,artifactSave,artifact:artifactPointer});
      setPending(request);
      const value = await saveConstruction(kernel.transport, binding.project, register, request, draft.members.flatMap(member => member.passage ? [member.passage] : []), kernel.apply);
      if (!alive.current) return;
      acceptSaved(value);
      // Readback failure never converts an acknowledged save into a retry.
      await read().catch(error => setNotice(`Saved; the register refresh is unavailable: ${message(error)}`));
    } catch (error) {if (alive.current) setError(`${message(error)} Inspect the native result before changing or retrying this proposal.`);}
    finally {if (alive.current) setBusy('');}
  };
  const inspect = async () => {
    setError(''); setBusy('Inspecting native result…');
    try {
      const value = await read(), found = value.frames.find(frame => frame.ref === draft.frame_ref);
      if (pending) {
        const applied = found?.[CONSTRUCTION];
        if (applied?.applied?.[pending.operation_ref]) {
          if (pendingReturn && !compositionReturnRecorded(found!, pending)) {
            setError('The Return operation is recorded, but the current attachment no longer matches this request. The artifact remains saved; inspect the newer constellation before reconciling it.');
            return;
          }
          setDraft(fromNative(found!, value.relations)); setDirty(false); setPending(undefined); setNotice('The previous operation was saved. The native result has been recovered; no duplicate was created.'); onSaved();
        } else if ((!found && pending.expected_revision === 0) || found?.revision === pending.expected_revision) {
          if (pendingReturn) setNotice('The Return is not recorded at this revision. Retry the exact retained Return; the artifact is still saved.');
          else {setPending(undefined); setNotice('The previous operation is not recorded. Your proposal is retained and may be revised or saved.');}
        } else setError('Another edit advanced this constellation. Your draft is retained. Open the saved revision separately before reconciling it.');
      } else setNotice('The native register has been refreshed. Your unsaved input is unchanged.');
    } catch (error) {setError(message(error));}
    finally {setBusy('');}
  };
  const openFrame = (reference: string) => {
    const found = register?.frames.find(frame => frame.ref === reference);
    if (!found) return;
    if (dirty || pending || artifactSave) {setError('Resolve or explicitly discard the pending work before opening another constellation.'); return;}
    try {closePresentation(); setDocument(undefined); setArtifact(undefined); setArtifactLocation(undefined); setSaved(undefined); setDraft(fromNative(found, register!.relations)); setDirty(false); setError('');} catch (error) {setError(message(error));}
  };
  useEffect(() => {if (requestedFrame && register && wantedFrame.current !== requestedFrame) {wantedFrame.current = requestedFrame; openFrame(requestedFrame);}}, [requestedFrame, register]);
  const createNew = () => {if(artifactSave){setError('Inspect the pending artifact save before starting another inquiry.');return;}closePresentation(); setDraft(emptyDraft(register?.spaces[0]?.ref)); setPending(undefined); setSaved(undefined); setDocument(undefined); setArtifact(undefined); setArtifactLocation(undefined); setDirty(false); setShowDiscard(false); setNotice(''); setError('');};
  const live = async () => {
    if (!draft.basis || dirty || pending) return;
    setBusy('Opening live composition…'); setError('');
    try {
      const projected = await projectConstruction(kernel.transport, binding.project, draft.basis, draft.original_relations);
      if (projected.state !== 'ready') throw new Error(projected.state === 'unavailable' ? projected.detail : 'The live composition changed. Reopen before applying more changes.');
      if (!alive.current) return;
      setDocument(projected.document); closePresentation();
      const config = expressionConfig(projected.document);
      const active = stage.present({id: `wiki-construction:${binding.id}`, plane: 'overlay', recipe: '', config, appearance: 'host', sceneRef: projected.document.selection.scene_ref});
      if (!active) throw new Error(stage.error ?? 'The existing Expression Stage could not present this composition.');
      presentation.current = active; active.setContainer(host.current);
      active.updateConfig(config, projected.document.selection.scene_ref, projected.document.selection.entity_ref ? [projected.document.selection.entity_ref] : []);
      await active.ready();
      if (alive.current && presentation.current === active) {host.current?.scrollIntoView({block:'nearest'}); setNotice('The live constellation is rendered. Select a body or relation to inspect its native identity.');}
    } catch (error) {if (alive.current) setError(message(error));}
    finally {if (alive.current) setBusy('');}
  };
  const saveArtifact = async () => {
    if ((!document && !artifactSave) || !draft.basis || dirty || pending) return;
    setBusy('Saving Expression artifact…'); setError('');
    try {
      let intent = artifactSave;
      if (!intent) {
        const held = artifact?.file ?? artifactLocation;
        const destination = held ? {location: held.location, revision: held.revision}
          : {parent: (await listFiles(kernel.transport, folder, true)).location, name: filename || 'constellation.expression.json', operation_ref: newRef('operation:expression')};
        intent = await prepareArtifactSave(kernel.transport, document!.expression_ref, destination);
        // Retain the exact intended document and operation before the native act.
        checkpointRef.current({draft, pending, saved: !dirty, artifactSave: intent, artifact: artifactPointer});
        setArtifactSave(intent);
      }
      const value = await performArtifactSave(kernel.transport, intent, kernel.apply);
      setArtifact(value); setDocument(value.document); setArtifactSave(undefined);
      setNotice('The Expression file is saved. Return it to this constellation with the separate action below.');
    } catch (error) {setError(message(error));}
    finally {setBusy('');}
  };
  const inspectFileSave = async () => {
    if (!artifactSave) return;
    setBusy('Inspecting saved artifact…'); setError('');
    try {
      const result = await inspectArtifactSave(kernel.transport, artifactSave);
      if (result.state === 'saved') {
        setArtifact(result.artifact);setDocument(result.artifact.document);setArtifactSave(undefined);
        setNotice('The exact composition file was recovered. No save was replayed; it is ready for Return.');
      } else setNotice(result.detail);
    } catch (error) {setError(message(error));}
    finally {setBusy('');}
  };
  const restoreFileComposition = async () => {
    if(!artifactSave)return;setBusy('Restoring retained composition…');setError('');
    try{const current=await restorePendingArtifactDocument(kernel.transport,artifactSave,kernel.apply);setDocument(current);setNotice('The exact retained composition is open. The file-save operation has not been replayed.');}
    catch(error){setError(message(error));}finally{setBusy('');}
  };
  const returnArtifact = async () => {
    if (!artifact || !draft.basis || !register || dirty || pending) return;
    setBusy('Returning saved Expression…'); setError('');
    try {
      const fresh = await read();
      const request = compositionReturnRequest(draft.basis, artifact);
      // Persist before dispatch. A lost Return response is resolved through the
      // existing pending-operation inspection, never by minting another Return.
      checkpointRef.current({draft, pending: request, saved: !dirty, artifactSave,
        artifact: {location: artifact.file.location, revision: artifact.file.revision, expression_ref: artifact.document.expression_ref}});
      setPending(request);
      const value = await attachCompositionReturn(kernel.transport, binding.project, fresh, draft.basis, artifact, kernel.apply, request);
      acceptSaved(value); setArtifact({...artifact, returned: value});
      await read().catch(error => setNotice(`Returned; refresh remains unavailable: ${message(error)}`));
    } catch (error) {setError(`The artifact remains saved. ${message(error)}`);}
    finally {setBusy('');}
  };
  const retryReturn = async () => {
    if (!pending || !pendingReturn || !draft.basis || dirty) return;
    setBusy('Retrying exact Return…'); setError('');
    try {
      const held = artifact ?? (artifactLocation ? await readSavedArtifact(kernel.transport, artifactLocation) : undefined);
      if (!held) throw new Error('Inspect the saved artifact before retrying its Return.');
      const fresh = await read();
      const value = await attachCompositionReturn(kernel.transport, binding.project, fresh, draft.basis, held, kernel.apply, pending);
      acceptSaved(value); setArtifact({...held, returned: value});
      await read().catch(error => setNotice(`Returned; refresh remains unavailable: ${message(error)}`));
    } catch (error) {setError(`The artifact remains saved. ${message(error)}`);}
    finally {setBusy('');}
  };
  const relationChanged = (index: number, patch: Partial<ConstructionDraft['relations'][number]>) => update({...draft, relations: draft.relations.map((edge, i) => i === index ? {...edge, ...patch} : edge)});
  return <aside className="wiki-construction" hidden={!open} aria-label="Constellation authoring">
    <header><h2>{draft.basis ? 'Work on constellation' : 'New constellation'}</h2><button className="oi-tool" aria-label="Close constellation authoring" onClick={onClose}>×</button></header>
    <p className="wiki-construction-intro">Gather passages, give them roles, and make connections. The original writing stays where it is.</p>
    {busy && <p role="status">{busy}</p>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <div className="wiki-construction-toolbar"><button className="oi-action" disabled={!!busy} onClick={()=>void inspect()}>Inspect saved state</button><button className="oi-action" disabled={!!busy || !!pending || !!artifactSave} onClick={()=>dirty ? setShowDiscard(true) : createNew()}>New inquiry</button></div>
    {showDiscard && <div role="group" aria-label="Discard construction draft"><p>Discard this unsaved proposal? Its source documents are not changed.</p><button className="oi-action" onClick={createNew}>Discard draft and start new</button><button className="oi-action" onClick={()=>setShowDiscard(false)}>Keep working</button></div>}
    {!!register?.frames.length && <label>Saved constellation<select aria-label="Open saved constellation" value={draft.basis?.ref ?? ''} disabled={!!busy || !!pending} onChange={event=>openFrame(event.target.value)}><option value="">Choose a saved inquiry…</option>{register.frames.map(frame=><option key={frame.ref} value={frame.ref}>{frame[CONSTRUCTION].title} · r{frame.revision}</option>)}</select></label>}
    <fieldset disabled={!!busy || !!pending}>
      <label>Title<input aria-label="Constellation title" maxLength={512} value={draft.title} onChange={event=>update({...draft,title:event.target.value})}/></label>
      <label>Inquiry<textarea aria-label="Constellation inquiry" rows={2} maxLength={4096} value={draft.question} onChange={event=>update({...draft,question:event.target.value})} placeholder="What are you exploring through this material?"/></label>
      {!draft.basis && <label>Wiki space<select aria-label="Constellation Wiki space" value={draft.space_ref} onChange={event=>update({...draft,space_ref:event.target.value})}><option value="">Select a space…</option>{register?.spaces.map(space=><option key={space.ref} value={space.ref}>{space.label}</option>)}</select></label>}
      <label>Frame<select aria-label="Constellation frame" value={forms.find(form=>form.shape_ref===draft.form?.shape_ref&&JSON.stringify(form.roles)===JSON.stringify(draft.form.roles))?.id ?? (draft.form?'existing':'')} onChange={event=>update(withForm(draft,forms.find(form=>form.id===event.target.value)))}><option value="">Open arrangement · no QL required</option>{draft.form&&!forms.some(form=>JSON.stringify(form.roles)===JSON.stringify(draft.form?.roles))&&<option value="existing">Current native frame</option>}{forms.map(form=><option key={form.id} value={form.id}>{form.label}</option>)}</select></label>
      {draft.form&&<p className="wiki-construction-hint">This is a chosen interpretive frame. Unfilled roles remain open; selecting a form does not classify the original sources.</p>}
      <h3>Members <span>{draft.members.length}</span></h3>
      {!draft.members.length&&<p>Select a passage in the reader and choose “Add to constellation”. You can save a frame with open roles first.</p>}
      <ol className="wiki-construction-members">{draft.members.map((member,index)=><li key={member.participation_ref} data-participation-ref={member.participation_ref}><blockquote>{member.label}</blockquote><button className="oi-action" onClick={()=>onNavigate({kind:member.sources.some(source=>source.source_ref===member.subject_ref)?'source':'wiki',value:member.subject_ref},member.passage?.title??member.subject_ref,memberAnchor(member))}>Read source {index+1}</button><label>Role<select aria-label={`Role for member ${index+1}`} value={member.role_ref??''} onChange={event=>update({...draft,members:draft.members.map((item,i)=>i===index?{...item,role_ref:event.target.value||null}:item)})}><option value="">Not assigned</option>{draft.form?.roles.map(role=><option key={role.role_ref} value={role.role_ref}>{role.label}</option>)}</select></label><button className="oi-tool" aria-label={`Remove member ${index+1}`} title="Removes this membership and its current connections; not the source" onClick={()=>update(withoutMember(draft,member.participation_ref))}>×</button></li>)}</ol>
      {draft.form&&<p className="wiki-construction-hint">Open roles: {draft.form.roles.filter(role=>!draft.members.some(member=>member.role_ref===role.role_ref)).map(role=>role.label).join(', ')||'none'}</p>}
      <h3>Connections <span>{draft.relations.length}</span></h3>
      <ol className="wiki-construction-relations">{draft.relations.map((edge,index)=><li key={edge.ref}><div className="wiki-construction-row"><label>From<select aria-label={`From member for connection ${index+1}`} value={edge.from} onChange={event=>relationChanged(index,{from:event.target.value})}>{draft.members.map((member,i)=><option key={member.participation_ref} value={member.participation_ref}>{i+1} · {member.label.slice(0,48)}</option>)}</select></label><label>To<select aria-label={`To member for connection ${index+1}`} value={edge.to} onChange={event=>relationChanged(index,{to:event.target.value})}>{draft.members.map((member,i)=><option key={member.participation_ref} value={member.participation_ref}>{i+1} · {member.label.slice(0,48)}</option>)}</select></label></div><label>Meaning<input aria-label={`Meaning of connection ${index+1}`} maxLength={256} value={edge.relation} onChange={event=>relationChanged(index,{relation:event.target.value})}/></label><div className="wiki-construction-row"><label>Direction<select aria-label={`Direction of connection ${index+1}`} value={edge.direction} onChange={event=>relationChanged(index,{direction:event.target.value})}><option value="directed">From → to</option><option value="undirected">Undirected</option><option value="bidirectional">Both directions</option></select></label><label>Standing<select aria-label={`Standing of connection ${index+1}`} value={edge.standing} onChange={event=>relationChanged(index,{standing:event.target.value})}>{['proposed','asserted','contested','uncertain'].map(value=><option key={value}>{value}</option>)}</select></label></div><button className="oi-action" onClick={()=>update({...draft,relations:draft.relations.filter((_,i)=>i!==index)})}>Remove connection</button></li>)}</ol>
      <button className="oi-action" disabled={draft.members.length<2} onClick={()=>update({...draft,relations:[...draft.relations,{ref:newRef('wiki:relation'),from:draft.members[0].participation_ref,to:draft.members[1].participation_ref,relation:'',direction:'directed',standing:'proposed',evidence:[]}]})}>Add connection</button>
    </fieldset>
    <div className="wiki-construction-toolbar"><button className="oi-action" disabled={!!busy || !!pending || !register || !dirty} onClick={()=>void save()}>Save constellation</button><button className="oi-action" disabled={!!busy || !!pending || dirty || !draft.basis || !draft.members.length} onClick={()=>void live()}>Open live composition</button></div>
    {pending&&<p className="wiki-construction-hint">This proposal is retained with its operation identity. Inspect the native result before retrying or editing.</p>}
    {pendingReturn&&<button className="oi-action" disabled={!!busy||dirty||(!artifact&&!artifactLocation)} onClick={()=>void retryReturn()}>Retry exact Return</button>}
    {saved?.continuity_warnings?.map((warning,index)=><p role="status" key={index}>{warning}</p>)}
    {artifactSave&&<section aria-label="Pending Expression save"><p>The exact file-save operation is retained, including its intended composition.</p><button className="oi-action" disabled={!!busy} onClick={()=>void inspectFileSave()}>Inspect pending Expression file</button><button className="oi-action" disabled={!!busy||dirty||!!pending} onClick={()=>void saveArtifact()}>Retry exact file save</button><button className="oi-action" disabled={!!busy} onClick={()=>void restoreFileComposition()}>Restore retained composition</button></section>}
    <div ref={host} className="wiki-construction-stage" hidden={!document} onPointerUp={event=>{
      const hit=presentation.current?.hitTest(event.clientX,event.clientY);if(!hit||!document)return;
      if(hit.kind==='entity'){
        const entity=document.entities[hit.entity_ref];stage.focusSelection([hit.entity_ref]);
        setNotice(entity?.subject?`${entity.title} · ${entity.subject.subject_ref}`:'Unbound expressive body');
      }else setNotice(`Connection ${hit.relation.ref} · r${hit.relation.revision}`);
    }}/>

    {document&&<section aria-label="Constellation Expression"><p>Expression r{document.revision} · {Object.keys(document.entities).length} bodies</p><button className="oi-action" onClick={()=>{closePresentation();summonExpression(document.expression_ref);}}>Edit glyphs, text, media and motion</button><details><summary>Save and Return composition</summary><label>Existing destination directory<input aria-label="Expression destination folder" value={folder} onChange={event=>setFolder(event.target.value)}/></label><label>Filename<input aria-label="Expression filename" value={filename} onChange={event=>setFilename(event.target.value)} placeholder="constellation.expression.json"/></label><button className="oi-action" disabled={!!busy||dirty||!!pending} onClick={()=>void saveArtifact()}>Save Expression file</button>{artifact&&<><p>Saved at {artifact.file.location.path}.</p><button className="oi-action" disabled={!!busy||dirty||!!pending||!!artifact.returned||compositionAttached(draft.basis,artifact)} onClick={()=>void returnArtifact()}>{artifact.returned||compositionAttached(draft.basis,artifact)?'Returned to constellation':'Return saved Expression to constellation'}</button></>}</details></section>}
    {draft.basis?.[CONSTRUCTION].compositions?.length ? <section aria-label="Returned compositions"><h3>Returned work</h3>{draft.basis[CONSTRUCTION].compositions!.map(item=><p key={item.reference}><button className="oi-action" onClick={()=>{setBusy('Reopening returned composition…');setError('');void reopenComposition(kernel.transport,item,kernel.apply).then(value=>{setDocument(value);summonExpression(value.expression_ref);},error=>setError(message(error))).finally(()=>setBusy(''));}}>{item.kind} · r{item.revision}</button></p>)}</section> : null}
  </aside>;
}
