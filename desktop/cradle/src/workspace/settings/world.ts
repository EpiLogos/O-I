/**
 * The settings world projection (design §3, §4.5).
 *
 * P1 composes each product's section from the live reads the kernel already
 * serves (composition census + project agency/providers). Every row names
 * its provenance; rows the seam cannot read yet render their native path
 * instead of a fabricated value (law L3/L4). Static content — the
 * disclosure-grade functional summaries — is the only authored prose here,
 * and it is marked as cradle-composed provenance like the rest.
 */
import type {ActivityExtras, CompositionReading, ProductSectionModel, SettingRow} from "./types";
import {availabilityWord} from "./vocabulary";


interface WorldPosition {
  product_id:string;
  about:string;
}

/** Disclosure-grade functional summaries (design §3). What each product
 * does in this world — never marketing copy. */
const WORLD_POSITIONS:WorldPosition[] = [
  {product_id:"oi",about:"The composition layer itself: installs, verifies, and doctors the suite; pins the manifest; updates and cleans the managed root. The world-keeper."},
  {product_id:"central",about:"The personal ground: ctrl Actions (NOW returns, rollover, promote, search, work lists, doctor), wiki returns through the promotion path, day-close law."},
  {product_id:"ai-kit",about:"The resolution and composition layer: sources → skills → sets → profiles → session topology → compose. Owns no model, harness, or session tool — resolves them."},
  {product_id:"software-factory",about:"Builds and trajectories: project bindings, intents and invocations, sessions and traces. Projected live as the Factory contribution surface."},
  {product_id:"workcell",about:"Demand and placement: the affordance demand contract, lifecycle plan → prepare → observe → collect → release, and the instances registry."},
  {product_id:"actuation",about:"Agency: actor bootstrap, instantiation receipts, and ecology. No operation is exposed to the desktop yet — the obligations below are the honest inventory."},
  {product_id:"quaternal-logic",about:"The field: QL coordinates, positions, and lenses — the symbolic register of the world. Census-only until QL discloses a seam."},
];

const NATIVE_NAME:Record<string,string> = {
  "oi":"O:I — composition",
  "central":"Central",
  "ai-kit":"AIKit",
  "software-factory":"Software Factory",
  "workcell":"Workcell",
  "actuation":"Actuation",
  "quaternal-logic":"Quaternal Logic",
};

function censusRow(reading:CompositionReading|undefined,productId:string) {
  return reading?.positions.find(position=>position.product_id===productId);
}

/** The Context Frame reading (`oi.current-world/v2`, #268). A v1 census is
 * an older installed `oi`: accepted as historical evidence, its frame facts
 * disclose as unavailable rather than being reinterpreted here. */
interface CensusDocument {schema?:string; context_frame?:{containing_frame?:string; install_mode?:string|null; present_positions?:number[]}}

function census(reading:CompositionReading|undefined):CensusDocument|undefined {
  return reading?.current_world.data as CensusDocument|undefined;
}

/** Provenance names the schema actually read, not the one we hope for. */
function censusProvenance(reading:CompositionReading|undefined):string {
  const schema = census(reading)?.schema;
  return typeof schema==="string" ? schema : "oi.current-world";
}

/** Where each install mode sits (mirror of `cli/src/context_frames.rs` —
 * the CLI catalogue is canonical). The frame notation is the mode id. */
const MODE_NAMES:Record<string,string> = {
  "00/00":"Desktop / integrated encounter",
  "0/1":"Central + Actuation",
  "0/1/2":"Central + Actuation + AIKit",
  "0/1/2/3":"Central + Actuation + AIKit + Software Factory",
  "4.5/0":"Central + minimal Workcell client/connectivity",
  "5/0":"Central + Quaternal Logic",
};

/** The world-constitution fact for the System header: the containing frame
 * and the install mode it organises here — honest about explicit
 * selections the catalogue does not name (never forced into a mode). */
export function frameFact(reading:CompositionReading|undefined):string {
  const frame = census(reading)?.context_frame;
  if(!frame||typeof frame.containing_frame!=="string") return "Not disclosed";
  const mode = typeof frame.install_mode==="string" ? frame.install_mode : null;
  return mode ? `${frame.containing_frame} · ${mode}` : `${frame.containing_frame} · explicit selection`;
}

function versionOf(row:ReturnType<typeof censusRow>):string|undefined {
  const version = row?.current_world.version;
  return typeof version==="string" ? version : undefined;
}

