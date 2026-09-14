import {useEffect,useMemo,useRef,useState} from "react"
import type {RunMapEdge,RunMapNode,RunReading} from "./run-reading"
import {titleCase} from "./run-reading"

/** Read-only Factory RunMap projection. Selection only exposes the exact
 * semantic reference already carried by Factory; it does not create a target. */
export function RunMapReading({reading}:{reading:RunReading}) {
 const nodes=useMemo(()=>Object.values(reading.runMap.nodes),[reading.runMap.nodes])
 const [selectedId,setSelectedId]=useState<string>()
 const previousRunRef=useRef(reading.runRef)
 useEffect(()=>{
  const runChanged=previousRunRef.current!==reading.runRef
  previousRunRef.current=reading.runRef
  setSelectedId(current=>!runChanged&&current&&reading.runMap.nodes[current]?current:nodes[0]?.id)
 },[reading.runRef,reading.runMap.nodes,nodes])
 const selected=nodes.find(node=>node.id===selectedId)??nodes[0]
 const byId=reading.runMap.nodes
 return <section className="factory-run-map" aria-label="Factory Run map">
  <div className="factory-run-map-head"><div><h3>Work map</h3><p>{nodes.length} {nodes.length===1?"node":"nodes"} · {reading.runMap.edges.length} {reading.runMap.edges.length===1?"relation":"relations"}</p></div></div>
  {nodes.length===0?<p className="factory-run-map-empty">Factory did not disclose any Run map nodes.</p>:<div className="factory-run-map-layout">
   <ol className="factory-run-map-nodes" aria-label="Run map nodes">{nodes.map(node=><li key={node.id}><button type="button" className={selected?.id===node.id?"is-selected":""} aria-pressed={selected?.id===node.id} onClick={()=>setSelectedId(node.id)}><span>{node.label}</span><small>{titleCase(node.kind)} · {node.state?titleCase(node.state):"No state disclosed"}</small></button></li>)}</ol>
   {selected&&<NodeDetail node={selected} edges={reading.runMap.edges} nodes={byId}/>}
  </div>}
 </section>
}

function NodeDetail({node,edges,nodes}:{node:RunMapNode;edges:RunMapEdge[];nodes:Record<string,RunMapNode>}) {
 const incoming=edges.filter(edge=>edge.to===node.id)
 const outgoing=edges.filter(edge=>edge.from===node.id)
 return <article className="factory-run-map-detail" aria-label={"Selected node: "+node.label}>
  <p className="factory-run-map-kicker">{titleCase(node.kind)}{node.state?" · "+titleCase(node.state):""}</p>
  <h4>{node.label}</h4>
  {node.semanticRef?<details className="factory-run-map-semantic"><summary>Native semantic reference</summary><code>{node.semanticRef}</code></details>:<p className="factory-run-map-empty">No native semantic reference is disclosed for this node.</p>}
  {(incoming.length>0||outgoing.length>0)&&<div className="factory-run-map-relations">
   {incoming.length>0&&<RelationList title="Incoming" edges={incoming} nodes={nodes} direction="from"/>}
   {outgoing.length>0&&<RelationList title="Outgoing" edges={outgoing} nodes={nodes} direction="to"/>}
  </div>}
 </article>
}

function RelationList({title,edges,nodes,direction}:{title:string;edges:RunMapEdge[];nodes:Record<string,RunMapNode>;direction:"from"|"to"}) {
 return <section><h5>{title}</h5><ul>{edges.map(edge=>{const related=nodes[edge[direction]];return <li key={edge.from+"-"+edge.relation+"-"+edge.to}><span>{related?.label??edge[direction]}</span><small>{titleCase(edge.relation)}</small></li>})}</ul></section>
}
