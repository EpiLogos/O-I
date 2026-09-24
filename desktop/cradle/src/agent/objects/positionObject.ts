/**
 * The Position's page (10-SIDEBARS §4.5, §4.7; WORLD-INHABITATION-V1 §4),
 * shared across every mode that has no Factory Desk — Base, Expressions,
 * Technè. It is the mode-neutral sibling of Factory's enriched
 * `factory-position` page (contributions/factory/desk/factoryObjects.tsx):
 * where Factory adds its own current-work-per-source and run titles, this
 * page shows the joined `aikit whoami` reading alone.
 *
 * Read each time it mounts from AIKit (`inhabitation_read` → `aikit whoami`),
 * with the scope's population reading as the fallback for the row's own words
 * when the joined read is unavailable. Labelled facets first, from their
 * value objects where this view knows their shape; the occupant's (or an
 * eligible) agent profile is a relation to the shared `agent` page; the NOW
 * records are named as refs (Base has no NOW page to link to, so they are not
 * dangling links). Nothing is invented: an absent facet says it is absent.
 *
 * Registered eagerly through ./kinds.tsx, so a Position row opens in every
 * mode, not only after Factory has mounted its own object kinds.
 */
import {registerObjectKind, type ObjectReading, type ObjectRelation} from "./registry";
import {peekPopulation, readWhoami} from "../../contributions/factory/inhabitation/reads";
import {facetNowRef, facetOf, facetWords, occupancyView, positionName, warningWords, workView, WHOAMI_FACETS} from "../../contributions/factory/inhabitation/model";
import {refTail} from "../../contributions/factory/desk/runModel";

const pick = (rows: [string, string | undefined][]) => rows.filter((row): row is [string, string] => !!row[1]).map(([label, value]) => ({label, value}));

interface PositionRecord {label?: string; handle?: string; purpose?: string; profile_ref?: string | null; eligible_agent_refs?: string[]}

registerObjectKind({kind: "position", label: "Position", glyph: "agent", read: async (object, {transport}) => {
  const joined = await readWhoami(transport, object.ref, object.project);
  const held = peekPopulation(object.project)?.read;
  const row = held?.state === "read" ? held.data.positions?.find(position => position.position_ref === object.ref) : undefined;
  if (joined.state === "unavailable") {
    const occupancy = occupancyView(row?.occupancy);
    return {kindLabel: "Position", title: row ? positionName(row) : object.title, state: `Joined reading unavailable — ${joined.reason}`,
      fields: pick([["Handle", row?.handle ?? undefined], ["Role", refTail(row?.role_ref ?? undefined)], ["Occupancy", row ? occupancy.words : undefined],
        ["Current work", row ? workView(row.current_work).words : undefined], ["Joined reading", `unavailable — ${joined.reason} (${joined.source})`]]),
      raw: row} satisfies ObjectReading;
  }
  const reading = joined.data;
  const record = (facetOf(reading, "position")?.value as {record?: PositionRecord} | undefined)?.record;
  const occupantAgent = (facetOf(reading, "occupancy")?.value as {current?: {agent_ref?: string | null}} | undefined)?.current?.agent_ref ?? undefined;
  const eligible = (record?.eligible_agent_refs ?? []).filter((ref): ref is string => typeof ref === "string");
  const profileAgent = occupantAgent ?? eligible[0];
  const warnings = (joined.warnings ?? []).map(warningWords);
  // Base has no shared NOW page; a Position's NOW records are named as refs,
  // not turned into links that would open nothing.
  const nowRelation = (name: string, label: string): ObjectRelation[] => {
    const ref = facetNowRef(facetOf(reading, name));
    return ref ? [{label, text: ref}] : [];
  };
  return {kindLabel: "Position", title: record?.label ?? (row ? positionName(row) : object.title),
    state: facetWords("occupancy", facetOf(reading, "occupancy")),
    fields: [
      ...pick([["Handle", record?.handle ?? row?.handle ?? undefined], ["Purpose", record?.purpose]]),
      ...WHOAMI_FACETS.map(([name, label]) => ({label, value: facetWords(name, facetOf(reading, name))})),
      ...pick([["Profile", record?.profile_ref ? refTail(record.profile_ref) : undefined], ["Eligible agents", eligible.length ? eligible.map(refTail).join(", ") : undefined],
        ["Owner warnings", warnings.length ? warnings.join("; ") : undefined]]),
    ],
    relations: [
      ...nowRelation("root_now", "Root NOW"), ...nowRelation("child_now", "Child NOW"), ...nowRelation("return_destination", "Return destination"),
      ...(profileAgent ? [{label: occupantAgent ? "occupant's agent profile" : "eligible agent profile", object: {kind: "agent", ref: profileAgent, title: refTail(profileAgent) ?? "Agent", ...(object.project ? {project: object.project} : {})}}] : []),
    ],
    raw: reading} satisfies ObjectReading;
}});
