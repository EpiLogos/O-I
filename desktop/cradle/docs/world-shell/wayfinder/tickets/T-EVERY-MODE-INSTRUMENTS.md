# T-EVERY-MODE-INSTRUMENTS — every pane instrument in every mode

**Source:** owner ruling, 13 Oct 2026, relayed by the DLW documentation
session; recorded in DEVICE-SEMANTICS-LOCK §0.1. It retires the
plain-aperture rule (WSD Technē section, WIDGET-GUIDE §4.5,
DLW-PANES-PER-MODE §5.1, world-shell-mockup.html apertures comment — all
conformed in the same commit as this ticket).

## Target

1. The detail row's Device side follows the **focused pane's instrument** in
   every mode (Central, Factory, Expressions, Live, Technē). A pane holding
   no instrument keeps its mode's Device side; Clip sides are unchanged.
2. The instrument face is the existing instrument rack with the focused
   pane's instrument expanded and the others folded.
3. The lens bar rides the instrument panes in any mode, not only Technē.
4. Technē's 0 instrument is the Earth and solar system with its graph view
   (atlas Earth ⇄ Graph).

## Out of this ticket (follows the vision spec, O-I PR #655)

- The restatement of M1′–M5′ around the 0-layer world.
- Mode material through the planet grammar (Central as planet with projects
  as places and the day as walks; Factory NOW as planet with agents as
  activity and subagents as nested orbits).
- Worlds, expressions and graphs each live / composed / recorded-and-played.

## Acceptance

- Scripted: a pane→instrument mapping table over every centre panel id; a
  source pin that neither the instrument detail nor the lens bar is gated on
  `frameMode === 'techne'`.
- Native: in Central with the Earth pane focused, the Device side shows the
  0 instrument expanded; in Factory with a Graph pane, the graph instrument.
