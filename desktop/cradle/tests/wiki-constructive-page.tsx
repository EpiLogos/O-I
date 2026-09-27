/** The real Wiki, composer and Stage over the real dev kernel. Only navigation
 * chrome belongs to this test page; no native operation is intercepted. */
import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {KernelProvider} from '../src/kernel/KernelProvider';
import {VisualsProvider} from '../src/visuals/ParticleExpression';
import {ExpressionStageProvider} from '../src/stage/ExpressionStage';
import {KnowledgeSurface} from '../src/knowledge/KnowledgeSurface';
import {ExpressionView} from '../src/expression/ExpressionView';
import {EXPRESSION_COMPOSE_EVENT} from '../src/expression/summon';
import '@epilogos/oi-design-system/tokens.css';
import '@epilogos/oi-design-system/desktop.css';
import '../src/rest.css';
import '../src/cradle.css';
import '../src/knowledge/knowledge.css';
window.__OI_KERNEL_BRIDGE__=new URLSearchParams(location.search).get('bridge')??'';
function App(){
 const [composer,setComposer]=useState<string>();
 useEffect(()=>{const receive=(event:Event)=>setComposer((event as CustomEvent).detail.expressionRef);window.addEventListener(EXPRESSION_COMPOSE_EVENT,receive);return()=>window.removeEventListener(EXPRESSION_COMPOSE_EVENT,receive);},[]);
 return <main style={{height:'96vh',display:'flex',flexDirection:'column',fontFamily:'var(--oi-font-sans)',color:'var(--oi-foreground)',background:'var(--oi-canvas-ground)'}}>
  {composer&&<button className="oi-action" onClick={()=>setComposer(undefined)}>Return to Wiki</button>}
  <div style={{minHeight:0,flex:1,display:composer?'none':'flex'}}><KnowledgeSurface binding={{id:'native-wiki-page',kind:'knowledge',title:'Alpha',project:'Notes',address:{kind:'source',value:'source:a'},view:{knowledgePlane:'page'}}} onOpen={async()=>{throw new Error('This proof follows source navigation inside the production Wiki.');}}/></div>
  {composer&&<div style={{overflow:'auto',flex:1}}><ExpressionView initialExpressionRef={composer}/></div>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<KernelProvider><VisualsProvider><ExpressionStageProvider><App/></ExpressionStageProvider></VisualsProvider></KernelProvider>);
