/**
 * Native appearance sync: the macOS vibrancy material (the window's
 * NSVisualEffectView) resolves through the WINDOW's appearance, which
 * follows the system — not the app's theme toggle. This keeps the window
 * appearance in lockstep with the app theme, so "light" gets the light
 * frost and "dark" the dark one; "system" (no attribute) follows the
 * system again.
 */
import { getCurrentWindow } from "@tauri-apps/api/window";

export function initNativeThemeSync(): void {
  if (!document.documentElement.classList.contains("tauri")) return;
  const apply = () => {
    const theme = document.body.getAttribute("data-theme");
    try {
      void getCurrentWindow().setTheme(theme === "dark" ? "dark" : theme === "light" ? "light" : null);
    } catch {
      // older hosts without the command: the material just follows the system
    }
  };
  apply();
  new MutationObserver(apply).observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });
}
