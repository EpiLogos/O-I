import {Glyph,type GlyphName} from "../workspace/Glyph";

/** The panel's Active Context: the actually active processes of the panel's
 * own pane — terminal processes, browsers, files, wiki/graph — as genuine
 * lanes with icons, one selectable row each. The pane canvas above is
 * height-bounded; this component is where the tabs the composition root
 * manages behind the scenes show and are focused. Persistent: it reads the
 * layout's own side pane, so its contents survive restarts. The mode tree's
 * hidden tabs surface here too (owner ruling 2026-09-19), marked as
 * workspace-held — visible state, managed by the agent while the mode's
 * dedicated stage stands. */
export interface ActiveContextTab { id: string; title: string; kind: string; active: boolean; canvas?: "panel"|"workspace" }

const LANES:{label:string;icon:GlyphName;kinds:string[]}[]=[
  {label:"Terminals",icon:"terminal",kinds:["terminal"]},
  {label:"Browsers",icon:"external",kinds:["browser"]},
  {label:"Files",icon:"file",kinds:["file","source","draft","flow","blank"]},
  {label:"Wiki & graph",icon:"wiki",kinds:["knowledge","wiki","explore","presentation"]},
];

export function ActiveContext({tabs,onActivate}:{tabs?:ActiveContextTab[];onActivate?:(id:string)=>void}) {
  const lanes=LANES
    .map(lane=>({...lane,rows:(tabs??[]).filter(tab=>lane.kinds.includes(tab.kind))}))
    .filter(lane=>lane.rows.length>0);
  return <div className="ta-active-context" data-populated={lanes.length>0||undefined}>
    {lanes.map(lane=><section key={lane.label} className="oi-side-section" aria-label={lane.label}>
      <h4><Glyph name={lane.icon} size={12}/>{lane.label}</h4>
      <ul className="oi-side-rows">
        {lane.rows.map(tab=><li key={tab.id}>
          <button className="oi-side-row" data-active={tab.active||undefined} data-canvas={tab.canvas} title={tab.canvas==="workspace"?"Held in the workspace's own panes — the mode stands full-page over them; the agent manages these.":undefined} onClick={()=>onActivate?.(tab.id)}>
            <span className="oi-side-row-title">{tab.title}</span>
            {tab.canvas==="workspace"&&<span className="oi-side-step-meta">workspace</span>}
          </button>
        </li>)}
      </ul>
    </section>)}
  </div>;
}
