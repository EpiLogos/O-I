const CONNECTOR_KINDS = ["straight", "curved", "elbow"];
const CONNECTOR_SIDES = ["top", "right", "bottom", "left"];
const CONNECTOR_LABEL_MAX = 160;
const CONNECTOR_RECORD_MAX = 256;
const CONNECTOR_KEY_MAX = 1024;
const CONNECTOR_FIELDS = ["kind", "label", "fromSide", "toSide"];
function isConnectorKind(value) {
  return typeof value === "string" && CONNECTOR_KINDS.includes(value);
}
function isConnectorSide(value) {
  return typeof value === "string" && CONNECTOR_SIDES.includes(value);
}
const labelFits = (label) => Array.from(label).length <= CONNECTOR_LABEL_MAX;
function validateConnector(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid connector");
  const record = value;
  if (Object.keys(record).some((key) => !CONNECTOR_FIELDS.includes(key))) throw new Error("Unknown connector field");
  if (!isConnectorKind(record.kind)) throw new Error("Invalid connector kind");
  if (record.label !== void 0 && !(typeof record.label === "string" && record.label.trim().length > 0 && labelFits(record.label))) throw new Error("Invalid connector label");
  if (record.fromSide !== void 0 && !isConnectorSide(record.fromSide)) throw new Error("Invalid connector side");
  if (record.toSide !== void 0 && !isConnectorSide(record.toSide)) throw new Error("Invalid connector side");
}
function connectorRecord(input) {
  const label = (input.label ?? "").trim();
  const capped = Array.from(label).slice(0, CONNECTOR_LABEL_MAX).join("");
  const next = { kind: input.kind };
  if (capped) next.label = capped;
  if (input.fromSide) next.fromSide = input.fromSide;
  if (input.toSide) next.toSide = input.toSide;
  return next.kind === "curved" && !next.label && !next.fromSide && !next.toSide ? null : next;
}
function connectorWithSides(current, sides) {
  return connectorRecord({ kind: current?.kind ?? "curved", label: current?.label, fromSide: sides.fromSide, toSide: sides.toSide });
}
function sideFromHandleId(handleId, role) {
  if (!handleId || !handleId.startsWith(`${role}-`)) return void 0;
  const side = handleId.slice(role.length + 1);
  return isConnectorSide(side) ? side : void 0;
}
function connectorPresentation(record) {
  return {
    kind: record?.kind ?? "curved",
    label: record?.label,
    sourceHandleId: record?.fromSide ? `source-${record.fromSide}` : void 0,
    targetHandleId: record?.toSide ? `target-${record.toSide}` : void 0
  };
}
export {
  CONNECTOR_KEY_MAX,
  CONNECTOR_KINDS,
  CONNECTOR_LABEL_MAX,
  CONNECTOR_RECORD_MAX,
  CONNECTOR_SIDES,
  connectorPresentation,
  connectorRecord,
  connectorWithSides,
  isConnectorKind,
  isConnectorSide,
  sideFromHandleId,
  validateConnector
};
