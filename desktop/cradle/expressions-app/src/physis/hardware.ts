/** Browser-side hardware signals. The server owns classification and tier logic;
 *  this module only collects honest signals and asks it to resolve `auto`. */

export interface Detection {
  surface: 'studio' | 'ambient';
  cores: number;
  dpr: number;
  screenPx: {width: number; height: number};
  deviceMemoryGiB: number | null;
  rendererString: string;
  memAvailableMiB: number | null;
  psiCpuSomeAvg10: number | null;
  psiMemorySomeAvg10: number | null;
}

interface ServerProbe {cores?: number; memAvailableMiB?: number | null; psiCpuSomeAvg10?: number | null; psiMemorySomeAvg10?: number | null}

/** Real GPU renderer string; empty when WebGL or the debug extension is absent. */
export function gpuRendererString(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return '';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const value = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return value;
  } catch {return '';}
}

export async function collectDetection(surface: Detection['surface']): Promise<Detection> {
  let server: ServerProbe = {};
  try {server = (await (await fetch('/api/hardware')).json())?.server ?? {};} catch {/* offline: browser signals only */}
  const nav = navigator as Navigator & {deviceMemory?: number};
  return {
    surface,
    cores: nav.hardwareConcurrency || 1,
    dpr: window.devicePixelRatio || 1,
    screenPx: {width: screen.width, height: screen.height},
    deviceMemoryGiB: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    rendererString: gpuRendererString(),
    memAvailableMiB: server.memAvailableMiB ?? null,
    psiCpuSomeAvg10: server.psiCpuSomeAvg10 ?? null,
    psiMemorySomeAvg10: server.psiMemorySomeAvg10 ?? null,
  };
}

/** Resolve `auto` once per surface start; the resolution arrives via state/SSE. */
export async function ensureAutoQuality(surface: Detection['surface'] = 'ambient'): Promise<void> {
  try {
    const state = await (await fetch('/api/state')).json();
    if (state.qualityMode !== 'auto' || state.hardware?.resolvedAt) return;
    await fetch('/api/overlay', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Physis-Client': '1'}, body: JSON.stringify({quality: 'auto', detection: await collectDetection(surface)})});
  } catch {/* keep current quality when the service is unavailable */}
}
