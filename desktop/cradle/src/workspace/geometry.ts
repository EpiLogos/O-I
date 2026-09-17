import { useLayoutEffect, useRef, type RefObject } from "react";
/** One animation owns panel geometry and its matching chrome masks. A drag
 * writes the same values directly; there is no second CSS width transition. */
export function useShellGeometry(
  host: RefObject<HTMLElement>,
  targets: number[],
) {
  const frame = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout>>();
  const initialized = useRef(false);
  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
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
    if (!initialized.current || reduced || node.dataset.resizing) {
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
    return () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(settle.current);
    };
  }, targets);
  return () => {
    cancelAnimationFrame(frame.current);
    clearTimeout(settle.current);
  };
}
