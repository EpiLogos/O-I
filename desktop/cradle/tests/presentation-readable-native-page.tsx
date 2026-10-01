import {createRoot} from "react-dom/client";
import {useState} from "react";
import {KernelProvider} from "../src/kernel/KernelProvider";
import {VisualsProvider} from "../src/visuals/ParticleExpression";
import {ExpressionStageProvider} from "../src/stage/ExpressionStage";
import {WorldPresentationView,type WorldPresentation} from "../src/explore/presentation";
import {ExpressionVerso} from "../src/expression/ExpressionVerso";
import type {ExpressionDocument} from "../src/expression/types";
import "@epilogos/oi-design-system/tokens.css";
import "../src/explore/explore.css";

const input=await fetch("/presentation-native/input").then(response=>response.json()) as {presentation:WorldPresentation;document:ExpressionDocument};
function Reading(){
 const [selected,setSelected]=useState<string>();
 return <main>
  <WorldPresentationView presentation={input.presentation} hosting="preview" onOpenRef={setSelected}/>
  <ExpressionVerso document={input.document}/>
  {selected&&<output aria-label="Selected subject target" data-selected-ref={selected}><button onClick={()=>setSelected(undefined)}>Back to shared work</button><details><summary>Exact selection</summary>{selected}</details></output>}
 </main>;
}
createRoot(document.getElementById("root")!).render(<KernelProvider><VisualsProvider><ExpressionStageProvider><Reading/></ExpressionStageProvider></VisualsProvider></KernelProvider>);
