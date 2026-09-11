import {useEffect,useState} from "react";
import {DOCUMENT_FORMS,resolveDocumentForm} from "../flow/documentForms";
import {readFile} from "../files/client";
import {useKernel} from "../kernel/KernelProvider";
import type {KernelTransportStatus} from "../kernel/types";
/** The supplied die shell, as the die itself carries its data: one embedded
 * JSON island the shell's own scripts read. The projection swaps ONLY the
 * island's content; the shell bytes stay the owner's received file, read
 * through Central's file route each time the face mounts. */
const QL_DOC_SCRIPT=/<script type="application\/json" id="ql-doc">[\s\S]*?<\/script>/;
/** JSON is embedded inside a <script> element: a literal `</script` inside a
 * string would close the element early, so `<` is escaped the standard way. */
const embed=(payload:unknown)=>JSON.stringify(payload).replace(/</g,"\\u003c");
export function projectDieDocument(shell:string,payload:unknown):string|null{
  const match=shell.match(QL_DOC_SCRIPT);
  if(!match)return null;
  return `${shell.slice(0,match.index)}<script type="application/json" id="ql-doc">${embed(payload)}</script>${shell.slice((match.index??0)+match[0].length)}`;
}
/** The die face of a native Day document (Wave 6E/6F). The native document is
 * the receiving substrate; its template_payload IS the owner's ql-doc format.
 * This face projects that payload through the SUPPLIED die shell — read-only:
 * the owner's document operations remain the only writes, the supplied file
 * remains the portable original, and the face is re-projected from the
 * owner's current bytes on every mount. An unreadable shell or payload is an
 * honest unavailable state — never a fabricated face. */
export function DayDieFace({payload,revision}:{payload:unknown;revision:string}){
  const kernel=useKernel();
  const [face,setFace]=useState<string>();
  const [failure,setFailure]=useState<string>();
  useEffect(()=>{
    let alive=true;
    setFailure(undefined);
    (async()=>{
      try{
        const transport:KernelTransportStatus=kernel.transport;
        const projects=kernel.snapshot.navigator?.root?.work.projects;
        const location=await resolveDocumentForm(transport,DOCUMENT_FORMS[1],projects);
        const shell=await readFile(transport,location);
        const projected=projectDieDocument(shell.content,payload);
        if(!projected){setFailure("The supplied die shell no longer carries its ql-doc data island; the face cannot be projected honestly.");return;}
        if(alive)setFace(projected);
      }catch(reason){if(alive)setFailure(`The die face could not be projected from the supplied shell: ${String(reason)}`);}
    })();
    return()=>{alive=false;};
  },[kernel.transport,kernel.snapshot.navigator?.root,revision]);
  if(failure)return <p className="die-face-unavailable" role="status">{failure}</p>;
  if(face===undefined)return <p className="die-face-loading" role="status" aria-busy="true">Projecting the die face from the supplied shell…</p>;
  return <iframe className="die-face" title="Day die — the document's supplied form, projected from its native payload" sandbox="allow-scripts allow-forms allow-downloads" referrerPolicy="no-referrer" srcDoc={face}/>;
}
