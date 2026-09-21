/**
 * The "Chat & harnesses" panel of the Settings surface: the real faces a
 * new chat stands on, read through the installed suite.
 *
 *  - the installed harnesses' own status rows (`aikit --json client
 *    status`): detected or not (with the owner's reason when absent),
 *    whether AIKit is installed on them, and their config dirs;
 *  - the resident's configured encounter providers, with the effective
 *    default for NEW chats marked;
 *  - the resolved model catalogue (count + readable list, with a plain
 *    search box over it);
 *  - the default-provider picker for NEW chats. The owner's configuration
 *    plane carries no setting for this — models are "resolved per launch"
 *    there — so the choice is held by the desktop itself (kernel
 *    `chat_defaults.rs`, `oi:cradle:chat.default-provider`) and labelled as
 *    exactly that. The precedence is the kernel's own: owner choice, then
 *    the `pi` row, then the first configured row (`effectiveChatDefault`
 *    mirrors `agency.rs::default_provider_choice` so this face never
 *    promises a different default than the next Send will use).
 *
 * Fixture/dev builds render the labelled fixture world; where no kernel
 * transport exists the panel renders its absence honestly.
 */
import {useEffect,useState} from "react";
import type {CatalogueEntry,HarnessReading,HarnessSource,ProviderRow} from "./harnessSource";
import {effectiveChatDefault} from "./harnessSource";
import {harnessPlaneSource} from "./sourceHost";
import {Loading} from "../shared/Loading";

/** The rule that picked a new chat's default provider, in human words. */
function ruleWords(rule:"owner-choice"|"pi-row"|"first-configured"):string {
  if (rule==="owner-choice")return "your choice below";
  if (rule==="pi-row")return "the “pi” row (the suite's standing default)";
  return "the first configured row";
}

