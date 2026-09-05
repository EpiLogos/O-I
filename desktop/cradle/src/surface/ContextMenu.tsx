/**
 * The context menu (U0.3b) — D15/law 12: "the canonical-Actions disclosure
 * UI". Renders exactly the ActionDisclosures it is given — nothing
 * fabricated, disabled entries shown disabled (an honest 'no'), an empty
 * disclosure list never opens a menu at all. Keyboard: ↑↓ move, ⏎ invoke,
 * ⏥ close (pointer: right-click opens, click invokes — parity).
 */

import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ActionDisclosure, SurfaceId } from "./types";

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

export function ContextMenu({ menu, onInvoke, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

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

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>(".ctx-item") ?? [],
    );
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!items.length) return;
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      const d = e.key === "ArrowDown" ? 1 : -1;
      items[(i + d + items.length) % items.length].focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === "Tab") {
      e.preventDefault(); // the menu is a transient plane, not a tab stop
    }
  };

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
      {menu.items.map((item) => (
        <button
          key={item.action_ref}
          type="button"
          role="menuitem"
          className="ctx-item"
          data-action-ref={item.action_ref}
          disabled={!item.enabled}
          aria-disabled={!item.enabled}
          onClick={() => onInvoke(item, menu.surfaceId)}
        >
          {item.title}
        </button>
      ))}
    </div>
  );
}
