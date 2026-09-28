/**
 * A projected world constituent as its own Being/Thing page
 * (SHARED-FIELD-DESKTOP §0.1): the selected Agent Position, Workcell,
 * practice or activity is the primary material, with its typed relations
 * as the ways onward and its World one step away — not the whole World
 * page standing in for the subject that was chosen.
 */
import type {HostedEntry,HostedRelation} from "../knowledge/shared-field";
// @ts-ignore -- language-neutral reading over the hosted contracts.
import {constituentReading} from "./constituent.mjs";

interface Reading {role:"being"|"thing";kind:string;ref:string;title:string;standing:string;world_ref:string;facts:{label:string;value:string}[];groups:{title:string;items:{ref:string;label:string;kind:string;note?:string}[]}[]}

export function constituentOf(entry:HostedEntry,relations:HostedRelation[],entries:HostedEntry[]):Reading|null {
  return constituentReading(entry,relations,entries) as Reading|null;
}

export function ConstituentEncounter({reading,worldLabel,onOpenRef}:{reading:Reading;worldLabel?:string;onOpenRef:(ref:string)=>void}) {
  return <article className="world-presentation world-constituent" data-constituent-role={reading.role} data-constituent-kind={reading.kind} data-subject-ref={reading.ref}>
    <header className="world-presentation__masthead"><div>
      <div className="world-component__eyebrow">{reading.standing}</div>
      <h1>{reading.title}</h1>
      <button type="button" className="world-constituent__world" onClick={()=>onOpenRef(reading.world_ref)}>in {worldLabel??reading.world_ref}</button>
    </div></header>
    <section className="world-region"><div className="world-region__components">
      <article className="world-component world-component--text">
        <dl className="world-component__meta">{reading.facts.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
      </article>
      {reading.groups.map(group=><section key={group.title} className="world-component world-component--collection" data-relation-group={group.title}>
        <h3>{group.title}</h3>
        <div className="world-component__collection">{group.items.map(item=><button type="button" key={item.ref} data-ref={item.ref} data-kind={item.kind} onClick={()=>onOpenRef(item.ref)}><strong>{item.label}</strong>{item.note&&<span>{item.note}</span>}</button>)}</div>
      </section>)}
    </div></section>
  </article>;
}
