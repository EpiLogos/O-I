import {useCallback,useEffect,useRef,useState} from "react";
import {DictationSession,type DictationRefusal} from "../../dictation/client";
import {dictationCopy} from "../../dictation/copy";
/** Local microphone capture and native loopback STT, shared with Encounter.
 * Transcription edits the current draft; this hook has no send operation. */
export function voiceDictationAvailable():boolean{return typeof navigator!=="undefined"&&!!navigator.mediaDevices?.getUserMedia&&typeof AudioContext!=="undefined";}
function refusalWords(reason:unknown):string{
 const refusal=reason as DictationRefusal;
 switch(refusal?.kind){case "service-down":return dictationCopy("serviceDown",{url:refusal.endpoint});case "mic-denied":return dictationCopy("micDenied");case "mic-unavailable":return dictationCopy("micUnavailable");case "empty":return dictationCopy("empty");case "failed":return dictationCopy("failed",{detail:refusal.detail});default:return dictationCopy("failed",{detail:String(reason)});}
}
export function useVoiceDictation(onDraft:(text:string)=>void,currentText:()=>string){
 const [listening,setListening]=useState(false),[transcribing,setTranscribing]=useState(false),[error,setError]=useState<string>(),[notice,setNotice]=useState<string>();
 const session=useRef<DictationSession|null>(null),starting=useRef<Promise<string>|null>(null),alive=useRef(true),stopping=useRef(false);
 const text=useRef(currentText);text.current=currentText;const draft=useRef(onDraft);draft.current=onDraft;
 const stop=useCallback(()=>{if(stopping.current)return;stopping.current=true;void(async()=>{
  try{await starting.current;const active=session.current;if(!active||!alive.current)return;setListening(false);setTranscribing(true);setNotice(dictationCopy("transcribing"));
   const outcome=await active.end();if(!alive.current)return;
   if(outcome.kind==="transcript"){const before=text.current();draft.current(`${before}${before&&!/\s$/.test(before)?" ":""}${outcome.text}`);setNotice(dictationCopy("landed"));}else{setError(refusalWords(outcome));setNotice(undefined);}
  }catch(reason){if(alive.current){setError(refusalWords(reason));setNotice(undefined);}}
  finally{session.current=null;starting.current=null;stopping.current=false;if(alive.current){setListening(false);setTranscribing(false);}}
 })();},[]);
 const toggle=useCallback(()=>{
  if(transcribing||stopping.current)return;if(session.current){stop();return;}
  if(!voiceDictationAvailable()){setError(dictationCopy("micUnavailable"));return;}
  setError(undefined);setNotice("Checking local speech…");setListening(true);
  const active=new DictationSession();session.current=active;const pending=active.begin();starting.current=pending;
  void pending.then(()=>{if(alive.current&&!stopping.current)setNotice(dictationCopy("recording"));}).catch(reason=>{if(alive.current){setError(refusalWords(reason));setListening(false);setNotice(undefined);}if(session.current===active)session.current=null;});
 },[transcribing,stop]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;session.current?.cancel();};},[]);
 return {supported:voiceDictationAvailable(),listening,transcribing,error,notice,toggle,stop};
}
