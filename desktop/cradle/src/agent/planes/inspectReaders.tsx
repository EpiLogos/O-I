/**
 * The Inspect plane's known-kinds reader registry (owner commission
 * 2026-09-22, dossier §3.5 — "agent output renders as cards in the
 * transcript, never raw logs"): each payload kind a plane or centre surface
 * hands to Inspect gets a real readable component — rows and facts a person
 * can read. Unknown kinds degrade to readable text (scalar fields as rows,
 * strings as prose); the verbatim record sits behind a collapsed disclosure
 * in every case (owner ruling 2, spec 06 §7 L5 — the same cleanliness
 * definition walk/lib/read-model.mjs asserts).
 *
 * A reader NEVER mutates and NEVER re-reads: it renders exactly the payload
 * that was handed over, defensively — a field the owner did not carry is a
 * field this view does not invent.
 */
import type {ReactNode} from "react";
import {formatRelativeTime} from "../../shared/relativeTime";
import type {PanelInspectDetail} from "./panelInspect";

const text=(value:unknown):string|undefined=>typeof value==="string"&&value.trim()?value:undefined;
const number=(value:unknown):number|undefined=>typeof value==="number"&&Number.isFinite(value)?value:undefined;

/** One readable fact row. Absent fields render nothing — never a dash that
 * pretends the owner said something. */
function Fact({label,children}:{label:string;children:ReactNode}) {
  if(children===undefined||children===null||children==="")return null;
  return <><dt>{label}</dt><dd>{children}</dd></>;
}

/** Multi-line text as prose (whitespace kept, never a `<pre>` — the primary
 * view stays readable per L5; verbatim records live behind the disclosure). */
function Prose({children}:{children:ReactNode}) {
  return <div className="agent-inspect-read">{children}</div>;
}

/** A payload rendered as readable rows: the scalars a person can read.
 * Nested structures are summarised by their JSON size, not dumped. */
function ReadableRows({payload}:{payload:Record<string,unknown>}) {
  const entries=Object.entries(payload).filter(([,value])=>typeof value==="string"||typeof value==="number"||typeof value==="boolean");
  if(!entries.length)return <p className="oi-note">This record carries no readable fields.</p>;
  return <dl className="oi-kv">
    {entries.map(([key,value])=><Fact key={key} label={key.replace(/_/g," ")}>{String(value)}</Fact>)}
  </dl>;
}

const record=(value:unknown):Record<string,unknown>|undefined=>!!value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:undefined;

export interface InspectReader {
  /** The readable name of this kind of material. */
  label:string;
  /** The readable primary view. The raw record is appended uniformly by the
   * plane, so a reader never renders JSON itself. */
  read:(item:PanelInspectDetail)=>ReactNode;
}

const stringBody=(label:string):InspectReader=>({
  label,
  read:item=><Prose>{typeof item.payload==="string"?item.payload:""}</Prose>,
});

/** The registry, keyed by the handed kind. `source-*` kinds are matched by
 * prefix below. */
