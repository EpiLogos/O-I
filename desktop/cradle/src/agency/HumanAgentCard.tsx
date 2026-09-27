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
import {cardCharacterRef, citizenshipRows, readAgentCard, type CardField, type HumanAgentCard as Card} from "./agentCardReading";
import {LiveCharacterPreview} from "./character/CharacterPreview";
import {CharacterEditor} from "./character/CharacterEditor";
import {nativeAgentOwner} from "./nativeAgentClient";
import {setAgentCharacter} from "./nativeAgent";

/** The native standing this card is rendered under. A source record must not
 * render as an active card: each state names itself, and the card never
 * infers a state the caller did not hold from a native reading. */
export type AgentCardStanding = "saved" | "accepted" | "prepared" | "running" | "unavailable" | "unknown";
const STANDING_LABEL: Record<AgentCardStanding, string> = {
  saved: "Saved source — not an accepted Agent",
  accepted: "Accepted — not prepared",
  prepared: "Prepared — no provider started",
  running: "Running",
  unavailable: "Unavailable",
  unknown: "Outcome unknown",
};
/** One host-supplied useful action (edit / use-start / continue …). The card
 * invents no effect; it only renders the host's binding beside the exact
 * native inspect spelling it can always derive. */
export interface AgentCardAction {label: string; run: () => void}

function Refs({refs, label}: {refs?: string[] | null; label: string}) {
	if (!refs || refs.length === 0) return null;
	return <details className="oi-disclosure agent-card-refs">
		<summary>{label}</summary>
		<ul className="agent-card-ref-list">{refs.map((ref) => <li key={ref}><code className="oi-ref">{ref}</code></li>)}</ul>
	</details>;
}

/** Carried vs currently-operative repertoire, from the card's own per-set
 * `resolved` fact: operative here / carried but not resolved here. A set the
 * reading could not resolve stays visible as unresolved — never counted as
 * operative. */
