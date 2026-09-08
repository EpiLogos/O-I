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

/** BOOT-06/12: installed/registered is discovery, never asserted runtime
 * readiness — the owner has not disclosed a readiness op yet. */
export function availabilityLabel(availability:ProductSectionModel["availability"],nativeState:string):string {
  return availability==="discovered" ? `${nativeState} — discovered, not verified ready` : nativeState;
}

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
      configuration.push(
        {title:"Suite executable",value:reading?String(reading.suite_executable):"Not yet read",provenance:"composition_read"},
        {title:"Product pins",value:reading?`${reading.positions.length} pinned revisions`:"Not yet read",provenance:"oi.current-world/v1"},
      );
      actions.push(
        {title:"install / verify / doctor",availability:"native_only",note:"oi CLI — in-page engagement arrives with the disclosed-op seam (P3)"},
        {title:"update / cleanup",availability:"native_only",note:"oi update · oi cleanup --managed"},
      );
    }
    if(position.product_id==="central") {
      configuration.push(openProject,{title:"Ground binding",native_path:"Config view — Central location"});
      actions.push(
        {title:"Doctor",availability:"native_only",note:"oi ctrl doctor --json"},
        {title:"Day close",availability:"native_only",note:"projectcentral.now.rollover (project) · session-strap now.py rollover (root)"},
      );
    }
    if(position.product_id==="ai-kit") {
      configuration.push(
        {title:"Executable bound",value:row?availabilityLabel(availability,nativeState):"Not yet read",provenance:"composition_read"},
        ...(version?[{title:"Version",value:version,provenance:"oi.current-world/v1"} satisfies SettingRow]:[]),
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
      if(version) configuration.push({title:"Version",value:version,provenance:"oi.current-world/v1"});
      actions.push({title:"Intent / invoke",availability:"native_only",note:"factory_discover / intent / invoke kernel ops; settings engagement wires in P3"});
    }
    if(position.product_id==="workcell") {
      if(version) configuration.push({title:"Version",value:version,provenance:"oi.current-world/v1"});
      actions.push(
        {title:"Lifecycle plan → release",availability:"native_only",note:"workcell CLI demand contract; in-page engagement P3"},
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

export const RAIL:{id:"health"|"activity"|"config"|"bootstrap";label:string;hint:string}[] = [
  {id:"health",label:"Health",hint:"Is my world healthy? — census, readiness honesty, obligations"},
  {id:"activity",label:"Activity",hint:"What is running, and where? — SessionSpaces, providers"},
  {id:"config",label:"Config",hint:"What is configured, and by whom? — ground binding, suite pins"},
  {id:"bootstrap",label:"Bootstrap",hint:"Empty world → installed world — bind, install, verify, first-run"},
];
