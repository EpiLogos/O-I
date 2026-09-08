/**
 * The context menu (U0.3b) — D15/law 12: "the canonical-Actions disclosure
 * UI". Renders exactly the ActionDisclosures it is given — nothing
 * fabricated, disabled entries shown disabled (an honest 'no'), an empty
 * disclosure list never opens a menu at all. Keyboard: ↑↓ move, ⏎ invoke,
 * ⏥ close (pointer: right-click opens, click invokes — parity).
 */

import { Fragment, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ActionDisclosure, SurfaceId } from "./types";
import { Glyph } from "../workspace/Glyph";

export interface MenuState {
  x: number;
  y: number;
  items: ActionDisclosure[];
  /** The binding the menu was opened for, when it is a binding menu. */
  surfaceId?: SurfaceId;
}

interface Props {
  menu: MenuState;
  onInvoke: (item: ActionDisclosure, surfaceId?: SurfaceId) => void;
  onClose: () => void;
}

/** The frame's own keyboard path for each disclosed action (keys.ts) —
 * shown as a right-aligned <kbd> hint so the menu teaches its own
 * shortcuts. An action absent here has no frame keybinding (or already
 * states one in its own title, e.g. "World (⌘B)"). */
const SHORTCUT: Record<string, string> = {
  "surface.close": "⌘W",
  "surface.split-right": "⌘D",
  "surface.split-down": "⌘⇧D",
  "surface.maximize": "⌘⌥⏎",
  "surface.pin": "⌥P",
  "surface.unpin": "⌥P",
  "surface.restore-layout": "⌘⌥R",
  "surface.tile": "⌘⌥T",
  "surface.reopen": "⌘⇧T",
};

/** Finding 10 — a glyph before the label, from the study's own icon set.
 * Only the actions with an obvious visual match get one; an unmapped
 * disclosure keeps its glyph slot empty rather than wearing a fabricated
 * icon. */
const ICON: Partial<Record<string, "close" | "columns" | "rows" | "expand" | "restore" | "grid" | "history" | "detach">> = {
  "surface.close": "close",
  "surface.split-right": "columns",
  "surface.split-down": "rows",
  "surface.maximize": "expand",
  "surface.tile": "grid",
  "surface.restore-layout": "history",
  "surface.reopen": "history",
  "surface.detach": "detach",
};

export function ContextMenu({ menu, onInvoke, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // The eyebrow names the subject the disclosures belong to (brief FND-01):
  // the binding's own tab title for a binding menu, "Window" for the frame
  // menu — read from the DOM rather than plumbed through Cradle.tsx, since
  // this component owns only its own disclosure surface.
  const [subject] = useState(() => {
    if (!menu.surfaceId) return "Window";
    const el = document.querySelector<HTMLElement>(`[data-surface-id="${menu.surfaceId}"] .tab-title`);
    return el?.textContent?.trim() || "Window";
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>(".ctx-item:not([disabled])");
    if (first) first.focus();
    else el.focus();
    // Clamp into the viewport so no disclosure is ever unreachable.
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth)
      el.style.left = `${Math.max(0, window.innerWidth - r.width - 4)}px`;
    if (r.bottom > window.innerHeight)
      el.style.top = `${Math.max(0, window.innerHeight - r.height - 4)}px`;
  }, []);

  useEffect(() => {
    // Opaque rendered documents do not bubble pointer events to this host.
    // Entering their focus context (or another native window) ends a menu.
    window.addEventListener('blur', onClose);
    return () => window.removeEventListener('blur', onClose);
  }, [onClose]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>(".ctx-item:not([disabled])") ?? [],
    );
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!items.length) return;
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      const d = e.key === "ArrowDown" ? 1 : -1;
      items[(i + d + items.length) % items.length].focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === "Tab") {
      e.preventDefault(); // the menu is a transient plane, not a tab stop
    }
  };

  // "hr separators before Close" (brief FND-01): a divider sets the closing
  // action apart. The owner's disclosure ORDER is never reordered for
  // presentation (the walk reads `.ctx-item` in that exact sequence) — the
  // separator is inserted immediately before whichever row is the close
  // action, wherever the disclosure places it.
  return (
    <div
      ref={ref}
      className="ctx-menu"
      role="menu"
      aria-label="Disclosed actions"
      tabIndex={-1}
      style={{ left: menu.x, top: menu.y }}
      onKeyDown={onKeyDown}
    >
      <small className="ctx-menu-subject">{subject}</small>
      {menu.items.map((item) => (
        <Fragment key={item.action_ref}>
          {item.action_ref === "surface.close" && <hr />}
          <button
            type="button"
            role="menuitem"
            className="ctx-item"
            data-action-ref={item.action_ref}
            disabled={!item.enabled}
            aria-disabled={!item.enabled}
            onClick={() => onInvoke(item, menu.surfaceId)}
          >
            <span className="ctx-item-glyph" aria-hidden="true">{ICON[item.action_ref] && <Glyph name={ICON[item.action_ref]!} size={13} />}</span>
            <span className="ctx-item-title">{item.title}</span>
            {SHORTCUT[item.action_ref] && <kbd aria-hidden="true">{SHORTCUT[item.action_ref]}</kbd>}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
