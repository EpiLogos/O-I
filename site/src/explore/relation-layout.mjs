function finite(value, fallback) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function pointOnEllipse(index, count, cx, cy, rx, ry, phase = -Math.PI / 2) {
  if (count <= 0) return { x: cx, y: cy };
  const angle = phase + (Math.PI * 2 * index) / count;
  return {
    x: cx + Math.cos(angle) * rx,
    y: cy + Math.sin(angle) * ry,
  };
}

/**
 * Deterministic visual projection of an existing bounded relation state.
 *
 * This does not create relation meaning or graph identity. It only places the
 * already-selected nodes/edges for a Surface. Recentring is performed by asking
 * the Explore application for a new bounded local whole around another Ref.
 */
export function buildRelationLayout(view, options = {}) {
  if (!view || typeof view !== 'object') throw new TypeError('relation view is required');
  if (!Array.isArray(view.nodes)) throw new TypeError('relation view.nodes must be an array');
  if (!Array.isArray(view.edges)) throw new TypeError('relation view.edges must be an array');
  if (typeof view.focus !== 'string' || !view.focus) throw new TypeError('relation view.focus is required');

  const width = finite(options.width, 1120);
  const height = finite(options.height, 640);
  const cx = width / 2;
  const cy = height / 2;
  const nodeByRef = new Map(view.nodes.map((node) => [node.ref, node]));
  if (!nodeByRef.has(view.focus)) throw new TypeError(`relation focus ${view.focus} is not present in nodes`);

  const direct = [];
  const directSet = new Set();
  for (const edge of view.edges) {
    if (edge.from !== view.focus && edge.to !== view.focus) continue;
    const ref = edge.from === view.focus ? edge.to : edge.from;
    if (nodeByRef.has(ref) && !directSet.has(ref)) {
      directSet.add(ref);
      direct.push(ref);
    }
  }

  const outer = view.nodes
    .map((node) => node.ref)
    .filter((ref) => ref !== view.focus && !directSet.has(ref));

  const positions = new Map([[view.focus, { x: cx, y: cy, tier: 0 }]]);
  direct.forEach((ref, index) => {
    positions.set(ref, {
      ...pointOnEllipse(index, direct.length, cx, cy, Math.min(width * 0.31, 355), Math.min(height * 0.29, 195)),
      tier: 1,
    });
  });
  outer.forEach((ref, index) => {
    positions.set(ref, {
      ...pointOnEllipse(index, outer.length, cx, cy, Math.min(width * 0.43, 485), Math.min(height * 0.42, 265), -Math.PI / 2 + Math.PI / Math.max(outer.length, 1)),
      tier: 2,
    });
  });

  const nodes = view.nodes.map((node) => ({
    ...node,
    ...(positions.get(node.ref) ?? { x: cx, y: cy, tier: 2 }),
    focus: node.ref === view.focus,
  }));

  const edges = view.edges
    .filter((edge) => positions.has(edge.from) && positions.has(edge.to))
    .map((edge, index) => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.max(Math.hypot(dx, dy), 1);
      const bend = ((index % 3) - 1) * 18;
      const mx = (from.x + to.x) / 2 - (dy / length) * bend;
      const my = (from.y + to.y) / 2 + (dx / length) * bend;
      return {
        ...edge,
        path: `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} Q ${mx.toFixed(2)} ${my.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`,
        label_x: mx,
        label_y: my,
      };
    });

  return {
    width,
    height,
    focus: view.focus,
    nodes,
    edges,
  };
}
