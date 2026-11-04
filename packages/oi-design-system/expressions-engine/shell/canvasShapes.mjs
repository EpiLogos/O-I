const CANVAS_OBJECT_KINDS = ["sticky", "shape", "text"];
const SHAPE_GEOMETRIES = ["rectangle", "ellipse", "diamond"];
const PALETTE_KEYS = ["amber", "sage", "sky", "rose", "stone"];
const SHAPE_FILLS = ["none", ...PALETTE_KEYS];
const STICKY_DEFAULT_PALETTE = "amber";
const CANVAS_TOOL_CHOICES = ["sticky", "rectangle", "ellipse", "diamond", "text"];
const CANVAS_TOOL_SPEC = {
  sticky: { kind: "sticky", label: "Sticky", size: { width: 220, height: 180 } },
  rectangle: { kind: "shape", geometry: "rectangle", label: "Rectangle", size: { width: 240, height: 160 } },
  ellipse: { kind: "shape", geometry: "ellipse", label: "Ellipse", size: { width: 240, height: 160 } },
  diamond: { kind: "shape", geometry: "diamond", label: "Diamond", size: { width: 200, height: 160 } },
  text: { kind: "text", label: "Text", size: { width: 220, height: 48 } }
};
const PALETTE_LABEL = { amber: "Amber", sage: "Sage", sky: "Sky", rose: "Rose", stone: "Stone" };
const CANVAS_TOOL_GLYPHS = {
  sticky: "M4 4h16v11l-5 5H4Z M15 20v-5h5",
  rectangle: "M4 6h16v12H4Z",
  ellipse: "M3 12a9 6.5 0 1 0 18 0a9 6.5 0 1 0-18 0Z",
  diamond: "M12 3l9 9-9 9-9-9Z",
  text: "M5 6h14M12 6v13M9 19h6"
};
function isCanvasObjectKind(value) {
  return CANVAS_OBJECT_KINDS.includes(value);
}
function isPaletteKey(value) {
  return PALETTE_KEYS.includes(value);
}
function isShapeGeometry(value) {
  return SHAPE_GEOMETRIES.includes(value);
}
function isShapeFill(value) {
  return SHAPE_FILLS.includes(value);
}
function canvasObjectNodeType(card) {
  if (!card) return void 0;
  if (card.type === "sticky") return "sticky";
  if (card.type === "text") return "text";
  if (card.type === "shape" && isShapeGeometry(card.shape)) return card.shape;
  return void 0;
}
const paletteToken = (key) => `var(--canvas-object-${key})`;
function canvasObjectFill(card) {
  if (card.type === "sticky") return paletteToken(isPaletteKey(card.palette) ? card.palette : STICKY_DEFAULT_PALETTE);
  if (card.type === "shape" && isPaletteKey(card.fill)) return paletteToken(card.fill);
  return void 0;
}
function canvasObjectNodes(nodes, cardOf) {
  return nodes.map((node) => {
    const card = cardOf(node.id), type = canvasObjectNodeType(card);
    if (!card || !type) return node;
    const label = typeof card.caption === "string" ? card.caption : "";
    return { ...node, type, title: label, bgColour: canvasObjectFill(card) };
  });
}
export {
  CANVAS_OBJECT_KINDS,
  CANVAS_TOOL_CHOICES,
  CANVAS_TOOL_GLYPHS,
  CANVAS_TOOL_SPEC,
  PALETTE_KEYS,
  PALETTE_LABEL,
  SHAPE_FILLS,
  SHAPE_GEOMETRIES,
  STICKY_DEFAULT_PALETTE,
  canvasObjectFill,
  canvasObjectNodeType,
  canvasObjectNodes,
  isCanvasObjectKind,
  isPaletteKey,
  isShapeFill,
  isShapeGeometry,
  paletteToken
};