function CarrySplit({field}: {field: CardField & {skill_sets?: {ref: string; resolved: boolean | null; members?: number; withheld?: number}[]}}) {
	const sets = field.skill_sets ?? [];
	if (sets.length === 0) return null;
	const operative = sets.filter((set) => set.resolved === true);
	const carried = sets.filter((set) => set.resolved !== true);
	return <div className="agent-card-carry-split" aria-label="Carried and currently-operative repertoire">
		<p className="oi-note">Operative here: {operative.length === 0 ? "none resolved" : operative.map((set) => set.ref).join(", ")}</p>
		{carried.length > 0 && <p className="oi-note">Carried, not resolved here: {carried.map((set) => `${set.ref} (${set.members ?? 0} members${set.withheld ? `, ${set.withheld} withheld` : ""})`).join("; ")}</p>}
	</div>;
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

/** How the card draws its character; the default reads the material by ref. */
export type CharacterRenderer = (characterRef: string) => ReactNode;
const liveCharacter: CharacterRenderer = (characterRef) => <LiveCharacterPreview characterRef={characterRef} size={72}/>;

export function HumanAgentCard({card, standing, actions, renderCharacter = liveCharacter, characterEditor}: {card: Card; standing?: AgentCardStanding; actions?: AgentCardAction[]; renderCharacter?: CharacterRenderer; characterEditor?: ReactNode}) {
	const {identity} = card;
	const characterRef = cardCharacterRef(card);
	return <article className="agent-card" aria-label={`Agent card — ${identity.name}`} data-agent-standing={standing}>
		<header className="agent-card-head">
			<h3 className="agency-detail-title">{identity.name}</h3>
			<div className="oi-ref-row">
				<span className="oi-ref">{identity.agent_ref}</span>
				<span className="oi-state">{identity.profile_ref}@{identity.revision}</span>
				{standing && <span className="oi-state" data-agent-standing={standing} role="status">{STANDING_LABEL[standing]}</span>}
			</div>
		</header>

    {(characterRef || characterEditor) && <section className="agent-card-field agent-card-character" aria-label="Character">
      <h4 className="agent-card-label">How I appear</h4>
      {characterRef ? renderCharacter(characterRef) : <p className="oi-note">No expressive character yet.</p>}
      {characterRef && <Refs refs={card.character?.refs ?? [characterRef]} label="Exact refs"/>}
      {characterEditor && <details className="oi-disclosure"><summary>{characterRef ? "Change character" : "Give this Agent a character"}</summary>{characterEditor}</details>}
    </section>}

    <Field title="Why I'm here" field={card.why_im_here}>
      {card.why_im_here.intent_expression && card.why_im_here.intent_expression !== card.why_im_here.text &&
        <details className="oi-disclosure"><summary>Original intent, as expressed</summary><p className="agent-card-intent">{card.why_im_here.intent_expression}</p></details>}
    </Field>
	<Field title="What I can do" field={card.what_i_can_do}/>
		<Field title="How I work" field={card.how_i_work}/>
		{card.how_i_orient && <Field title="How I orient" field={card.how_i_orient}/>}
		<Field title="What I carry" field={card.what_i_carry}>
			<CarrySplit field={card.what_i_carry}/>
		</Field>
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

		<section className="agent-card-field" aria-label="Useful next action">
			<h4 className="agent-card-label">Useful next action</h4>
			<p className="oi-note">Inspect the exact native basis: <code>oi agent participation --agent {identity.agent_ref} --json</code></p>
			{actions && actions.length > 0 && <div className="oi-action-group">
				{actions.map((action) => <button key={action.label} type="button" className="oi-action" onClick={action.run}>{action.label}</button>)}
			</div>}
		</section>

    {card.public && <section className="agent-card-field" aria-label="Public disclosure">
      <h4 className="agent-card-label">Publicly disclosed</h4>
      {card.public.capabilities.length > 0
        ? <ul className="agent-card-ref-list">{card.public.capabilities.map((c) => <li key={c.id}>{c.name} <code className="oi-ref">{c.id}</code></li>)}</ul>
        : <p className="oi-note">Nothing is publicly disclosed ({card.public.basis}). Carried repertoire stays internal.</p>}
    </section>}
  </article>;
}

/** Loads the card from the kernel for one Agent (and optionally one World). */
/** The Central register holding the Agent's profile, from the card's home World. */
export function profileProject(card: Pick<Card, "where_i_participate">): string | undefined {
	const home = card.where_i_participate.home_world_ref ?? card.where_i_participate.world_ref;
	return home?.startsWith("project:") ? home.slice("project:".length) : undefined;
}

/** Loads the card from the kernel for one Agent (and optionally one World).
 * `editableCharacter` adds the Character editor for this existing Agent;
 * `onCharacterChanged` lets a host re-read its own view of the source. */
export function LiveHumanAgentCard({agentRef, worldRef, standing, actions, editableCharacter, onCharacterChanged}: {agentRef: string; worldRef?: string | null; standing?: AgentCardStanding; actions?: AgentCardAction[]; editableCharacter?: boolean; onCharacterChanged?: () => void}) {
	const kernel = useKernel();
	const [card, setCard] = useState<Card>();
	const [error, setError] = useState<string>();
	const [generation, setGeneration] = useState(0);
	useEffect(() => {
		let live = true;
		setCard(undefined); setError(undefined);
		readAgentCard(kernel.transport, agentRef, worldRef).then((value) => { if (live) setCard(value); }, (e) => { if (live) setError(String(e instanceof Error ? e.message : e)); });
		return () => { live = false; };
	}, [kernel.transport, agentRef, worldRef, generation]);
	if (error) return <p className="oi-refusal" role="status" data-agent-standing="unavailable">The Agent card could not be derived: {error}</p>;
	if (!card) return <p className="oi-note" aria-busy="true">Deriving the Agent card from its native owners…</p>;
	const editor = editableCharacter ? <CharacterEditor current={cardCharacterRef(card)}
		accepted={card.citizenship.dimensions.recognition?.state === "established"}
		onSave={async (characterRef) => {
			const owner = nativeAgentOwner(kernel.transport, profileProject(card));
			const roster = await owner({action: "roster"}) as {scope_ref?: string};
			if (typeof roster?.scope_ref !== "string") throw new Error("The native Agent register is not readable here.");
			const review = await setAgentCharacter(owner, roster.scope_ref, {profileRef: card.identity.profile_ref, expectedRevision: card.identity.revision, characterRef});
			setGeneration(n => n + 1); onCharacterChanged?.();
			return review.character_change;
		}}/> : undefined;
	return <HumanAgentCard card={card} standing={standing} actions={actions} characterEditor={editor}/>;
}
