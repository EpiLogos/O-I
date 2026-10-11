import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {checkpointAllDocuments,observeDocumentCheckpointMembership} from '../../../../../desktop/cradle/src/document/frame'
import {nativeHost} from './application'

interface CloseRequest {request_id:string;label:string;workspace_id:string|null;binding_id:string|null}
/** Each actual candidate view secures its own registered local source/page
 * copies. Native owner admission and sender identity remain in Rust. */
export function NativeApplicationClose() {
 const [pending,setPending]=useState(false)
 const [error,setError]=useState<string|null>(null)
 const flight=useRef<string|null>(null)
 const reading=useRef(false)
 useEffect(()=>{
  if(!nativeHost())return
  let live=true
  const cleanups:Array<()=>void>=[]
  const root=document.getElementById('root')
  let wasInert=root?.inert??false
  const inertObserver=root?new MutationObserver(()=>{if(flight.current&&root&&!root.inert){wasInert=false;root.inert=true}}):null
  if(root)inertObserver?.observe(root,{attributes:true,attributeFilter:['inert']})
  const unlock=()=>{if(root)root.inert=wasInert;flight.current=null;reading.current=false;if(live)setPending(false)}
  const failed=(cause:unknown)=>{unlock();if(live)setError(cause instanceof Error?cause.message:String(cause))}
  void (async()=>{
   const [{listen},{invoke},{getCurrentWindow}]=await Promise.all([import('@tauri-apps/api/event'),import('@tauri-apps/api/core'),import('@tauri-apps/api/window')])
   const label=getCurrentWindow().label
   const offFailure=await listen<{request_id?:string|null;error:string}>('oi:application-close-failed',event=>{if(event.payload.request_id===flight.current||(!flight.current&&!event.payload.request_id))failed(event.payload.error)})
   if(!live){offFailure();return}cleanups.push(offFailure)
   const offFreeze=await listen<{request_id:string;label:string}>('oi:application-close-freeze',event=>{
    if(!live||event.payload.label!==label)return
    if(!flight.current)wasInert=root?.inert??false
    flight.current=event.payload.request_id;reading.current=false;if(root)root.inert=true;setPending(true);setError(null)
   })
   if(!live){offFreeze();return}cleanups.push(offFreeze)
   cleanups.push(observeDocumentCheckpointMembership(()=>{
    const id=flight.current;if(!live||!id)return
    void invoke('live_shell_checkpoint_reply',{requestId:id,error:'Document recovery membership changed during application close. Retry after the current view settles.'}).catch(cause=>{if(live&&flight.current===id)setError(String(cause))})
   }))
   const offRequest=await listen<CloseRequest>('oi:application-close-checkpoint',event=>{
    const request=event.payload
    if(!live||request.label!==label||typeof request.request_id!=='string'||reading.current||(flight.current!==null&&flight.current!==request.request_id))return
    if(!flight.current)wasInert=root?.inert??false
    flight.current=request.request_id;reading.current=true;if(root)root.inert=true;setPending(true);setError(null)
    void (async()=>{
     let failure:string|null=null
     try {
      if(label!=='main') {
       const owner=await invoke<{workspace_id:string;binding:{id:string}}>('window_binding')
       if(owner.workspace_id!==request.workspace_id||owner.binding.id!==request.binding_id)throw Error('The registered detached subject changed before its local close checkpoint.')
      } else if(request.workspace_id!==null||request.binding_id!==null)throw Error('The main close request has an unexpected detached subject.')
      await checkpointAllDocuments()
     } catch(cause) {failure=cause instanceof Error?cause.message:String(cause)}
     if(!live||flight.current!==request.request_id)return
     try{await invoke('live_shell_checkpoint_reply',{requestId:request.request_id,error:failure})}
     catch(cause){if(live&&flight.current===request.request_id)setError(cause instanceof Error?cause.message:String(cause))}
     // Success remains concealed from further input until the native owner
     // exits, or announces another participant's failure/timeout.
    })()
   })
   if(!live){offRequest();return}cleanups.push(offRequest)
  })().catch(failed)
  return()=>{live=false;inertObserver?.disconnect();for(const cleanup of cleanups)cleanup();unlock()}
 },[])
 const retry=async(restart:boolean)=>{
  setError(null)
  try{const {invoke}=await import('@tauri-apps/api/core');await invoke('live_shell_request_close',{restart})}
  catch(cause){setError(cause instanceof Error?cause.message:String(cause))}
 }
 if(!pending&&!error)return null
 return createPortal(<aside role={error?'alert':'status'} aria-live="assertive" style={{position:'fixed',zIndex:2147483647,inset:pending?0:undefined,bottom:pending?undefined:16,left:pending?undefined:16,right:pending?undefined:16,display:'grid',placeContent:'center',background:pending?'rgba(12,14,18,.94)':'#181b22',color:'#fff',padding:24,border:'1px solid #57606e',gap:12}}>
  {pending?<p>Securing local work before closing… {error}</p>:<><p>O:I stayed open because local work could not be secured. {error}</p><div><button type="button" onClick={()=>void retry(false)}>Retry Quit</button>{!window.__OI_DETACHED__&&<button type="button" onClick={()=>void retry(true)}>Restart after securing work</button>}<button type="button" onClick={()=>setError(null)}>Keep working</button></div></>}
 </aside>,document.body)
}
