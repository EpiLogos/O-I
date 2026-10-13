/**
 * The chronology's one colour table (lane-2 T23). Colour in the timeline means exactly two things: a standing
 * class (how the owner's fact is held) and a category (what kind of thing it is). Both tables live here, so the
 * item band, the standing badge, the relationship edges and the legend draw from one vocabulary, and the category
 * swatches draw from the same table as the cards they tag. Values are fixed: a colour changes only when the meaning
 * it carries changes, never with the camera, the order of the readings or the time of day.
 */

/** Standing: the stroke each class is drawn with (standingStyle.ts pairs it with its dash pattern). */
export const STANDING_COLOUR = {
  sourced: "#2e7d32",
  derived: "#6a4bd6",
  authored: "#0d6efd",
  disputed: "#c62828",
  mythic: "#b8860b",
  unavailable: "#74766b",
} as const;

/** Category: the edge colour and the tinted card ground of each category (categories.ts reads these by id). */
export const CATEGORY_COLOUR = {
  "historical-event": {color: "#79c0d4", background: "#102633"},
  claim: {color: "#e0b86f", background: "#302817"},
  interpretation: {color: "#cf91c7", background: "#2b1d2a"},
  archetype: {color: "#d0a24a", background: "#2d2414"},
  "myth-in-time": {color: "#b98cff", background: "#281f35"},
  myth: {color: "#a994d6", background: "#241f31"},
  "speculation-contested": {color: "#e07a6f", background: "#321b1b"},
  source: {color: "#5fb8a0", background: "#102a24"},
  "book-writing": {color: "#b9a784", background: "#29251d"},
  constellation: {color: "#8fd3ff", background: "#102436"},
  "institution-network-figure": {color: "#9aa6b8", background: "#1b2430"},
} as const;
