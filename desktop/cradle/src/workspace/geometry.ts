import { useLayoutEffect, useRef, type RefObject } from "react";
/** One animation owns panel geometry and its matching chrome masks. A drag
 * writes the same values directly; there is no second CSS width transition.
 *
 * Two hard rules keep that ownership clean:
 *  - while a drag holds the vars (`data-resizing`), a render — the desktop
 *    gets them constantly from live owner state — must NOT write the stale
 *    committed targets back over the pointer's values; the effect yields
 *    until the drag commits;
 *  - renders that carry no geometry change (same targets) neither restart
 *    nor cancel an in-flight animation; only a real target change runs one. */
export function useShellGeometry(
  host: RefObject<HTMLElement>,
  targets: number[],
) {
  const frame = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout>>();
  const initialized = useRef(false);
  const lastKey = useRef<string>();
  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    const key = targets.join("|");
    // Same geometry as the run in flight: leave its animation alone. The
    // cleanup-free contract below means nothing cancels it here.
    if (initialized.current && key === lastKey.current) return;
    lastKey.current = key;
    cancelAnimationFrame(frame.current);
    clearTimeout(settle.current);
    const keys = [
      "--desktop-left-width",
      "--desktop-right-width",
      "--desktop-right-space",
    ];
    const from = keys.map(
      (key, i) =>
        parseFloat(node.style.getPropertyValue(key)) ||
        (!initialized.current ? targets[i] : 0),
    );
    const write = (values: number[]) =>
      keys.forEach((key, i) => node.style.setProperty(key, `${values[i]}px`));
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (node.dataset.resizing) {
      // The drag owns the vars; its pointerup commit lands as a real target
      // change and comes back through here once the flag is gone.
      initialized.current = true;
      return;
    }
    if (!initialized.current || reduced) {
      write(targets);
      initialized.current = true;
      return;
    }
    const duration =
      parseFloat(
        getComputedStyle(node).getPropertyValue("--oi-shell-motion-ms"),
      ) || 220;
    const start = performance.now();
    const tick = () => {
      const progress = Math.max(
          0,
          Math.min(1, (performance.now() - start) / duration),
        ),
        ease = 1 - Math.pow(1 - progress, 3);
      write(targets.map((to, i) => from[i] + (to - from[i]) * ease));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    settle.current = setTimeout(() => {
      cancelAnimationFrame(frame.current);
      write(targets);
    }, duration + 40);
  }, targets);
  useLayoutEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(settle.current);
    },
    [],
  );
  return () => {
    cancelAnimationFrame(frame.current);
    clearTimeout(settle.current);
  };
}
