/**
 * The window-lights contract (owner direction 2026-09-22: "ensure it's there
 * and actually part of testing for the frontend").
 *
 * The traffic-lights wedge has been silently lost three times — each loss was
 * a merge or rewrite that kept SOME of the chain (the attribute, the CSS, the
 * signal) and dropped a link, showing only as a missing left notch on the
 * owner's desktop. The owner's recorded ruling (packages/oi-design-system/
 * DESKTOP-LANGUAGE.md §5, 2026-09-22): the left corner wedge works with the
 * corner icons and is never silently removed. This test gates every link's
 * static integrity so the next rewrite that eats one fails here, loudly.
 *
 * The chain, in order:
 *   1. CradleFrame derives windowLights (Tauri AND macOS AND NOT fullscreen —
 *      the derived-baseline shape, never a single native query) and passes it
 *      to the DesktopShell.
 *   2. DesktopShell renders data-window-lights on .desktop-shell.
 *   3. shell.css keys the 116px reserve and the header's 84px offset on that
 *      attribute; the corner-left regime derives the left cutout from the
 *      reserve and cuts it with the hairline-safe left depth.
 *   4. The wedge is actually carried: the mode stages and Workbench panes
 *      render data-window-corner-left (the ruling: the wedge is not removed).
 *   5. hostedApp.ts posts the cutout geometry (left width/height AND the
 *      right wedge) to the hosted Expressions app and re-posts when
 *      data-window-lights flips; the app consumes the right wedge.
 */
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read = async (relative) => await readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("windowLights: CradleFrame derives the signal from the live lights condition, never a bare platform or transport guess", async () => {
  const frame = await read("src/CradleFrame.tsx");
  assert.match(frame, /const MAC_PLATFORM = \/Mac\|iPhone\|iPad\/\.test\(navigator\.platform\)/, "the macOS platform read is missing");
  assert.match(frame, /const windowLights = kernel\.transport\.kind==="tauri" && MAC_PLATFORM && !fullscreen/, "the derived-baseline shape (tauri && macOS && !fullscreen) is missing");
  // The native confirmation must only ever SUPPRESS the baseline; a failed
  // query may never turn the wedge off.
  assert.match(frame, /setFullscreen\(!!full\)/, "the fullscreen confirmation is missing");
  assert.doesNotMatch(frame, /setWindowLights\(/, "a direct windowLights setter reintroduces the stranded-single-sample shape");
});

test("windowLights: CradleFrame passes the signal to the DesktopShell", async () => {
  const frame = await read("src/CradleFrame.tsx");
  assert.match(frame, /onMode=\{enterMode\} windowLights=\{windowLights\} onTabPresentation/, "the DesktopShell call site lost the windowLights prop");
});

test("windowLights: the DesktopShell renders data-window-lights on the shell", async () => {
  const shell = await read("src/workspace/DesktopShell.tsx");
  assert.match(shell, /data-window-lights=\{p\.windowLights \? "true" : undefined\}/, "the shell attribute is missing");
  assert.match(shell, /windowLights\?: boolean/, "the prop declaration is missing");
});

test("windowLights: shell.css keys the reserve and the header offset on the attribute", async () => {
  const css = await read("src/workspace/shell.css");
  assert.match(css, /\.desktop-shell\[data-window-lights="true"\]\{--shell-window-reserve:116px\}/, "the 116px reserve is not keyed on the lights attribute");
  assert.match(css, /\.desktop-shell\[data-window-lights="true"\] \.shell-topbar \{ padding-left: 84px; \}/, "the header's lights offset is not keyed on the attribute");
});

test("corner-left: the left cutout derives from the reserve and cuts flush with the canvas top edge", async () => {
  const css = await read("src/workspace/shell.css");
  assert.match(css, /\[data-window-corner-left="true"\]\{--window-cutout:max\(0px,calc\(var\(--shell-window-reserve\) - var\(--desktop-left-width\)\)\)\}/, "the corner-left cutout no longer derives from the reserve");
  assert.match(css, /--window-corner-depth-left:calc\(var\(--oi-shell-tabbar\) \+ 1px\)/, "the left notch depth (flush with the canvas top edge, no hairline sliver) is missing");
  assert.match(css, /clip-path:polygon\(var\(--window-cutout\) 0,calc\(100% - var\(--window-cutout-right\)\) 0,100% var\(--window-corner-depth\),100% 100%,0 100%,0 var\(--window-corner-depth-left\)/, "the clip-path lost its left cut or its left depth");
});

test("corner-left: the wedge is carried — the mode stages and the Workbench panes render the attribute (the ruling: not removed)", async () => {
  const frame = await read("src/CradleFrame.tsx");
  assert.match(frame, /data-window-corner-left="true"/, "the mode stages lost the corner-left attribute");
  const workbench = await read("src/surface/Workbench.tsx");
  assert.match(workbench, /data-window-corner-left=/, "the Workbench panes lost the corner-left attribute");
});

test("windowLights: the hosted-app cutout posts both wedges and re-posts when the lights flip", async () => {
  const hosted = await read("src/expressions/hostedApp.ts");
  assert.match(hosted, /const right = Math\.max\(0, 52\.5 - read\(shell, "--desktop-right-width", 0\)\)/, "the right wedge is missing from the posted geometry");
  assert.match(hosted, /attributeFilter: \["style", "class", "data-native", "data-window-lights"\]/, "the cutout watcher no longer re-posts on lights flips");
  const app = await read("expressions-app/field-studies-journeys/src/app.ts");
  assert.match(app, /--shell-cutout-r/, "the vendored app no longer consumes the right wedge");
  const css = await read("expressions-app/field-studies-journeys/src/workspace.css");
  assert.match(css, /var\(--shell-cutout-r,0px\)/, "the masthead no longer pads its end icons by the right wedge");
});
