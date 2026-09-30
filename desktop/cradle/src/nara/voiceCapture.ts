import {encodeWav16kMono, resampleTo16k} from '../dictation/wav';

/** One explicit microphone gesture, held in memory until native transcription.
 * The five-minute bound limits both capture memory and the native IO budget. */
export class VoiceCapture {
  private chunks: Float32Array[] = [];
  private samples = 0;
  private stopped = false;
  private closing: Promise<void> | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private constructor(private stream: MediaStream, private context: AudioContext,
    private source: MediaStreamAudioSourceNode, private processor: ScriptProcessorNode,
    private silent: GainNode, onLimit: (failure?: Error) => void) {
    processor.onaudioprocess = event => {
      if (this.stopped) return;
      const input = event.inputBuffer.getChannelData(0);
      const remaining = context.sampleRate * 300 - this.samples;
      if (remaining > 0) {const chunk = input.slice(0, remaining); this.chunks.push(chunk); this.samples += chunk.length;}
      if (this.samples >= context.sampleRate * 300) {void this.stop().then(()=>onLimit(),failure=>onLimit(failure instanceof Error?failure:new Error(String(failure))));}
    };
    source.connect(processor); processor.connect(silent); silent.connect(context.destination);
    this.timer = setTimeout(() => {if (!this.stopped) {void this.stop().then(()=>onLimit(),failure=>onLimit(failure instanceof Error?failure:new Error(String(failure))));}}, 300_000);
  }
  static async start(onLimit: (failure?: Error) => void): Promise<VoiceCapture> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone capture is unavailable in this application context.');
    const context = new AudioContext();
    let stream: MediaStream | undefined;
    try {
      await context.resume();
      stream = await navigator.mediaDevices.getUserMedia({audio: {channelCount: 1, echoCancellation: true}, video: false});
      const silent = context.createGain(); silent.gain.value = 0;
      return new VoiceCapture(stream, context, context.createMediaStreamSource(stream), context.createScriptProcessor(4096, 1, 1), silent, onLimit);
    } catch (error) {stream?.getTracks().forEach(track => track.stop()); await context.close(); throw error;}
  }
  stop(): Promise<void> {
    if (this.closing) return this.closing;
    this.stopped = true; clearTimeout(this.timer);
    this.processor.onaudioprocess = null;
    const failures: string[] = [];
    for (const stop of [...this.stream.getTracks().map(track=>()=>track.stop()),
      ()=>this.source.disconnect(),()=>this.processor.disconnect(),()=>this.silent.disconnect()]) {
      try {stop();} catch (failure) {failures.push(String(failure));}
    }
    this.closing = (async()=>{
      try {if(this.context.state!=='closed')await this.context.close();}catch(failure){failures.push(String(failure));}
      if(failures.length)throw new Error(`Microphone cleanup was not fully acknowledged: ${failures.join(' ')}`);
    })().finally(()=>{this.closing=undefined;});
    return this.closing;
  }
  async finish(): Promise<ArrayBuffer> {
    await this.stop();
    if (!this.samples) throw new Error('No microphone audio was captured.');
    const all = new Float32Array(this.samples); let offset = 0;
    for (const chunk of this.chunks) {all.set(chunk, offset); offset += chunk.length;}
    this.chunks = [];
    return encodeWav16kMono(resampleTo16k(all, this.context.sampleRate)).arrayBuffer();
  }
  discard(): Promise<void> {const stopped=this.stop(); this.chunks = []; this.samples = 0; return stopped;}
}
