import {registerObjectKind,openObject} from "../agent/objects/registry";
import {DiffPage,type DiffIdentity} from "./DiffPage";
export function openRepositoryDiff(identity:DiffIdentity,project?:string){openObject({kind:"git-diff",ref:JSON.stringify(identity),title:`Changes · ${project??identity.repo_root.split('/').pop()}`,project});}
registerObjectKind({kind:"git-diff",label:"Repository changes",glyph:"file",read:object=>{
 const identity=JSON.parse(object.ref) as DiffIdentity;
 if(typeof identity.repo_root!=="string"||typeof identity.from!=="string"||typeof identity.to!=="string")throw Error("This comparison has no repository and revision basis");
 return {kindLabel:"Repository changes",title:object.title,fields:[],content:<DiffPage identity={identity}/>};
}});
