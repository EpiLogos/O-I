// Minimal, theme-aware TUI pieces for the Observatory. Kept small on purpose:
// the Observatory is a view into native state, not a second UI framework.

import {
  matchesKey,
  Key,
  truncateToWidth,
} from "@earendil-works/pi-tui";
import type { ObservatorySection, ObservatoryView } from "./model.ts";

/** The slice of the pi theme this package uses. */
export interface OiTheme {
  fg(color: string, text: string): string;
  bg(color: string, text: string): string;
  bold?(text: string): string;
}

export interface PanelComponent {
  render(width: number): string[];
  handleInput(data: string): void;
  invalidate(): void;
}

export interface PanelOptions {
  title: string;
  lines: string[];
  theme: OiTheme;
  viewport?: number;
  help?: string;
  onClose?: () => void;
}

/** A read-only, scrollable dedicated view. */
export function makePanel(options: PanelOptions): PanelComponent {
  const viewport = options.viewport ?? 40;
  let offset = 0;
  const maxOffset = () => Math.max(0, options.lines.length - viewport);

  return {
    render(width: number): string[] {
      const title = truncateToWidth(options.theme.fg("accent", options.title), width);
      const body = options.lines
        .slice(offset, offset + viewport)
        .map((line) => truncateToWidth(line, width));
      const help = truncateToWidth(
        options.theme.fg("dim", options.help ?? "↑↓ scroll · esc/enter/q close"),
        width,
      );
      return [title, ...body, help];
    },
    handleInput(data: string): void {
      if (matchesKey(data, Key.up)) {
        if (offset > 0) offset -= 1;
      } else if (matchesKey(data, Key.down)) {
        if (offset < maxOffset()) offset += 1;
      } else if (
        matchesKey(data, Key.escape) ||
        matchesKey(data, Key.enter) ||
        data === "q"
      ) {
        options.onClose?.();
      }
    },
    invalidate(): void {},
  };
}

export interface ObservatoryOverlayOptions {
  theme: OiTheme;
  view: ObservatoryView;
  viewport?: number;
  requestRender: () => void;
  onOpenSection: (section: ObservatorySection) => void;
  onDetach: () => void;
  onClose: () => void;
}

/**
 * The toggleable right Observatory overlay: a section navigator with a
 * `[raw]` / `[semantic]` toggle. Sections are views into O:I/AIKit models, never
 * private Pi state.
 */
export function makeObservatoryOverlay(
  options: ObservatoryOverlayOptions,
): PanelComponent {
  const viewport = options.viewport ?? 12;
  let selected = 0;
  let rawMode = false;
  const sections = options.view.sections;

  const selectedSection = (): ObservatorySection =>
    sections[selected] ?? sections[0];

  return {
    render(width: number): string[] {
      const title = truncateToWidth(
        options.theme.fg("accent", options.theme.bold?.("SESSION OBSERVATORY") ?? "SESSION OBSERVATORY"),
        width,
      );
      const nav = sections.map((s, index) => {
        const marker = index === selected ? "▸" : " ";
        const label = `${marker} ${s.title}`;
        return truncateToWidth(
          index === selected
            ? options.theme.fg("accent", label)
            : options.theme.fg("muted", label),
          width,
        );
      });

      const current = selectedSection();
      const bodyLines = rawMode
        ? current.raw.split("\n")
        : current.semantic.length > 0
          ? current.semantic
          : ["(no semantic lines)"];
      const body = bodyLines
        .slice(0, viewport)
        .map((line) => truncateToWidth(line, width));

      const toggle = options.theme.fg(
        rawMode ? "accent" : "dim",
        rawMode ? "[raw]" : "[raw]",
      ) + " " + options.theme.fg(
        rawMode ? "dim" : "accent",
        rawMode ? "[semantic]" : "[semantic]",
      );
      const help = truncateToWidth(
        options.theme.fg("dim", "↑↓ section · enter detail · r/s toggle · o detach · q close"),
        width,
      );

      return [title, ...nav, ...body, toggle, help];
    },
    handleInput(data: string): void {
      if (matchesKey(data, Key.up)) {
        if (selected > 0) selected -= 1;
        options.requestRender();
      } else if (matchesKey(data, Key.down)) {
        if (selected < sections.length - 1) selected += 1;
        options.requestRender();
      } else if (matchesKey(data, Key.enter)) {
        options.onOpenSection(selectedSection());
      } else if (data === "r") {
        rawMode = true;
        options.requestRender();
      } else if (data === "s") {
        rawMode = false;
        options.requestRender();
      } else if (data === "o") {
        options.onDetach();
        options.requestRender();
      } else if (matchesKey(data, Key.escape) || data === "q") {
        options.onClose();
      }
    },
    invalidate(): void {},
  };
}