const READERS:Record<string,InspectReader>={
  "factory-execution":{
    label:"Run execution",
    read:item=>{const payload=record(item.payload);if(!payload)return null;
      return <dl className="oi-kv">
        <Fact label="Execution"><code className="oi-ref">{text(payload.executionRef)}</code></Fact>
        <Fact label="Status">{text(payload.status)}</Fact>
        <Fact label="Agency"><code className="oi-ref">{text(payload.agencyRef)}</code></Fact>
        <Fact label="Harness">{text(payload.harnessRef)}</Fact>
      </dl>;},
  },
  "factory-step":{
    label:"Run step",
    read:item=>{const payload=record(item.payload);if(!payload)return null;
      return <dl className="oi-kv">
        <Fact label="Step">{text(payload.label)}</Fact>
        <Fact label="Lane">{text(payload.lane)}</Fact>
        <Fact label="Status">{text(payload.status)}</Fact>
        <Fact label="Assignee">{text(payload.assignee)}</Fact>
        <Fact label="Blocked by">{text(payload.blockedBy)}</Fact>
        <Fact label="Failed verification">{text(payload.failedVerification)}</Fact>
      </dl>;},
  },
  "factory-candidate":{
    label:"Produced candidate",
    read:item=>{const payload=record(item.payload);if(!payload)return null;
      return <dl className="oi-kv">
        <Fact label="Candidate"><code className="oi-ref">{text(payload.candidateRef)}</code></Fact>
        <Fact label="Status">{text(payload.status)}</Fact>
        <Fact label="Revision">{text(payload.revision)}</Fact>
      </dl>;},
  },
  "fixture-candidate":{
    label:"Candidate (scenario)",
    read:item=>{const payload=record(item.payload);if(!payload)return null;
      return <dl className="oi-kv">
        <Fact label="Candidate"><code className="oi-ref">{text(payload.ref)}</code></Fact>
        <Fact label="Status">{text(payload.status)}</Fact>
        <Fact label="Revision">{text(payload.revision)}</Fact>
        <Fact label="Check">{text(payload.check)}</Fact>
      </dl>;},
  },
  "central-return":{
    label:"Document proposal",
    read:item=>{const payload=record(item.payload);const inner=record(payload?.record);const author=record(inner?.author);const proposal=record(inner?.proposal);if(!payload)return null;
      return <dl className="oi-kv">
        <Fact label="Document">{text(inner?.document_id)}</Fact>
        <Fact label="Status">{text(inner?.status)??text(payload.status)}</Fact>
        <Fact label="Author">{author?[author.actor_kind==="human"?"Human":"Agent",text(author.principal_ref)].filter(Boolean).join(" — "):undefined}</Fact>
        <Fact label="Proposed operation">{text(proposal?.operation)??(proposal?String(proposal):undefined)}</Fact>
        {"html" in (proposal??{})&&<Fact label="Proposed content"><Prose>{String((proposal as {html:unknown}).html)}</Prose></Fact>}
        <Fact label="Basis at arrival">{text(inner?.proposed_source_revision)}</Fact>
      </dl>;},
  },
  "agent-return":{
    label:"Agent arrival",
    read:item=>{const payload=record(item.payload);if(!payload)return null;
      const recorded=number(payload.recorded_at_unix_seconds);
      return <dl className="oi-kv">
        <Fact label="Subject">{text(payload.subject)}</Fact>
        <Fact label="Actor">{text(payload.actor)}</Fact>
        <Fact label="Kind">{text(payload.kind)}</Fact>
        <Fact label="Status">{text(payload.status)}</Fact>
        <Fact label="Recorded">{recorded?formatRelativeTime(recorded*1000):undefined}</Fact>
      </dl>;},
  },
  "now":{
    label:"NOW record",
    read:item=>{const payload=record(item.payload);if(!payload)return null;
      const created=number(payload.created_at_unix_seconds);
      return <dl className="oi-kv">
        <Fact label="Ref"><code className="oi-ref">{text(payload.now_ref)}</code></Fact>
        <Fact label="Task"><code className="oi-ref">{text(payload.task_ref)}</code></Fact>
        <Fact label="Lifecycle">{text(payload.lifecycle)}</Fact>
        <Fact label="Created">{created?formatRelativeTime(created*1000):undefined}</Fact>
      </dl>;},
  },
  "agent-conversation":{
    label:"Conversation",
    read:item=>{const payload=record(item.payload);if(!payload)return null;
      return <dl className="oi-kv">
        <Fact label="Title">{text(payload.title)}</Fact>
        <Fact label="State">{text(payload.state)}</Fact>
      </dl>;},
  },
  "task-basis":{
    label:"Task basis",
    read:item=>{const payload=record(item.payload);const central=record(record(payload?.request)?.central);if(!payload)return null;
      const allocation=record(record(payload?.allocation)?.allocation);
      return <dl className="oi-kv">
        <Fact label="Task"><code className="oi-ref">{text(central?.task_ref)}</code></Fact>
        <Fact label="Purpose">{text(central?.purpose)}</Fact>
        <Fact label="Working directory"><code className="oi-ref">{text(record(payload.request)?.cwd)}</code></Fact>
        <Fact label="Authority"><code className="oi-ref">{text(record(payload.request)?.authority_ref)}</code></Fact>
        <Fact label="Allocated NOW"><code className="oi-ref">{text(allocation?.now_ref)}</code></Fact>
      </dl>;},
  },
  "delivery":{
    label:"Delivery",
    read:item=>{const payload=record(item.payload);const receipt=record(payload?.receipt);if(!payload)return null;
      return <dl className="oi-kv">
        <Fact label="Delivery"><code className="oi-ref">{text(payload.delivery_ref)}</code></Fact>
        <Fact label="Phase">{text(receipt?.phase)}</Fact>
        <Fact label="Duplicate">{payload.duplicate===true?"already held by the owner":undefined}</Fact>
      </dl>;},
  },
  "kernel-receipt":{
    label:"Workspace receipt",
    read:item=>{const payload=record(item.payload);if(!payload)return null;
      return <dl className="oi-kv">
        <Fact label="Event">{text(payload.event)}</Fact>
        <Fact label="Sequence">{number(payload.seq)}</Fact>
        <Fact label="Summary">{text(payload.summary)}</Fact>
      </dl>;},
  },
  "trajectory-block":stringBody("Trajectory block"),
  "operation":stringBody("Provider operation"),
};

/** `source-*` kinds hand a body string with the reference's own text. */
const sourceReader:InspectReader=stringBody("Source reference");

export function inspectReaderOf(kind:string):InspectReader|undefined{
  if(kind.startsWith("source-"))return sourceReader;
  return READERS[kind];
}

/** The fallback for kinds no reader knows: strings read as prose, records
 * render their scalar fields as rows. Nothing here is JSON. */
export function UnknownMaterial({payload}:{payload:unknown}) {
  if(typeof payload==="string")return payload.trim()
    ?<Prose>{payload}</Prose>
    :<p className="oi-note">This selection carried no material of its own.</p>;
  const inner=record(payload);
  if(inner)return <ReadableRows payload={inner}/>;
  if(Array.isArray(payload))return <p className="oi-note">A list of {payload.length} items — open the raw record to read it verbatim.</p>;
  return <p className="oi-note">This selection carried no material of its own.</p>;
}
