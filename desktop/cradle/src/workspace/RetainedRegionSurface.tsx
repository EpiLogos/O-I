import {useLayoutEffect, useRef, useState, type ReactNode} from "react";
import {createPortal} from "react-dom";

/** Move one mounted Surface between existing hosts. The portal target never
 * changes: relocating its container preserves React state, DOM and observers.
 * Only presentation moves; there is no owner read or authority operation here. */
export function RetainedRegionSurface({target, children}: {target?: string; children: ReactNode}) {
  const home = useRef<HTMLDivElement>(null);
  const [relocated, setRelocated] = useState(false);
  const [container] = useState(() => {
    const node = document.createElement("div");
    node.className = "retained-region-surface";
    return node;
  });
  useLayoutEffect(() => {
    const place = () => {
      const destination = (target ? document.querySelector<HTMLElement>(target) : null) ?? home.current;
      if (!destination || container.parentElement === destination) return;
      const focused = container.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
      destination.appendChild(container);
      setRelocated(destination !== home.current);
      // Reparenting may blur a textarea even though its DOM identity survives.
      focused?.focus({preventScroll: true});
    };
    place();
    const observer = new MutationObserver(place);
    observer.observe(document.body, {childList: true, subtree: true});
    return () => observer.disconnect();
  }, [container, target]);
  useLayoutEffect(() => () => container.remove(), [container]);
  return <><div ref={home} className="retained-region-home" hidden={relocated}/>{createPortal(children, container)}</>;
}
