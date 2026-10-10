import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {KernelProvider,useKernel} from '../../../desktop/cradle/src/kernel/KernelProvider';
import {VisualsProvider} from '../../../desktop/cradle/src/visuals/ParticleExpression';
import {ExpressionStageProvider} from '../../../desktop/cradle/src/stage/ExpressionStage';
import type {SurfaceBinding} from '../../../desktop/cradle/src/surface/types';
import {knowledge} from '../../../desktop/cradle/src/knowledge/client';
import {InstrumentFrame,createInstrumentPresentation,type InstrumentDefinition} from '../src/frame/InstrumentFrame';
import {PROJECT_GRAPH,JOURNEY,PALACE,MODULATION} from '../src/definitions';
import {GraphEditor} from '../src/graph/GraphEditor';
import {ModulationEditor} from '../src/modulation/ModulationEditor';
import {JourneyEditor} from '../src/journey/JourneyEditor';
import {PalaceEditor} from '../src/palace/PalaceEditor';
import {JourneyPhrase} from '../src/receiving/journeyPhrase';
import type {RetainedGlyphInput} from '../../live-shell/ui/src/components/GlyphSequenceEditor';
import fixture from '../evidence/modulation-native-result.json';
import palaceFixture from '../evidence/native-result.json';
import {nativeWorkbench} from './nativeWorkbench';
const ResearchWorkbench=lazy(()=>import('./ResearchWorkbench').then(module=>({default:module.ResearchWorkbench})));
import './entrance.css';
const requestedBridge=new URLSearchParams(location.search).get('bridge');if(requestedBridge)window.__OI_KERNEL_BRIDGE__=requestedBridge;
type Workbench=Awaited<ReturnType<typeof nativeWorkbench>>;
function Entrance(){const api=useKernel();const [source,setSource]=useState<unknown>();const [kind,setKind]=useState('graph'),[epoch,setEpoch]=useState(0),[work,setWork]=useState<Workbench>(),[palaceWork,setPalaceWork]=useState<Workbench>(),[notice,setNotice]=useState(''),[researchOpened,setResearchOpened]=useState(false);
 useEffect(()=>{if(['canvas','timeline','places'].includes(kind))setResearchOpened(true);},[kind]);
 const graphPresentation=useMemo(()=>createInstrumentPresentation(PROJECT_GRAPH,{ownerRef:'ai-kit',subjectRef:'central:wiki:root',instanceRef:'instrument-editor:development:project',label:'Root knowledge',sourceRef:'central:Control/agents/wiki/wiki.json'}),[]);
 const binding:SurfaceBinding={id:'instrument-editor-development-project',kind:'wiki',title:'Project / Graph',address:{kind:'wiki',value:'central:wiki:root'}};
 useEffect(()=>{let alive=true;const publish=()=>{if(alive)setEpoch(value=>value+1);};void nativeWorkbench(api.transport,fixture.expression_ref,publish,setSource).then(value=>{if(alive)setWork(value);},error=>{if(alive)setNotice(String(error));});void nativeWorkbench(api.transport,palaceFixture.expression_ref,publish,setSource).then(value=>{if(alive)setPalaceWork(value);},error=>{if(alive)setNotice(String(error));});return()=>{alive=false;};},[api.transport]);
 const reading=useMemo(()=>work?.receiver.read(),[work,epoch]);const sceneRef=reading?.basis.scene_ref??fixture.scene_ref;
 const modulation=useMemo(()=>createInstrumentPresentation(MODULATION,{ownerRef:'o-i',subjectRef:fixture.expression_ref,sceneRef:fixture.scene_ref,instanceRef:'instrument-editor:development:modulation',label:'Controlled native modulation source'}),[]);
 const journey=useMemo(()=>createInstrumentPresentation(JOURNEY,{ownerRef:'o-i',subjectRef:fixture.expression_ref,sceneRef:fixture.scene_ref,instanceRef:'instrument-editor:development:journey',label:'Controlled native Journey'}),[]);
 const palace=useMemo(()=>createInstrumentPresentation(PALACE,{ownerRef:'o-i',subjectRef:palaceFixture.expression_ref,instanceRef:'instrument-editor:development:palace',label:'Controlled native Palace'}),[]);
 const drafts=useMemo(()=>new Map<string,RetainedGlyphInput>(),[]);
 return <main><header><h1>Instrument editors</h1><p>Actual native owners · controlled test compositions for native editing · no field engine or native Surface relocation adapter in this entrance</p><p role="status">{api.boot.phase} {api.boot.detail}</p><nav aria-label="Editor packet">{[['graph','Project / Graph'],['canvas','Canvas'],['timeline','Timeline'],['places','Places'],['modulation','Modulation'],['journey','Journey'],['palace','Palace']].map(([id,name])=><button key={id} aria-pressed={kind===id} onClick={()=>setKind(id)}>{name}</button>)}</nav></header>{notice&&<p role="alert">{notice}</p>}
 <div className="editor-workbench">
 {work&&researchOpened&&<Suspense fallback={<p role="status">Opening the native research views…</p>}><ResearchWorkbench work={work} active={kind==='canvas'||kind==='timeline'||kind==='places'?kind:null} epoch={epoch} onSource={setSource}/></Suspense>}
 <div className="editor-slot" hidden={kind!=='graph'}><InstrumentFrame visible={kind==='graph'} definition={PROJECT_GRAPH} presentation={graphPresentation}>{(depth,visible)=><GraphEditor api={api} binding={binding} depth={depth} visible={visible&&kind==='graph'} presentation={graphPresentation} onOpen={async address=>{setSource(await knowledge(api.transport,undefined,{action:'read',address},{fresh:true}));}}/>}</InstrumentFrame></div>
 <div className="editor-slot" hidden={kind!=='modulation'}>{work&&reading?<InstrumentFrame visible={kind==='modulation'} definition={MODULATION} presentation={modulation}>{(depth,visible)=><ModulationEditor host={{reading,edit:work.edit}} laneId="native-source" depth={depth} visible={visible&&kind==='modulation'} presentation={modulation}/>}</InstrumentFrame>:<p>Opening the controlled native modulation work…</p>}</div>
 <div className="editor-slot" hidden={kind!=='journey'}>{work&&reading&&<InstrumentFrame visible={kind==='journey'} definition={JOURNEY} presentation={journey}>{(depth,visible)=><JourneyEditor host={{nativeView:()=>work.work.state?.view,selectScene:ref=>work.selectScene(ref),undo:()=>work.receiver.history('undo'),redo:()=>work.receiver.history('redo'),save:()=>work.receiver.save(),openSource:async ref=>setSource((await work.readExpression(fixture.expression_ref)).scenes.find((scene:any)=>scene.scene_ref===ref)),renderPhrase:(ref,depth)=><JourneyPhrase owner={{reading:()=>reading,request:work.request,drafts}} sceneRef={ref} depth={depth} presentation={journey}/>}} expressionRef={fixture.expression_ref} sceneRef={journey.snapshot().target.sceneRef!} depth={depth} visible={visible&&kind==='journey'} revision={reading.basis.revision} presentation={journey}/>}</InstrumentFrame>}</div>
 <div className="editor-slot" hidden={kind!=='palace'}>{palaceWork&&<InstrumentFrame visible={kind==='palace'} definition={PALACE} presentation={palace}>{(depth,visible)=><PalaceEditor host={palaceWork.palaceHost} expressionRef={palaceFixture.expression_ref} depth={depth} visible={visible&&kind==='palace'} revision={epoch} presentation={palace}/>}</InstrumentFrame>}</div>
 </div>
 {source!==undefined&&<aside><h2>Native source readback</h2><pre>{JSON.stringify(source,null,2)}</pre></aside>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<KernelProvider><VisualsProvider><ExpressionStageProvider><Entrance/></ExpressionStageProvider></VisualsProvider></KernelProvider>);