/** Build the seven uniform product sections over the live readings. */
export function buildSections(reading:CompositionReading|undefined,extras:ActivityExtras):ProductSectionModel[] {
  const project = extras.project;
  const openProject:SettingRow = {title:"Open project",value:project??"None currently open",provenance:"kernel navigator snapshot"};
  return WORLD_POSITIONS.map(position=>{
    const row = censusRow(reading,position.product_id);
    const availability = row?.availability??"missing";
    const nativeState = row?.native_state??"not disclosed";
    const version = versionOf(row);
    const configuration:SettingRow[] = [];
    const activity:ProductSectionModel["activity"] = [];
    const actions:ProductSectionModel["actions"] = [];
    if(position.product_id==="oi") {
      const frame = reading ? census(reading)?.context_frame : undefined;
      const mode = typeof frame?.install_mode==="string" ? frame.install_mode : null;
      const modeValue = !reading
        ? "Not yet read"
        : frame===undefined
          ? "Not disclosed (census predates v2)"
          : mode
            ? `${mode} — ${MODE_NAMES[mode]??"install mode"}`
            : `explicit selection${frame.present_positions?.length?` (present: ${frame.present_positions.join(",")})`:""}`;
      configuration.push(
        {title:"Suite executable",value:reading?String(reading.suite_executable):"Not yet read",provenance:"composition_read"},
        {title:"Containing frame",value:reading?(typeof frame?.containing_frame==="string"?`${frame.containing_frame} (4.0/1–4.4/5) — always applies`:"Not disclosed"):"Not yet read",provenance:censusProvenance(reading)},
        {title:"Install mode",value:modeValue,provenance:censusProvenance(reading)},
        {title:"Product pins",value:reading?`${reading.positions.length} pinned revisions`:"Not yet read",provenance:censusProvenance(reading)},
      );
      actions.push(
        {title:"install / verify / doctor",availability:"native_only",note:"oi CLI"},
        {title:"update / cleanup",availability:"native_only",note:"oi update · oi cleanup --managed"},
      );
    }
    if(position.product_id==="central") {
      configuration.push(openProject,{title:"Ground binding",native_path:"Config view — Central location"});
      actions.push(
        {title:"Doctor",availability:"native_only",note:"oi ctrl doctor --json"},
        {title:"Day close",availability:"native_only",note:"projectcentral.now.rollover (project) · central.day.lifecycle (root)"},
      );
    }
    if(position.product_id==="ai-kit") {
      configuration.push(
        {title:"Executable bound",value:row?availabilityWord(nativeState):"Not yet read",provenance:"the installed-suite census"},
        ...(version?[{title:"Version",value:version,provenance:censusProvenance(reading)} satisfies SettingRow]:[]),
      );
      if(project) {
        activity.push(extras.spaces
          ? {title:`SessionSpaces (${project})`,value:`${extras.spaces.count} disclosed for ${extras.spaces.project_ref}`,raw:extras.spaces.raw}
          : {title:`SessionSpaces (${project})`,value:extras.spacesError?"" :"Reading…",error:extras.spacesError,raw:extras.spacesError});
        activity.push(extras.providers
          ? {title:`Providers (${project})`,value:`${extras.providers.count} provider(s) disclosed`,raw:extras.providers.raw}
          : {title:`Providers (${project})`,value:extras.providersError?"":"Reading…",error:extras.providersError});
      } else {
        activity.push({title:"Session topology",value:"No project is currently open"});
      }
      actions.push(
        {title:"Session up / attach / down",availability:"missing_native_obligation",note:"named by the native gateway; not yet disclosed as desktop operations"},
      );
    }
    if(position.product_id==="software-factory") {
      if(version) configuration.push({title:"Version",value:version,provenance:censusProvenance(reading)});
      actions.push({title:"Intent / invoke",availability:"native_only",note:"via the Factory CLI"});
    }
    if(position.product_id==="workcell") {
      if(version) configuration.push({title:"Version",value:version,provenance:censusProvenance(reading)});
      actions.push(
        {title:"Lifecycle plan → release",availability:"native_only",note:"via the Workcell CLI"},
        {title:"Material read",availability:"native_only",note:"kernel material_read — projected through the owner seam"},
      );
    }
    if(position.product_id==="actuation") {
      actions.push(
        {title:"Ecology read",availability:"missing_native_obligation"},
        {title:"Attach",availability:"missing_native_obligation"},
        {title:"Stream cursor / replay",availability:"missing_native_obligation"},
      );
    }
    return {
      product_id:position.product_id,
      name:typeof row?.current_world.public_name==="string"?row.current_world.public_name:NATIVE_NAME[position.product_id],
      about:position.about,
      availability,
      native_state:nativeState,
      version,
      configuration,
      activity,
      actions,
      raw:row?.current_world??{state:"not disclosed"},
    };
  });
}

