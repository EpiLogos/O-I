import type {ReactNode} from "react";
import type {SettingsPlace} from "./settingsNav";
/** The same native-discovered product rows drive both navigation and search. */
export function SettingsProductRows({products,place,onChoose,icon}:{products:{id:string;label:string}[];place:SettingsPlace;onChoose:(place:SettingsPlace)=>void;icon?:ReactNode}) {
 return <>{products.map(product=><li key={product.id}>
  <button type="button" className="settings-nav-row" aria-current={place.kind==="product"&&place.id===product.id?"page":undefined} data-settings-product={product.id} onClick={()=>onChoose({kind:"product",id:product.id})}>
   {icon}<span className="settings-nav-label">{product.label}</span>
  </button>
 </li>)}</>;
}
