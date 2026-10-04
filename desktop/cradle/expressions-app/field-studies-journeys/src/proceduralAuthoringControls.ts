/** Read-only fence over the existing mounted authoring controls. Captured DOM
 * identity and values are local editor intent, never native Source authority. */
type AuthoredControl=HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
export function captureAuthoredControls(roots:readonly HTMLElement[]):()=>boolean {
 const controls=()=>roots.flatMap(root=>[...root.querySelectorAll<AuthoredControl>('input,select,textarea')]);
 const original=controls().map(node=>({node,value:node.value,checked:node.tagName==='INPUT'?(node as HTMLInputElement).checked:null,connected:node.isConnected}));
 return ()=>{const current=controls();return current.length===original.length&&original.every((row,index)=>current[index]===row.node&&row.node.isConnected===row.connected&&row.node.value===row.value&&(row.node.tagName!=='INPUT'||(row.node as HTMLInputElement).checked===row.checked));};
}
