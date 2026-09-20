import {useEffect, useRef, useState} from "react";
import "./collectionMembership.css";
import {useKernel} from "../kernel/KernelProvider";
import type {LibraryItem} from "./scope";
import {editManifestMembership, saveNativeCollectionMember, setNativeCollections, type ManifestMembershipChange} from "./collectionOperations";

/** Compact, explicit native actions beside the selected Library subject. */
export function CollectionMembershipEditor({item, onChanged}: {item: LibraryItem; onChanged: () => void}) {
  const {transport} = useKernel();
  const [labels, setLabels] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [occurrence, setOccurrence] = useState(0);
  const generation = useRef(0);
  const membership = item.collectionMemberships?.[occurrence];
  const nativeLabels = (item.nativeCollections ?? []).join("\n");
  const membershipBasis = item.collectionMemberships?.map(m => m.manifest_revision).join("|");
  useEffect(() => { generation.current++; setOccurrence(0); setStatus(""); setError(""); setPending(false); return () => { generation.current++; }; }, [item.ref]);
  useEffect(() => { generation.current++; setPending(false); }, [item.revision, membershipBasis]);
  useEffect(() => { setLabels(nativeLabels); }, [item.ref, nativeLabels]);
  useEffect(() => { setTitle(membership?.title ?? ""); }, [membership?.title]);
  const act = async (operation: () => Promise<string>) => {
    const current = generation.current;
    setPending(true); setError(""); setStatus("");
    try { const message = await operation(); if (current === generation.current) { setStatus(message); onChanged(); } }
    catch (cause) { if (current === generation.current) setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { if (current === generation.current) setPending(false); }
  };
  const edit = (change: ManifestMembershipChange) => {
    if (!membership) return;
    void act(async () => { const r = await editManifestMembership(transport, membership, change); return r.message ?? (r.state === "unchanged" ? "Membership is already at that boundary." : "Membership saved through Central. The member source is unchanged."); });
  };
  if (!membership && !item.expressionRef) return null;
  return <details className="oi-disclosure lib-membership-editor">
    <summary>Collection membership</summary>
    {membership && <>
      <label>Collection <select className="oi-input" aria-label="Selected collection" value={occurrence} disabled={pending} onChange={e => setOccurrence(Number(e.target.value))}>
        {item.collectionMemberships!.map((m, i) => <option key={m.manifest_path + ":" + m.slot} value={i}>{m.manifest_path} · {m.group}</option>)}
      </select></label>
      <label>Member label <input className="oi-input" value={title} maxLength={300} disabled={pending} onChange={e => setTitle(e.target.value)}/></label>
      <div className="oi-action-group">
        <button type="button" className="oi-action" disabled={pending} onClick={() => edit({kind: "rename", title})}>Save label</button>
        <button type="button" className="oi-action" disabled={pending} onClick={() => edit({kind: "move", direction: "earlier"})}>Move earlier</button>
        <button type="button" className="oi-action" disabled={pending} onClick={() => edit({kind: "move", direction: "later"})}>Move later</button>
        <button type="button" className="oi-action" disabled={pending} onClick={() => edit({kind: "remove"})}>Remove membership</button>
      </div>
      <p className="oi-note">These actions edit the collection reference, never the member source. Removal is not file deletion.</p>
    </>}
    {item.expressionRef && <>
      <label>Collections, one name per line <textarea className="oi-input" rows={3} value={labels} disabled={pending} onChange={e => setLabels(e.target.value)}/></label>
      <div className="oi-action-group">
        <button type="button" className="oi-action" disabled={pending} onClick={() => void act(async () => { await setNativeCollections(transport, item.expressionRef!, Number(item.revision), labels.split("\n").map(s => s.trim()).filter(Boolean)); return "Native membership applied. Save to source separately to publish this document revision."; })}>Apply membership</button>
        <button type="button" className="oi-action" disabled={pending} onClick={() => void act(async () => { await saveNativeCollectionMember(transport, item.expressionRef!, Number(item.revision)); return "Native Expression saved and read back from its bound source."; })}>Save to source</button>
      </div>
    </>}
    {pending && <p className="oi-note" role="status">Applying native operation…</p>}
    {status && <p className="oi-note" role="status">{status}</p>}
    {error && <p className="oi-refusal" role="alert">{error}</p>}
  </details>;
}
