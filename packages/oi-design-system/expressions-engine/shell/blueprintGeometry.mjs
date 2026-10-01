// desktop/cradle/kernel/src/expression_blueprint_sixfold.json
var expression_blueprint_sixfold_default = {
  column_axis: [],
  constraints: {
    asserts_relations: false,
    creates_members: false,
    fixed_local_slots: true,
    frame: "normalized-local",
    partial_occupancy: true,
    unique_addresses: true,
    whole_transform: "presentation-only"
  },
  embedding: "normalized-sixfold-ring/v1",
  geometry_version: "1.1.0",
  owner: "ql-core",
  row_axis: [],
  schema: "ql.shape-presentation/v1",
  shape_ref: "ql:shape:1.0.0:constellation:sixfold",
  sites: [
    {
      address: {
        coordinate: {
          face: "direct",
          position: 0
        },
        kind: "position"
      },
      xyz: [
        0,
        -1,
        0
      ]
    },
    {
      address: {
        coordinate: {
          face: "direct",
          position: 1
        },
        kind: "position"
      },
      xyz: [
        0.8660254037844386,
        -0.5,
        0
      ]
    },
    {
      address: {
        coordinate: {
          face: "direct",
          position: 2
        },
        kind: "position"
      },
      xyz: [
        0.8660254037844386,
        0.5,
        0
      ]
    },
    {
      address: {
        coordinate: {
          face: "direct",
          position: 3
        },
        kind: "position"
      },
      xyz: [
        0,
        1,
        0
      ]
    },
    {
      address: {
        coordinate: {
          face: "direct",
          position: 4
        },
        kind: "position"
      },
      xyz: [
        -0.8660254037844386,
        0.5,
        0
      ]
    },
    {
      address: {
        coordinate: {
          face: "direct",
          position: 5
        },
        kind: "position"
      },
      xyz: [
        -0.8660254037844386,
        -0.5,
        0
      ]
    }
  ],
  source_refs: [
    "docs/geometry/GEOMETRY-CONSTELLATION-WAYFINDER.md",
    "docs/geometry/CANONICAL-CONSTELLATION-RESOLUTION.md",
    "crates/ql-core/src/shape.rs"
  ],
  standing: "numerical presentation convention; not a semantic metric"
};

// desktop/cradle/expressions-app/field-studies-journeys/src/field-studies-journeys/src/blueprintGeometry.ts
var BLUEPRINT_READING_DIGEST = "sha256:4d148c4155b5a16ff6bcafedf024bae3b3f60206a965b70a4fe69b58a1660139";
var BLUEPRINT_SHAPE = expression_blueprint_sixfold_default.shape_ref;
function validateBlueprint(value) {
  const fail = () => {
    throw Error("The Scene blueprint does not match its exact native sixfold presentation");
  };
  if (!value || value.schema !== "oi.scene-blueprint/v1" || value.shape_ref !== BLUEPRINT_SHAPE || value.reading_digest !== BLUEPRINT_READING_DIGEST || value.frame?.availability !== "available" || !value.frame.ref || !value.frame.revision || !Array.isArray(value.members) || value.members.length > 6) fail();
  const t = value.transform;
  if (!t || !Array.isArray(t.translation) || t.translation.length !== 3 || !t.translation.every((v) => Number.isFinite(v) && Math.abs(v) <= 1600) || !Array.isArray(t.rotation) || t.rotation.length !== 3 || !t.rotation.every((v) => Number.isFinite(v) && Math.abs(v) <= 1e3) || !Number.isFinite(t.scale) || t.scale < 0.01 || t.scale > 1600) fail();
  if (value.basis_refs !== void 0 && (!Array.isArray(value.basis_refs) || value.basis_refs.length > 64 || !value.basis_refs.every((r) => typeof r === "string" && r.length > 0 && r.length <= 4096))) fail();
  for (const optional of [value.derivation_ref, value.operator_ref]) if (optional != null && (typeof optional !== "string" || optional.length === 0 || optional.length > 4096)) fail();
  const ids = /* @__PURE__ */ new Set(), roles = /* @__PURE__ */ new Set(), positions = /* @__PURE__ */ new Set();
  for (const m of value.members) {
    if (!m.entity_ref || !m.subject_ref || !m.role_ref || !Number.isInteger(m.position) || m.position < 0 || m.position > 5 || ids.has(m.entity_ref) || roles.has(m.role_ref) || positions.has(m.position)) fail();
    ids.add(m.entity_ref);
    roles.add(m.role_ref);
    positions.add(m.position);
  }
}
function blueprintPosition(binding, position) {
  const site = expression_blueprint_sixfold_default.sites.find((s) => s.address.coordinate.position === position);
  if (!site) throw Error("This role has no supplied QL position");
  let [x, y, z] = site.xyz;
  const [rx, ry, rz] = binding.transform.rotation;
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  return [x, y, z].map((v, i) => v * binding.transform.scale + binding.transform.translation[i]);
}
function blueprintMember(scene, id) {
  return !!scene.composition.blueprint?.members.some((m) => m.entity_ref === id);
}
function applyBlueprintAnchors(scene, config) {
  const binding = scene.composition.blueprint;
  if (!binding) return config;
  validateBlueprint(binding);
  const result = { ...config, entities: config.entities?.map((entity) => ({ ...entity })) };
  for (const member of binding.members) {
    const entity = result.entities?.find((e) => e.id === member.entity_ref);
    if (!entity) continue;
    if (entity.sequence.links.some((step) => step.x !== void 0 || step.y !== void 0 || step.z !== void 0)) throw Error("Release the blueprint before running positional sequence steps");
    const index = result.entities.indexOf(entity);
    if (config.automations?.some((lane) => lane.enabled && ["x", "y", "z"].some((axis) => lane.path.endsWith(`.${axis}`)) && [String(index), member.entity_ref].some((key) => lane.path.startsWith(`entities.${key}.`)))) throw Error("Release the blueprint before automating individual positions");
    const [x, y, z] = blueprintPosition(binding, member.position);
    entity.x = x;
    entity.y = y;
    entity.z = z;
  }
  return result;
}
export {
  BLUEPRINT_READING_DIGEST,
  BLUEPRINT_SHAPE,
  applyBlueprintAnchors,
  blueprintMember,
  blueprintPosition,
  validateBlueprint
};
