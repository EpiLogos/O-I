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

class FrameBoundary extends Component<{children: ReactNode; onSettled:()=>void}, {error: string | null; generation: number}> {
  state: {error: string | null; generation: number} = {error: null, generation: 0};
  // Owner ruling 2026-09-19: a render failure never opens a whole-page
  // error screen. The reason rides the footer message system (the frame's
  // own oi:workspace-message sink), the children get one clean remount, and
  // only a repeated failure falls back to a quiet bottom bar — the message
  // and clicking anywhere reload the workspace.
  static getDerivedStateFromError(error: unknown) { return {error: error instanceof Error ? error.message : String(error)}; }
  componentDidCatch(error: unknown) {
    this.props.onSettled();
    window.dispatchEvent(new CustomEvent("oi:workspace-message", {detail: {message: `The workspace could not load — ${error instanceof Error ? error.message : String(error)}. Click the message to reload.`}}));
  }
  render() {
    if (!this.state.error) return <div key={this.state.generation}>{this.props.children}</div>;
    if (this.state.generation === 0) {
      // one automatic remount: the crashed tree unmounts, a fresh generation
      // composes beneath the standing footer message
      queueMicrotask(() => this.setState({error: null, generation: 1}));
      return null;
    }
    return <div key={this.state.generation} className="oi-frame-fallback" role="alert" onClick={()=>window.location.reload()} title="Reload the workspace">
      <p className="footer-status-message">The workspace could not load twice — click anywhere to reload it.</p>
      <small>{this.state.error}</small>
    </div>;
  }
}

function Opening() {
  const detached = !!window.__OI_DETACHED__;
  const [frameStarted, setFrameStarted] = useState(detached);
  const [appReady, setAppReady] = useState(detached);
  const [welcomeUp, setWelcomeUp] = useState(!detached);
  const startFrame = useCallback(() => startTransition(() => setFrameStarted(true)), []);
  const composed = useCallback(() => setAppReady(true), []);
  const entered = useCallback(() => { document.body.removeAttribute("data-oi-opening"); setWelcomeUp(false); startFrame(); }, [startFrame]);
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
