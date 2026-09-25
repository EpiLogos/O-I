import { QuartzComponentConstructor, QuartzComponentProps } from "./types"

/** Two tiny ghost chevrons pinned to the viewport edges: they fade the
 * explorer (left) and the graph rail (right) away so the reading column
 * widens. State persists in localStorage under oi-fades. */
export default (() => {
  function FadeToggles({ displayClass }: QuartzComponentProps) {
    return (
      <div class={displayClass ?? ""}>
        <button class="fade-toggle fade-left" aria-label="Toggle explorer" title="Fade the explorer" aria-pressed="false">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button class="fade-toggle fade-right" aria-label="Toggle graph rail" title="Fade the graph rail" aria-pressed="false">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    )
  }

  FadeToggles.beforeDOMLoaded = `
    (() => {
      const read = () => { try { return JSON.parse(localStorage.getItem("oi-fades") ?? "{}") } catch { return {} } };
      const apply = () => {
        const s = read();
        document.body.classList.toggle("oi-explorer-hidden", !!s.explorer);
        document.body.classList.toggle("oi-rail-hidden", !!s.rail);
        const l = document.querySelector(".fade-left");
        const r = document.querySelector(".fade-right");
        if (l) l.setAttribute("aria-pressed", String(!!s.explorer));
        if (r) r.setAttribute("aria-pressed", String(!!s.rail));
      };
      document.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target.closest(".fade-toggle") : null;
        if (!target) return;
        const s = read();
        if (target.classList.contains("fade-left")) s.explorer = !s.explorer;
        else s.rail = !s.rail;
        localStorage.setItem("oi-fades", JSON.stringify(s));
        apply();
      });
      if (document.body) {
        apply();
      } else {
        document.addEventListener("DOMContentLoaded", apply, { once: true });
      }
    })();
  `

  return FadeToggles
}) satisfies QuartzComponentConstructor
