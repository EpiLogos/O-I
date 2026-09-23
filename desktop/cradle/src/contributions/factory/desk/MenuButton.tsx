/** A button that opens a small anchored menu (the Desk's ⟳ and + menus, the
 * Run page's ⋯). Closes on outside pointer-down, Escape, or choosing a row.
 * Rows are real actions only; a row whose route is absent is not rendered. */
import {useEffect, useRef, useState, type ReactNode} from "react";

export interface MenuRow { label: string; hint?: string; onSelect?: () => void; disabled?: boolean; separatorBefore?: boolean; body?: ReactNode }

export function MenuButton({label, content, rows, className, ariaLabel, align = "end", onOpen}:{
  label: ReactNode; ariaLabel?: string; rows?: MenuRow[]; content?: (close: () => void) => ReactNode; className?: string; align?: "start" | "end"; onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => { if (!host.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const close = () => setOpen(false);
  return <div className="fmenu" ref={host}>
    <button type="button" className={className ?? "oi-action"} aria-haspopup="menu" aria-expanded={open} aria-label={ariaLabel}
      onClick={() => { setOpen(value => !value); if (!open) onOpen?.(); }}>{label}</button>
    {open && <div className="fmenu-pop" role="menu" data-align={align}>
      {content?.(close)}
      {rows?.map(row => <div key={row.label} className="fmenu-row-wrap" data-separator={row.separatorBefore ? "true" : undefined}>
        <button type="button" role="menuitem" className="fmenu-row" disabled={row.disabled} onClick={() => { close(); row.onSelect?.(); }}>
          <span>{row.label}</span>{row.hint && <small>{row.hint}</small>}
        </button>
      </div>)}
    </div>}
  </div>;
}
