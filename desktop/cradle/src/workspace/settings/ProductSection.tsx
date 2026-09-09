/**
 * One uniform product section (design §6.1): header with the honest
 * availability chip → disclosure-grade functional summary → Configuration
 * → Activity → Actions → raw record behind disclosure (L5). A section with
 * nothing disclosed renders its emptiness honestly (L3).
 */
import type {ProductSectionModel} from "./types";
import {availabilityLabel} from "./world";

const AVAILABILITY_NOTE:Record<ProductSectionModel["actions"][number]["availability"],string> = {
  native_only:"native",
  missing_native_obligation:"obligation — not disclosed yet",
  unavailable:"unavailable",
};

export function ProductSection({model}:{model:ProductSectionModel}) {
  return <details className="product-section">
    <summary><strong>{model.name}</strong><span>{availabilityLabel(model.availability,model.native_state)}</span></summary>
    <p className="product-about">{model.about}</p>
    {model.configuration.length>0&&<div className="product-block"><h4>Configuration</h4><dl>
      {model.configuration.map(row=><div className="product-row" key={row.title}><dt>{row.title}</dt><dd>{row.value??<em className="product-native-path">set through {row.native_path}</em>}{row.provenance&&<span className="product-provenance"> · {row.provenance}</span>}</dd></div>)}
    </dl></div>}
    {model.activity.length>0&&<div className="product-block"><h4>Activity</h4><dl>
      {model.activity.map(row=><div className="product-row" key={row.title}><dt>{row.title}</dt><dd>{row.error?<em role="alert">{row.error}</em>:row.value}{row.raw!=null&&<details className="product-raw-inline"><summary>record</summary><pre>{JSON.stringify(row.raw,null,2)}</pre></details>}</dd></div>)}
    </dl></div>}
    <div className="product-block"><h4>Actions</h4>
      {model.actions.length===0?<p className="product-empty">No operations disclosed. Nothing is fabricated to fill this space (L3).</p>:<ul className="product-actions">
        {model.actions.map(action=><li key={action.title}><strong>{action.title}</strong><span className={`product-action-availability is-${action.availability}`}>{AVAILABILITY_NOTE[action.availability]}</span>{action.note&&<span className="product-action-note">{action.note}</span>}</li>)}
      </ul>}
    </div>
    {model.version!=null&&<p className="product-version">Version {model.version}</p>}
    <details className="product-raw"><summary>Native installation record</summary><pre>{JSON.stringify(model.raw,null,2)}</pre></details>
  </details>;
}
