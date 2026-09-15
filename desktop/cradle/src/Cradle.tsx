import {Component, lazy, startTransition, Suspense, useCallback, useEffect, useState, type ReactNode} from "react";
import {KernelProvider} from "./kernel/KernelProvider";
import {VisualsProvider} from "./visuals/ParticleExpression";
import {ExpressionStageProvider} from "./stage/ExpressionStage";
import {ExpressionProvider} from "./shared/Expression";
import {WelcomeField} from "./visuals/WelcomeField";

// The production field gets its first frame before the workspace's heavy
// component graph is requested. Native state/ground reads start immediately
// through KernelProvider; the workspace then composes beneath that same field.
const Frame = lazy(() => import("./CradleFrame").then(module => ({default: module.CradleFrame})));
const DetachedFrame = lazy(() => import("./workspace/DetachedFrame").then(module => ({default: module.DetachedFrame})));

class FrameBoundary extends Component<{children: ReactNode; onSettled:()=>void}, {error: string | null}> {
  state: {error: string | null} = {error: null};
  static getDerivedStateFromError(error: unknown) { return {error: error instanceof Error ? error.message : String(error)}; }
  componentDidCatch() { this.props.onSettled(); }
  render() {
    return this.state.error ? <section role="alert" className="oi-sidecar"><h1>The workspace could not load</h1><p>{this.state.error}</p><button className="oi-action" onClick={()=>window.location.reload()}>Reload workspace</button></section> : this.props.children;
  }
}

function Opening() {
  const detached = !!window.__OI_DETACHED__;
  const [frameStarted, setFrameStarted] = useState(detached);
  const [appReady, setAppReady] = useState(detached);
  const [welcomeUp, setWelcomeUp] = useState(!detached);
  const startFrame = useCallback(() => startTransition(() => setFrameStarted(true)), []);
  const composed = useCallback(() => setAppReady(true), []);
  const entered = useCallback(() => { setWelcomeUp(false); startFrame(); }, [startFrame]);
  useEffect(() => {
    if (welcomeUp || detached) return;
    const target = document.querySelector<HTMLElement>(".pane.focused .cm-content") ?? document.getElementById("root");
    if (target && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target?.focus();
  }, [welcomeUp, detached]);
  return <>
    {welcomeUp && <WelcomeField onFieldReady={startFrame} appReady={appReady} onEntered={entered}/>}
    {frameStarted && <div className="oi-workspace-mount" ref={element=>element?.toggleAttribute("inert", welcomeUp)} aria-hidden={welcomeUp || undefined}><FrameBoundary onSettled={composed}><Suspense fallback={null}>
      {detached ? <DetachedFrame/> : <Frame onComposed={composed}/>}
    </Suspense></FrameBoundary></div>}
  </>;
}

export function Cradle() {
  return <KernelProvider><VisualsProvider><ExpressionStageProvider><ExpressionProvider>
    <Opening/>
  </ExpressionProvider></ExpressionStageProvider></VisualsProvider></KernelProvider>;
}
