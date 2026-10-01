import type {LibraryItem} from "./scope";
import {subjectLabel} from "../../../../shared-field/presentation-text.mjs";
import "./presentation.css";

const ITEM_NAME: Record<LibraryItem["kind"],string> = {composition:"composition",world:"world","projected-object":"subject",place:"place",page:"page"};
export const libraryItemTitle=(item:LibraryItem,index?:number):string=>subjectLabel(item,`Unnamed ${ITEM_NAME[item.kind]}${index===undefined?"":` ${index+1}`}`);
export const libraryItemOwner=(item:LibraryItem):string=>/^provider[/:]/.test(item.owner)?libraryProviderName(item.provider):subjectLabel(item.owner,item.scope==="shared"?"Shared world":item.project??"Personal world");
export const libraryProviderName=(provider:string,index?:number):string=>({expressions:"Expressions","native-expressions":"Expressions",collections:"Collections","expression-worlds":"Expression worlds","shared-field":"Shared field",wiki:"Wiki"})[provider]??`Library source${index===undefined?"":` ${index+1}`}`;

/** Exact native locators and revisions are depth, never a substitute for a name. */
export function LibraryItemDisclosure({item}:{item:LibraryItem}) {
 return <details className="lib-source-detail"><summary>Source and identity</summary><dl className="oi-kv">
  <dt>Reference</dt><dd>{item.ref}</dd>
  <dt>Owner</dt><dd>{item.ownerRef??item.owner}</dd>
  <dt>Provider</dt><dd>{item.provider}</dd>
  {item.revision&&<><dt>Revision</dt><dd>{item.revision}</dd></>}
  {item.sourceLocation&&<><dt>Source</dt><dd>{item.sourceLocation.path??item.sourceLocation.ref}</dd></>}
  {item.address&&<><dt>Knowledge address</dt><dd>{item.address.kind} · {item.address.value}</dd></>}
  {item.nativeCollections&&<><dt>Native collections</dt><dd>{item.nativeCollections.length?<ul>{item.nativeCollections.map(ref=><li key={ref}>{ref}</li>)}</ul>:"None assigned"}</dd></>}
 </dl></details>;
}
