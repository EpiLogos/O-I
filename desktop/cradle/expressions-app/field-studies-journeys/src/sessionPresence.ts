/** The parent's actual frame visibility owns shared last-work continuation.
 * Concealed warm apps retain their own drafts; they cannot choose which work
 * another presented surface resumes. This observes the existing authenticated
 * native epoch/visibility channel without owning or disposing a QL lease.
 */
export function installSessionPresence(){
 const schema='oi.native-expression/v1';let epoch:string|null=null;
 let visible=window.parent===window,written=0,suppressed=0,intervalWritten=0,intervalSuppressed=0;
 let suspended=false,disposed=false,listening=false;
 const listeners=new Set<(visible:boolean)=>void>();
 let observed=!document.hidden&&visible,changes=0;
 const notify=()=>{const next=isVisible();if(next===observed)return;observed=next;changes++;for(const listener of listeners)listener(next);};
 const message=(event:MessageEvent)=>{
  if(disposed||suspended||event.source!==window.parent||event.data?.schema!==schema)return;
  const data=event.data;
  if(data.kind==='available'&&typeof data.epoch==='string'&&data.epoch.length>0&&data.epoch.length<=128){
   if(epoch!==data.epoch)visible=false;epoch=data.epoch;notify();return;
  }
  if(epoch!==null&&data.epoch===epoch&&data.kind==='visibility'&&typeof data.visible==='boolean'){visible=data.visible;notify();}
 };
 const isVisible=()=>!disposed&&!suspended&&!document.hidden&&visible;
 const attach=()=>{if(!listening){window.addEventListener('message',message);listening=true;}};
 const detach=()=>{if(listening){window.removeEventListener('message',message);listening=false;}};
 const announce=()=>{if(window.parent!==window)window.parent.postMessage({schema,kind:'hello'},'*');};
 const pagehide=()=>{suspended=true;visible=false;detach();notify();};
 const pageshow=()=>{if(disposed)return;suspended=false;visible=window.parent===window;attach();announce();notify();};
 const dispose=()=>{disposed=true;visible=false;detach();listeners.clear();window.removeEventListener('pagehide',pagehide);window.removeEventListener('pageshow',pageshow);document.removeEventListener('visibilitychange',notify);};
 attach();announce();
 window.addEventListener('pagehide',pagehide);
 window.addEventListener('pageshow',pageshow);
 document.addEventListener('visibilitychange',notify);
 return {isVisible,subscribe:(listener:(visible:boolean)=>void)=>{listeners.add(listener);return ()=>listeners.delete(listener);},recordWrite:(interval=false)=>{written++;if(interval)intervalWritten++;},recordSuppressed:(interval=false)=>{suppressed++;if(interval)intervalSuppressed++;},
  inspect:()=>({visible:isVisible(),epoch,written,suppressed,intervalWritten,intervalSuppressed,suspended,disposed,changes}),dispose};
}
