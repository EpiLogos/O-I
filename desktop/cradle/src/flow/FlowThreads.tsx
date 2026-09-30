import type {QlDoc} from "./instance";
import {buildThreads,type ThreadNode} from "./plural";
import {FlowEntryBody} from "./FlowEntryBody";

/** The conversation as its relations give it, independent of arrival order:
 * an entry sits under the entry it answers, branches from or corrects;
 * sibling answers to one question are siblings; a convergence names every
 * entry it draws together and is reachable from each. Other threads stay
 * visible — focus never hides that they exist. */
export function FlowThreads({doc,focusId,onOpenEntry}:{doc:QlDoc;focusId?:string;onOpenEntry:(entryId:string)=>void}){
 const roots=buildThreads(doc);
 const node=(item:ThreadNode):JSX.Element=>
  <FlowEntryBody key={item.entry.id} entry={item.entry} entries={doc.entries} notes={doc.notes} media={doc.media} doc={doc} onOpenEntry={onOpenEntry} focused={focusId===item.entry.id}>
   {item.children.length>0&&<ol className="flow-thread-children" aria-label={`Replies and branches from entry ${doc.entries.indexOf(item.entry)+1}`}>{item.children.map(node)}</ol>}
  </FlowEntryBody>;
 return <ol className="flow-thread flow-thread-tree" aria-label="Document threads">{roots.map(node)}</ol>;
}
