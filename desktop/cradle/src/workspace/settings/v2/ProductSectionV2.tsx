/**
 * One uniform product section of the System surface (design §6.1): header
 * with the honest availability wording → disclosure-grade functional
 * summary → Configuration → Activity → Actions → the raw record behind a
 * single developer disclosure (L5). A section with nothing disclosed
 * renders its emptiness honestly (L3). Provenance travels as the row's
 * tooltip, never as inline copy competing with the value.
 */
import type {ProductSectionModel} from "../types";
import {availabilityWord} from "./vocabulary";

const AVAILABILITY_NOTE:Record<ProductSectionModel["actions"][number]["availability"],string> = {
  native_only:"through the product's own tools",
  missing_native_obligation:"not available here yet",
  unavailable:"unavailable",
};

/** BOOT-06/12 honesty, worded here so the v2 surface never depends on the
 * classic page's raw census strings. */
function availabilityLabel(availability:ProductSectionModel["availability"],nativeState:string):string {
  const word = availabilityWord(nativeState);
  return availability==="discovered" ? `${word} — not checked for readiness yet` : word;
}

export function ProductSection({model}:{model:ProductSectionModel}) {
  return <details className="product-section">
    <summary><strong>{model.name}</strong><span>{availabilityLabel(model.availability,model.native_state)}</span></summary>
    <p className="product-about">{model.about}</p>
    {model.configuration.length>0&&<div className="product-block"><h4>Configuration</h4><dl>
      {model.configuration.map(row=><div className="product-row" key={row.title} title={row.provenance?`Source: ${row.provenance}`:undefined}><dt>{row.title}</dt><dd>{row.value??<em className="product-native-path">changed through {row.native_path}</em>}</dd></div>)}
    </dl></div>}
    {model.activity.length>0&&<div className="product-block"><h4>Activity</h4><dl>
      {model.activity.map(row=><div className="product-row" key={row.title}><dt>{row.title}</dt><dd>{row.error?<em role="alert">{row.error}</em>:row.value}</dd></div>)}
    </dl></div>}
    <div className="product-block"><h4>Actions</h4>
      {model.actions.length===0?<p className="product-empty">No operations here yet.</p>:<ul className="product-actions">
        {model.actions.map(action=><li key={action.title}><strong>{action.title}</strong><span className={`product-action-availability is-${action.availability}`}>{AVAILABILITY_NOTE[action.availability]}</span>{action.note&&<span className="product-action-note">{action.note}</span>}</li>)}
      </ul>}
    </div>
    {model.version!=null&&<p className="product-version">Version {model.version}</p>}
    <details className="product-advanced"><summary>Advanced — the raw record</summary><pre>{JSON.stringify(model.raw,null,2)}</pre></details>
  </details>;
}
