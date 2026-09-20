import {useEffect,useRef,useState} from "react";
import type {ExpressionDocument} from "../../expression/types";
import type {KernelTransportStatus} from "../../kernel/types";
import {RunExpressionBody} from "./RunExpressionBody";
import {readRunExpressionSnapshot,type RunExpressionSnapshot} from "./run-expression";
import {FactoryRunActionSession,openNativeRunExpression} from "./run-expression-client";

export interface FactoryRunReceiverProps {
  transport:KernelTransportStatus;statePath:string;runRef:string;expressionRef:string;actor:string;project:string|null;
  onOpenRef?:(ref:string)=>void;
  onPresentNative?:(document:ExpressionDocument)=>void;
  /** Actual admission belongs to the native authority/Agency owner. A
   * portable renderer cannot supply this capability in binding.props. */
  admitAction?:(request:{actionRef:string;runRef:string;snapshot:RunExpressionSnapshot})=>Promise<unknown>;
  onActionReceipt?:(runRef:string,receipt:unknown)=>void;
}

/** Factory-specific receiver. Shell placement and Stage hosting stay with
 * their owners. No fixture or alternative Run state/dispatcher exists here. */
export function FactoryRunReceiver(props:FactoryRunReceiverProps){
  const {transport,statePath,runRef,expressionRef,actor,project}=props;
  const [snapshot,setSnapshot]=useState<RunExpressionSnapshot|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const [opening,setOpening]=useState(false);
  const [nativeReady,setNativeReady]=useState(false);
  const [used,setUsed]=useState(false);
  const generation=useRef(0);const active=useRef<FactoryRunActionSession|null>(null);const invoking=useRef(false);
  const load=async()=>{
    const ticket=++generation.current;active.current?.dispose();active.current=null;setNativeReady(false);setUsed(false);setLoading(true);setError(null);
    try{const value=await readRunExpressionSnapshot(transport,statePath,runRef,expressionRef);if(ticket===generation.current)setSnapshot(value);}
    catch(reason){if(ticket===generation.current){setSnapshot(null);setError(reason instanceof Error?reason.message:String(reason));}}
    finally{if(ticket===generation.current)setLoading(false);}
  };
  useEffect(()=>{setSnapshot(null);void load();return ()=>{generation.current++;active.current?.dispose();active.current=null;};},[transport,statePath,runRef,expressionRef,actor,project]);
  const open=async()=>{
    if(!snapshot||loading||opening)return;
    const ticket=generation.current;setOpening(true);setError(null);
    try{
      const document=await openNativeRunExpression(transport,snapshot,actor);
      if(ticket!==generation.current)return;
      active.current?.dispose();active.current=new FactoryRunActionSession(transport,snapshot,document,project);setNativeReady(true);setUsed(false);
      props.onPresentNative?.(document);
    }catch(reason){if(ticket===generation.current)setError(reason instanceof Error?reason.message:String(reason));}
    finally{setOpening(false);}
  };
  const invoke=async(actionRef:string)=>{
    const session=active.current;const admitted=props.admitAction;
    if(!session||!snapshot||!admitted||invoking.current||used||loading)throw new Error("Native Run admission is unavailable or requires refresh");
    const ticket=generation.current;invoking.current=true;
    try{
      const input=await admitted({actionRef,runRef,snapshot});
      if(ticket!==generation.current)throw new Error("Run changed while native admission was being resolved");
      setUsed(true);
      try{const result=await session.invoke(actionRef,input);props.onActionReceipt?.(runRef,result);return result;}
      catch(reason){props.onActionReceipt?.(runRef,{error:reason instanceof Error?reason.message:String(reason),receipt:(reason as {receipt?:unknown})?.receipt});throw reason;}
    }finally{invoking.current=false;}
  };
  const unavailable=loading?"Refreshing native owner readings.":!nativeReady?"Open and verify the native Expression before requesting an Action.":!props.admitAction?"The native authority/Agency admission handler is not connected.":used?"Refresh owner readings and reopen the native presentation before another Action.":undefined;
  return <section data-factory-run-receiver={runRef} aria-busy={loading||opening}>
    <header><button type="button" disabled={loading||opening||invoking.current} onClick={()=>void load()}>Refresh native Run</button>
      <button type="button" disabled={!snapshot||loading||opening||invoking.current} onClick={()=>void open()}>Open in native Expression</button>
      {nativeReady&&<span data-native-expression-ready={expressionRef}>Native Expression readback verified</span>}
    </header>
    {error&&<p role="alert">{error}</p>}
    {snapshot&&snapshot.run.runRef===runRef&&<RunExpressionBody
      binding={{binding_ref:`${expressionRef}:factory-body`,component_ref:"oi.presentation/factory-run/v1",subject_ref:runRef,props:{...snapshot},fallback:{},provenance:[]}}
      presentationRef={expressionRef} hosting="stage" onOpenRef={props.onOpenRef}
      onNativeAction={nativeReady&&props.admitAction?invoke:undefined} actionsUnavailable={unavailable}/>}
    {!snapshot&&!error&&<p>Reading the native Factory Run…</p>}
  </section>;
}
