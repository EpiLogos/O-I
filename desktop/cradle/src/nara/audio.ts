/** Executable HTTP cascade adapter for the native local speech route dialect.
 * This is NOT a universal voice provider. The endpoint/model/voice are supplied
 * by the selected native attachment. No keys, provider names or mic autoplay.
 */
import {encodeWav16kMono,resampleTo16k} from "../dictation/wav";
import {abortCheck,localSpeechEndpoint,type CascadeRoutes} from "./nativeDialogue";
export interface CaptureHandle {finish():Promise<Blob>;cancel():void}
export interface SpeechAudio {
  capture(signal:AbortSignal,onLost?:(reason:string)=>void):Promise<CaptureHandle>;
  transcribe(wav:Blob,routes:CascadeRoutes,signal:AbortSignal):Promise<string>;
  synthesize(text:string,routes:CascadeRoutes,signal:AbortSignal):Promise<Blob>;
  play(wav:Blob,signal:AbortSignal,onPlaying:()=>void):Promise<void>;
  stop():void;
}
const MAX_AUDIO_BYTES=32*1024*1024;
async function boundedBody(response:Response):Promise<ArrayBuffer> {
  if(!response.ok)throw new Error(`Speech service answered HTTP ${response.status}`);
  if(Number(response.headers.get("content-length")??0)>MAX_AUDIO_BYTES)throw new Error("Speech response exceeds the audio limit");
  const reader=response.body?.getReader();
  if(!reader)throw new Error("Speech service returned no body");
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;
    if(size>MAX_AUDIO_BYTES)throw new Error("Speech response exceeds the audio limit");chunks.push(value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes.buffer;
}
function request(url:string,init:RequestInit):Promise<Response> {
  return fetch(localSpeechEndpoint(url),{...init,credentials:"omit",redirect:"error",cache:"no-store",referrerPolicy:"no-referrer"});
}
export class BrowserSpeechAudio implements SpeechAudio {
  private captureHandle:CaptureHandle|null=null;
  private stopPlayback:(()=>void)|null=null;
  async capture(signal:AbortSignal,onLost?:(reason:string)=>void):Promise<CaptureHandle> {
    abortCheck(signal);
    if(this.captureHandle)throw new Error("A microphone capture is already active");
    if(!navigator.mediaDevices?.getUserMedia)throw new Error("Microphone capture is unavailable in this host");
    // getUserMedia itself cannot be aborted. A release/denial/navigation while
    // the OS prompt is open retires the request; a late stream is stopped.
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    if(signal.aborted){stream.getTracks().forEach(track=>track.stop());abortCheck(signal);}
    let context:AudioContext|undefined;
    try{context=new AudioContext();await context.resume();}
    catch(error){stream.getTracks().forEach(track=>track.stop());void context?.close().catch(()=>{});throw error;}
    if(signal.aborted){stream.getTracks().forEach(track=>track.stop());await context.close();abortCheck(signal);}
    const chunks:Float32Array[]=[];let samples=0,closed=false,failed=false;
    const activeContext=context;
    let source:MediaStreamAudioSourceNode,processor:ScriptProcessorNode,mute:GainNode;
    try{source=activeContext.createMediaStreamSource(stream);processor=activeContext.createScriptProcessor(4096,1,1);mute=activeContext.createGain();mute.gain.value=0;}
    catch(error){stream.getTracks().forEach(track=>track.stop());void activeContext.close().catch(()=>{});throw error;}
    const cleanup=()=>{
      if(closed)return;closed=true;signal.removeEventListener("abort",cancel);
      processor.onaudioprocess=null;source.disconnect();processor.disconnect();mute.disconnect();
      stream.getTracks().forEach(track=>{track.onended=null;track.stop();});void activeContext.close().catch(()=>{});
      if(this.captureHandle===handle)this.captureHandle=null;
    };
    const cancel=()=>{cleanup();chunks.length=0;};
    const handle:CaptureHandle={
      cancel,
      finish:async()=>{
        if(closed)throw new Error("Microphone capture was cancelled or lost");
        cleanup();abortCheck(signal);
        if(failed)throw new Error("Microphone capture exceeded two minutes or the input device was lost");
        if(!samples)throw new Error("Microphone returned no samples");
        const joined=new Float32Array(samples);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}chunks.length=0;
        return encodeWav16kMono(resampleTo16k(joined,activeContext.sampleRate));
      },
    };
    this.captureHandle=handle;
    for(const track of stream.getAudioTracks())track.onended=()=>{failed=true;cancel();onLost?.("The microphone input device was lost");};
    processor.onaudioprocess=event=>{
      if(closed)return;
      const chunk=new Float32Array(event.inputBuffer.getChannelData(0));samples+=chunk.length;
      if(samples>activeContext.sampleRate*120){failed=true;cancel();onLost?.("Microphone capture exceeded the two-minute limit");return;}chunks.push(chunk);
    };
    try{source.connect(processor);processor.connect(mute);mute.connect(activeContext.destination);signal.addEventListener("abort",cancel,{once:true});abortCheck(signal);}
    catch(error){cleanup();throw error;}
    return handle;
  }
  async transcribe(wav:Blob,routes:CascadeRoutes,signal:AbortSignal):Promise<string> {
    abortCheck(signal);if(wav.size>MAX_AUDIO_BYTES)throw new Error("Recorded audio is too large");
    const form=new FormData();form.append("file",wav,"nara.wav");form.append("response_format","json");form.append("model",routes.stt.model);
    const response=await request(routes.stt.endpoint,{method:"POST",body:form,signal});
    const body=await boundedBody(response);abortCheck(signal);
    const parsed=JSON.parse(new TextDecoder().decode(body)) as {text?:unknown};
    if(typeof parsed.text!=="string"||!parsed.text.trim())throw new Error("Speech service returned no transcript; nothing was sent");
    if(parsed.text.length>16384)throw new Error("Speech transcript exceeds the turn limit");
    return parsed.text;
  }
  async synthesize(text:string,routes:CascadeRoutes,signal:AbortSignal):Promise<Blob> {
    abortCheck(signal);if(!text.trim()||text.length>16384)throw new Error("Response is outside the bounded speech limit; read the retained transcript");
    const response=await request(routes.tts.endpoint,{method:"POST",headers:{"content-type":"application/json"},signal,
      body:JSON.stringify({model:routes.tts.model,input:text,voice:routes.tts.voice,response_format:"wav"})});
    const bytes=await boundedBody(response);abortCheck(signal);
    const header=new TextDecoder().decode(bytes.slice(0,12));
    if(bytes.byteLength<44||header.slice(0,4)!=="RIFF"||header.slice(8,12)!=="WAVE")throw new Error("Speech service did not return WAV audio");
    return new Blob([bytes],{type:"audio/wav"});
  }
  async play(wav:Blob,signal:AbortSignal,onPlaying:()=>void):Promise<void> {
    abortCheck(signal);this.stopPlayback?.();
    const url=URL.createObjectURL(wav),audio=new Audio(url);
    await new Promise<void>((resolve,reject)=>{
      let ended=false;
      const finish=(error?:unknown)=>{if(ended)return;ended=true;audio.pause();audio.removeAttribute("src");audio.load();
        audio.onplaying=null;audio.onended=null;audio.onerror=null;signal.removeEventListener("abort",abort);URL.revokeObjectURL(url);
        if(this.stopPlayback===abort)this.stopPlayback=null;error?reject(error):resolve();};
      const abort=()=>finish(new DOMException("Playback stopped","AbortError"));
      this.stopPlayback=abort;
      audio.onplaying=()=>{if(!signal.aborted&&!ended)onPlaying();};
      audio.onended=()=>finish();audio.onerror=()=>finish(new Error("Audio playback failed"));
      signal.addEventListener("abort",abort,{once:true});
      if(signal.aborted){abort();return;}
      void audio.play().catch(()=>finish(new Error("The host blocked audio playback; the response transcript remains available")));
    });
  }
  stop():void {this.captureHandle?.cancel();this.stopPlayback?.();}
}
