/** Desktop rails and narrow-screen modal drawers share the actual native panels. */
document.addEventListener("nav", () => {
  const wide = window.matchMedia("(min-width: 1280px)")
  const names = ["pages", "connections"] as const
  const panels = names.map((name) => document.getElementById(`essay-${name}`) as HTMLDialogElement)
  const buttons = names.map((name) => document.querySelector(`[data-essay-panel="${name}"]`) as HTMLButtonElement)
  if (panels.some((panel) => !panel) || buttons.some((button) => !button)) return

  const read = (): { explorer?: boolean; rail?: boolean } => {
    try { return JSON.parse(localStorage.getItem("oi-fades") ?? "{}") } catch { return {} }
  }
  const save = () => {
    if (!wide.matches) return
    try { localStorage.setItem("oi-fades", JSON.stringify({ explorer: !panels[0].open, rail: !panels[1].open })) } catch {}
  }
  const sync = () => {
    panels.forEach((panel, i) => {
      buttons[i].setAttribute("aria-expanded", String(panel.open))
      document.body.classList.toggle(i === 0 ? "oi-explorer-hidden" : "oi-rail-hidden", !panel.open)
    })
    document.body.classList.toggle("essay-drawer-open", panels.some((panel) => panel.matches(":modal")))
  }
  const close = (i: number, returnFocus = true) => {
    panels[i].close()
    sync()
    save()
    if (returnFocus) buttons[i].focus({ preventScroll: true })
  }
  const open = (i: number) => {
    if (wide.matches) panels[i].show()
    else {
      panels.forEach((panel, j) => { if (j !== i && panel.open) close(j, false) })
      panels[i].showModal()
      panels[i].querySelector<HTMLButtonElement>("[data-essay-close]")?.focus({ preventScroll: true })
    }
    // The native explorer has a separate mobile toggle. The panel now owns that
    // visibility; keep the real tree expanded inside its independently scrolling drawer.
    panels[i].querySelector(".explorer")?.classList.remove("collapsed")
    sync()
    save()
  }
  const arrange = () => {
    const s = read()
    if (wide.matches) {
      panels.forEach((panel, i) => {
        if (panel.matches(":modal")) panel.close()
        // Initial nonmodal rails do not take focus away from the reading page.
        panel.toggleAttribute("open", !(i === 0 ? s.explorer : s.rail))
      })
    } else panels.forEach((panel) => { if (panel.open) panel.close() })
    panels[0].querySelector(".explorer")?.classList.remove("collapsed")
    sync()
  }
  const disposers: (() => void)[] = []
  panels.forEach((panel, i) => {
    const toggle = () => panel.open ? close(i) : open(i)
    const closeButton = panel.querySelector<HTMLButtonElement>("[data-essay-close]")!
    const dismiss = () => close(i)
    const cancel = (event: Event) => {
      // Escape first closes an enlarged graph/search, then the enclosing drawer.
      if (panel.querySelector(".global-graph-outer.active, .search-container.active")) {
        event.preventDefault()
        return
      }
      event.preventDefault()
      close(i)
    }
    const nestedEscape = (event: KeyboardEvent) => {
      if (event.key === "Tab" && panel.matches(":modal")) {
        const scope = panel.querySelector<HTMLElement>(".global-graph-outer.active, .search-container.active") ?? panel
        const targets = [...scope.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')].filter((target) => {
          const css = getComputedStyle(target)
          const rect = target.getBoundingClientRect()
          return target.tabIndex >= 0 && !target.hasAttribute("disabled") && css.visibility === "visible" && rect.width > 0 && rect.height > 0
        })
        const first = targets[0], last = targets[targets.length - 1]
        if (first && last && (event.shiftKey ? document.activeElement === first || !scope.contains(document.activeElement) : document.activeElement === last || !scope.contains(document.activeElement))) {
          event.preventDefault()
          ;(event.shiftKey ? last : first).focus()
        }
        return
      }
      if (event.key !== "Escape") return
      if (panel.querySelector(".global-graph-outer.active, .search-container.active")) {
        event.preventDefault()
        return
      }
      // Native Quartz overlay handlers prevent the browser's dialog cancel
      // even when their overlays are closed. Dismiss our drawer directly.
      if (panel.matches(":modal")) { event.preventDefault(); close(i) }
    }
    const follow = (event: Event) => {
      if (!wide.matches && (event.target as Element)?.closest("a[href]")) close(i, false)
    }
    const backdrop = (event: MouseEvent) => {
      if (event.target !== panel || !panel.matches(":modal")) return
      const box = panel.getBoundingClientRect()
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close(i)
    }
    buttons[i].addEventListener("click", toggle)
    closeButton.addEventListener("click", dismiss)
    panel.addEventListener("cancel", cancel)
    panel.addEventListener("keydown", nestedEscape)
    panel.addEventListener("click", follow)
    panel.addEventListener("click", backdrop)
    disposers.push(() => {
      buttons[i].removeEventListener("click", toggle)
      closeButton.removeEventListener("click", dismiss)
      panel.removeEventListener("cancel", cancel)
      panel.removeEventListener("keydown", nestedEscape)
      panel.removeEventListener("click", follow)
      panel.removeEventListener("click", backdrop)
      if (panel.open) panel.close()
    })
  })
  wide.addEventListener("change", arrange)
  arrange()
  window.addCleanup(() => {
    disposers.forEach((dispose) => dispose())
    wide.removeEventListener("change", arrange)
    document.body.classList.remove("essay-drawer-open")
  })
})
