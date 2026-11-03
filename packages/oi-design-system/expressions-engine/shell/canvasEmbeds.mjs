const EMBED_URL_MAX = 2048;
const MEDIA_FIELD_MAX = 1024;
const CENTRAL_PATH_REF_SCHEMA = "central.path-ref/v1";
const PATH_REF_KEYS = ["schema", "ref", "root", "path"];
const EMBED_CARD_SIZE = { width: 320, height: 200 };
const MEDIA_CARD_SIZE = { width: 280, height: 200 };
const HTTPS_LINK = /^https:\/\/[^\s\/?#@\x00-\x1f\x7f-\x9f\u0085]+(?:[\/?#][^\s\x00-\x1f\x7f-\x9f\u0085]*)?$/;
function embedUrlRecord(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed.length <= EMBED_URL_MAX && HTTPS_LINK.test(trimmed) ? trimmed : null;
}
function embedHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
function isCentralPathRef(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value;
  if (Object.keys(record).length !== PATH_REF_KEYS.length || !PATH_REF_KEYS.every((key) => Object.prototype.hasOwnProperty.call(record, key))) return false;
  if (record.schema !== CENTRAL_PATH_REF_SCHEMA) return false;
  return ["ref", "root", "path"].every((key) => typeof record[key] === "string" && record[key].length > 0 && record[key].length <= MEDIA_FIELD_MAX);
}
function mediaSourceUrl(location) {
  return `oi-material://localhost/${encodeURIComponent(JSON.stringify(location))}/`;
}
function mediaFileName(location) {
  const segments = location.path.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? location.path;
}
function cardOverlayBox(box, viewport) {
  return { left: box.x * viewport.zoom + viewport.x, top: box.y * viewport.zoom + viewport.y, width: box.width * viewport.zoom, height: box.height * viewport.zoom };
}
function isEmbedCardType(card) {
  return card?.type === "embed" || card?.type === "media";
}
function embedCardLabel(card, fallback) {
  const caption = typeof card.caption === "string" ? card.caption.trim() : "";
  return caption || fallback;
}
function canvasEmbedNodes(nodes, cardOf) {
  return nodes.map((node) => {
    const card = cardOf(node.id);
    if (!isEmbedCardType(card)) return node;
    return { ...node, type: "text", title: embedCardLabel(card, node.title ?? "") };
  });
}
const EMBED_GLYPH = "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1";
export {
  CENTRAL_PATH_REF_SCHEMA,
  EMBED_CARD_SIZE,
  EMBED_GLYPH,
  EMBED_URL_MAX,
  MEDIA_CARD_SIZE,
  MEDIA_FIELD_MAX,
  canvasEmbedNodes,
  cardOverlayBox,
  embedCardLabel,
  embedHost,
  embedUrlRecord,
  isCentralPathRef,
  isEmbedCardType,
  mediaFileName,
  mediaSourceUrl
};