export function ChatHarnessPanel() {
  const [source,setSource]=useState<HarnessSource|null>(null);
  const [reading,setReading]=useState<HarnessReading|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [refreshing,setRefreshing]=useState(false);

  const reload=async(harnessSource:HarnessSource)=>{
    setRefreshing(true);
    try {
      setReading(await harnessSource.read());
    } catch (cause) {
      setError(String(cause));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(()=>{
    let live=true;
    void (async()=>{
      try {
        const harnessSource=await harnessPlaneSource();
        if(!live)return;
        setSource(harnessSource);
        if(harnessSource.kind==="unbound")return;
        await reload(harnessSource);
      } catch (cause) {
        if(live)setError(String(cause));
      }
    })();
    return ()=>{live=false;};
  },[]);

  if(error)return <p role="alert" className="config-error">{error}</p>;
  if(!source||(!reading&&source.kind!=="unbound"))return <Loading label="Reading harnesses and models…"/>;
  if(source.kind==="unbound") {
    return <p className="config-empty" data-harness-unbound>Chat harnesses are not connected in this build: {source.label}. The desktop reads them through the installed suite; without it there is nothing to show — and nothing is faked.</p>;
  }
  const providers=reading?.providers.state==="ok"?reading.providers.rows:[];
  const held=reading?.heldDefault?.value??null;
  const effective=effectiveChatDefault(providers,held);
  return <div className="config-view chat-harness-panel" data-chat-harness-panel data-source={source.kind}>
    <p className="config-source-label" data-harness-source={source.kind}>{source.label}</p>
    {source.kind==="fixture"&&<p className="config-note" role="note">A worked example for development — these harnesses, providers and models are simulated, not this machine's.</p>}

    <DefaultProviderPicker
      providers={providers}
      held={held}
      effective={effective}
      disabled={refreshing}
      defaultStateError={reading?.defaultState.state==="failed"?reading.defaultState.error:null}
      onHold={async(provider)=>{
        try {
          await source.holdDefault(provider);
        } catch (cause) {
          setError(String(cause));
        }
        await reload(source);
      }}
      onDiscard={async()=>{
        try {
          await source.discardDefault();
        } catch (cause) {
          setError(String(cause));
        }
        await reload(source);
      }}
    />

    <ProvidersSection providers={providers} state={reading?.providers} effective={effective}/>
    <HarnessSection state={reading?.harnesses}/>
    <CatalogueSection state={reading?.catalogue}/>
  </div>;
}

/** The default-provider picker for NEW chats. Selecting a row holds it;
 * “default” withdraws the held choice so the owner's rows decide again. */
function DefaultProviderPicker({providers,held,effective,disabled,defaultStateError,onHold,onDiscard}:{
  providers:ProviderRow[];
  held:string|null;
  effective:{provider:string;rule:"owner-choice"|"pi-row"|"first-configured"}|null;
  disabled:boolean;
  defaultStateError:string|null;
  onHold:(provider:string)=>Promise<void>;
  onDiscard:()=>Promise<void>;
}) {
  const [picker,setPicker]=useState<string>(held??"");
  useEffect(()=>{setPicker(held??"");},[held]);
  return <section className="config-section" data-default-provider>
    <h4>Default provider for new chats</h4>
    <p className="config-desc">Which configured provider a NEW conversation opens with. Existing conversations keep their own provider. The choice is held by this desktop ({effective?`right now: ${effective.provider}, via ${ruleWords(effective.rule)}`:"no provider is configured yet"}) — and a choice that no longer names a configured row falls back to the suite default.</p>
    {defaultStateError&&<p role="alert" className="config-error">{defaultStateError}</p>}
    <div className="config-control">
      <select
        className="config-input"
        aria-label="Default provider for new chats"
        data-default-provider-picker
        value={picker}
        disabled={disabled||providers.length===0}
        onChange={(event)=>{
          const next=event.target.value;
          setPicker(next);
          void (next?onHold(next):onDiscard());
        }}
      >
        <option value="">Suite default (pi row, else first configured)</option>
        {providers.map((provider)=><option key={provider.id} value={provider.id}>{provider.label} ({provider.id})</option>)}
      </select>
      {held&&<button type="button" className="config-mini" data-default-provider-discard disabled={disabled}
        onClick={()=>{setPicker("");void onDiscard();}}>Withdraw choice</button>}
      {held&&<span className="config-chip is-active">held: {held}</span>}
    </div>
  </section>;
}

function ProvidersSection({providers,state,effective}:{providers:ProviderRow[];state:HarnessReading["providers"]|undefined;effective:{provider:string;rule:string}|null}) {
  if(!state)return null;
  if(state.state==="failed")return <section className="config-section" data-providers-failed>
    <h4>Encounter providers</h4>
    <p role="alert" className="config-error">{state.error}</p>
  </section>;
  return <section className="config-section" data-providers-ok>
    <h4>Encounter providers</h4>
    {providers.length===0
      ?<p className="config-empty">No ACP provider is configured yet — connect one from a chat's composer.</p>
      :<table className="config-table" data-providers-table>
        <thead><tr><th>Provider</th><th>Id</th><th/></tr></thead>
        <tbody>
          {providers.map((provider)=><tr key={provider.id} data-provider-id={provider.id}>
            <td>{provider.label}</td>
            <td className="config-mono config-ref">{provider.id}</td>
            <td>{effective?.provider===provider.id&&<span className="config-chip is-active" data-is-default>default for new chats</span>}</td>
          </tr>)}
        </tbody>
      </table>}
  </section>;
}

function HarnessSection({state}:{state:HarnessReading["harnesses"]|undefined}) {
  if(!state)return null;
  if(state.state==="failed")return <section className="config-section" data-harnesses-failed>
    <h4>Installed harnesses</h4>
    <p role="alert" className="config-error">{state.error}</p>
  </section>;
  return <section className="config-section" data-harnesses-ok>
    <h4>Installed harnesses</h4>
    <p className="config-desc">The harnesses this machine actually has, as AIKit's own census reads them — detection, whether AIKit is installed on the harness, and where its configuration lives.</p>
    <table className="config-table" data-harness-table>
      <thead><tr><th>Harness</th><th>Client</th><th>Detected</th><th>AIKit</th><th>Config dir</th></tr></thead>
      <tbody>
        {state.rows.map((row)=><tr key={`${row.harness}:${row.client}`} data-harness={row.harness} data-detected={row.detected?"true":"false"}>
          <td className="config-mono">{row.harness}</td>
          <td>{row.client}</td>
          <td>{row.detected?"detected":<span title={row.detection_reason??"not found on this machine"}>not — {row.detection}{row.detection_reason?`: ${row.detection_reason}`:""}</span>}</td>
          <td>{row.installed?"installed":"not installed"}</td>
          <td className="config-mono config-ref">{row.config_dir??"—"}</td>
        </tr>)}
      </tbody>
    </table>
  </section>;
}

/** The catalogue renders count-first; the list answers a plain substring
 * search and caps itself, so 300+ entries stay a readable list. */
const CATALOGUE_CAP=60;

function CatalogueSection({state}:{state:HarnessReading["catalogue"]|undefined}) {
  const [query,setQuery]=useState("");
  if(!state)return null;
  if(state.state==="failed")return <section className="config-section" data-catalogue-failed>
    <h4>Model catalogue</h4>
    <p role="alert" className="config-error">{state.error}</p>
  </section>;
  const {count,entries}=state.rows;
  const needle=query.trim().toLowerCase();
  const matches=needle
    ?entries.filter((entry:CatalogueEntry)=>`${entry.name} ${entry.model}`.toLowerCase().includes(needle))
    :entries;
  const shown=matches.slice(0,CATALOGUE_CAP);
  return <section className="config-section" data-catalogue-ok>
    <h4>Model catalogue</h4>
    <p className="config-desc">{count} model{count===1?"":"s"} resolved across the suite's provider sources. Models are chosen per conversation and per launch — this is what is resolvable, not a default.</p>
    <div className="config-control">
      <input className="config-input" type="search" placeholder={`Search ${count} models…`} aria-label="Search the model catalogue"
        data-catalogue-search value={query} onChange={(event)=>setQuery(event.target.value)}/>
      <span className="config-muted" data-catalogue-count>{needle?`${matches.length} of ${count} match`:`${count} models`}</span>
    </div>
    {matches.length===0
      ?<p className="config-empty">No model name matches.</p>
      :<table className="config-table" data-catalogue-table>
        <thead><tr><th>Model</th><th>Ref</th><th>Source</th></tr></thead>
        <tbody>
          {shown.map((entry)=><tr key={entry.model} data-model={entry.model}>
            <td>{entry.name}</td>
            <td className="config-mono config-ref">{entry.model}</td>
            <td className="config-mono config-ref">{entry.source}</td>
          </tr>)}
        </tbody>
      </table>}
    {matches.length>shown.length&&<p className="config-muted">Showing the first {shown.length} — refine the search to see the rest.</p>}
  </section>;
}
