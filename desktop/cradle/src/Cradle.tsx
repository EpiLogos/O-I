import {Component, Fragment, lazy, startTransition, Suspense, useCallback, useEffect, useState, type ReactNode} from "react";
import {KernelProvider} from "./kernel/KernelProvider";
import {VisualsProvider} from "./visuals/ParticleExpression";
import {ExpressionStageProvider} from "./stage/ExpressionStage";
import {ExpressionProvider} from "./shared/Expression";
import {WelcomeField} from "./visuals/WelcomeField";

// The static opening splash paints before the workspace's heavy component
// graph is requested. It does not take the expression stage. Native
// state/ground reads start immediately through KernelProvider; the
// workspace then composes beneath the splash.
const Frame = lazy(() => import("./CradleFrame").then(module => ({default: module.CradleFrame})));
const DetachedFrame = lazy(() => import("./workspace/DetachedFrame").then(module => ({default: module.DetachedFrame})));

class FrameBoundary extends Component<{children: ReactNode; onSettled:()=>void}, {error: string | null; generation: number}> {
  state: {error: string | null; generation: number} = {error: null, generation: 0};
  // Owner ruling 2026-09-19: a render failure never opens a whole-page error
  // screen and never adds UI of its own. The reason rides the footer's
  // workspace-messages route (oi:workspace-message — the frame's own sink);
  // the children get one clean remount (a keyed Fragment, no wrapper div —
  // the shell owns the layout); a repeated failure renders nothing further
  // and leaves the standing footer message as the interface.
  static getDerivedStateFromError(error: unknown) { return {error: error instanceof Error ? error.message : String(error)}; }
  componentDidCatch(error: unknown) {
    this.props.onSettled();
    window.dispatchEvent(new CustomEvent("oi:workspace-message", {detail: {message: `The workspace could not load — ${error instanceof Error ? error.message : String(error)}. Click the message to reload.`}}));
  }
  render() {
    if (this.state.error && this.state.generation === 0) {
      // one automatic remount: the crashed tree unmounts, a fresh generation
      // composes beneath the standing footer message
      queueMicrotask(() => this.setState({error: null, generation: 1}));
      return null;
    }
    if (this.state.error) {
      // The tree failed twice: the footer (inside the tree) may not exist, so
      // its message route can't be reached. One tiny floating glyph in the
      // footer's own corner and vocabulary — nothing else — keeps the reload
      // reachable. The reason stays on its tooltip and in the dispatched
      // footer message whenever the footer is alive to show it.
      return <button type="button" className="oi-tool oi-frame-revive" aria-label="The workspace could not load — reload it" title={`The workspace could not load — ${this.state.error}. Click to reload.`} onClick={() => window.location.reload()}>↻</button>;
    }
    return <Fragment key={this.state.generation}>{this.props.children}</Fragment>;
  }
}

function Opening() {
  const detached = !!window.__OI_DETACHED__;
  const [frameStarted, setFrameStarted] = useState(detached);
  const [appReady, setAppReady] = useState(detached);
  const [welcomeUp, setWelcomeUp] = useState(!detached);
  const startFrame = useCallback(() => startTransition(() => setFrameStarted(true)), []);
  const composed = useCallback(() => setAppReady(true), []);
  // The splash clears the opening ground before it fades. Removing it again
  // here is the final release as the overlay unmounts.
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
