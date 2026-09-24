/**
 * HumanAgentCard — the compact human card for one Agent in one World
 * (`oi.human-agent-card/v1`, derived by `oi agent card`). Each field reads
 * in one plain line and expands progressively to the exact native refs and
 * revisions it was derived from. Nothing here edits or stores the card; it
 * is a view over O:I's composed reading, which the owners hold.
 *
 * Law carried from the contract: "How I orient" is omitted when no
 * Methodology is carried; citizenship is a vector, shown per dimension, and
 * an unavailable dimension stays visible as unavailable (with the failing
 * command) — never hidden, never scored.
 */
import {useEffect, useState, type ReactNode} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {citizenshipRows, readAgentCard, type CardField, type HumanAgentCard as Card} from "./agentCardReading";

function Refs({refs, label}: {refs?: string[] | null; label: string}) {
  if (!refs || refs.length === 0) return null;
  return <details className="oi-disclosure agent-card-refs">
    <summary>{label}</summary>
    <ul className="agent-card-ref-list">{refs.map((ref) => <li key={ref}><code className="oi-ref">{ref}</code></li>)}</ul>
  </details>;
}

function Field({title, field, children}: {title: string; field: CardField; children?: ReactNode}) {
  const unavailable = field.state === "unavailable";
  return <section className="agent-card-field" aria-label={title} data-unavailable={unavailable ? "true" : undefined}>
    <h4 className="agent-card-label">{title}{unavailable && <span className="oi-state"> Unavailable</span>}</h4>
    {field.text && <p className="oi-note">{field.text}</p>}
    {unavailable && field.command && <p className="agent-card-command">Failing command: <code>{field.command}</code></p>}
    {children}
    <Refs refs={field.refs} label="Exact refs"/>
  </section>;
}

export function HumanAgentCard({card}: {card: Card}) {
  const {identity} = card;
  return <article className="agent-card" aria-label={`Agent card — ${identity.name}`}>
    <header className="agent-card-head">
      <h3 className="agency-detail-title">{identity.name}</h3>
      <div className="oi-ref-row">
        <span className="oi-ref">{identity.agent_ref}</span>
        <span className="oi-state">{identity.profile_ref}@{identity.revision}</span>
      </div>
    </header>

    <Field title="Why I'm here" field={card.why_im_here}>
      {card.why_im_here.intent_expression && card.why_im_here.intent_expression !== card.why_im_here.text &&
        <details className="oi-disclosure"><summary>Original intent, as expressed</summary><p className="agent-card-intent">{card.why_im_here.intent_expression}</p></details>}
    </Field>
    <Field title="What I can do" field={card.what_i_can_do}/>
    <Field title="How I work" field={card.how_i_work}/>
    {card.how_i_orient && <Field title="How I orient" field={card.how_i_orient}/>}
    <Field title="What I carry" field={card.what_i_carry}/>
    <Field title="Where I participate" field={card.where_i_participate}>
      {card.where_i_participate.other_worlds && card.where_i_participate.other_worlds.length > 0 &&
        <p className="agency-dim">Also a separate reading in {card.where_i_participate.other_worlds.join(", ")}.</p>}
    </Field>

    <section className="agent-card-field" aria-label="Citizenship">
      <h4 className="agent-card-label">Citizenship</h4>
      <p className="oi-note">{card.citizenship.summary}</p>
      <details className="oi-disclosure">
        <summary>Each dimension</summary>
        <ul className="agent-card-dimensions">
          {citizenshipRows(card).map(({name, dimension}) =>
            <li key={name} className="agent-card-dimension" data-state={dimension.state}>
              <span className="agent-card-dimension-name">{name}</span>
              <span className="oi-state">{dimension.state}</span>
              {dimension.reading && <span className="agent-card-dimension-reading">{dimension.reading}</span>}
              {dimension.state === "unavailable" && dimension.command && <code className="agent-card-command">{dimension.command}</code>}
              <Refs refs={dimension.basis} label="Basis"/>
            </li>)}
        </ul>
      </details>
    </section>

    <Field title="Currently" field={card.currently}/>

    {card.public && <section className="agent-card-field" aria-label="Public disclosure">
      <h4 className="agent-card-label">Publicly disclosed</h4>
      {card.public.capabilities.length > 0
        ? <ul className="agent-card-ref-list">{card.public.capabilities.map((c) => <li key={c.id}>{c.name} <code className="oi-ref">{c.id}</code></li>)}</ul>
        : <p className="oi-note">Nothing is publicly disclosed ({card.public.basis}). Carried repertoire stays internal.</p>}
    </section>}
  </article>;
}

/** Loads the card from the kernel for one Agent (and optionally one World). */
export function LiveHumanAgentCard({agentRef, worldRef}: {agentRef: string; worldRef?: string | null}) {
  const kernel = useKernel();
  const [card, setCard] = useState<Card>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let live = true;
    setCard(undefined); setError(undefined);
    readAgentCard(kernel.transport, agentRef, worldRef).then((value) => { if (live) setCard(value); }, (e) => { if (live) setError(String(e instanceof Error ? e.message : e)); });
    return () => { live = false; };
  }, [kernel.transport, agentRef, worldRef]);
  if (error) return <p className="oi-refusal" role="status">The Agent card could not be derived: {error}</p>;
  if (!card) return <p className="oi-note" aria-busy="true">Deriving the Agent card from its native owners…</p>;
  return <HumanAgentCard card={card}/>;
}
