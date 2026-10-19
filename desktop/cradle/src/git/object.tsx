import {lazy,Suspense} from "react";
import {registerObjectKind,openObject} from "../agent/objects/registry";
import type {DiffIdentity} from "./DiffPage";
// The page and its editor (CodeMirror) load when a comparison opens, not with every window that registers the kind.
const DiffPage=lazy(()=>import("./DiffPage").then(module=>({default:module.DiffPage})));
export function openRepositoryDiff(identity:DiffIdentity,project?:string){openObject({kind:"git-diff",ref:JSON.stringify(identity),title:`Changes · ${project??identity.repo_root.split('/').pop()}`,project});}
registerObjectKind({kind:"git-diff",label:"Repository changes",glyph:"file",read:object=>{
 const identity=JSON.parse(object.ref) as DiffIdentity;
 if(typeof identity.repo_root!=="string"||typeof identity.from!=="string"||typeof identity.to!=="string")throw Error("This comparison has no repository and revision basis");
 return {kindLabel:"Repository changes",title:object.title,fields:[],content:<Suspense fallback={null}><DiffPage identity={identity}/></Suspense>};
}});
