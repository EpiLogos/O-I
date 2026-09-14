const defaultCamera = () => ({ mode: "2d", yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0, plane: "XY", depth: 0, grid: false, snap: false });
function basis(c) {
  const y = c.yaw, p = c.pitch;
  return { a: [Math.cos(y), 0, Math.sin(y)], b: [Math.sin(y) * Math.sin(p), Math.cos(p), -Math.cos(y) * Math.sin(p)] };
}
function stageScale(w, h) {
  return Math.min(w * 0.435, h * 0.465);
}
function stageCentre(w, h) {
  return { x: w * 0.51, y: h * (w < 650 ? 0.385 : 0.48) };
}
function project(v, c, w, h) {
  const { a, b } = basis(c), s = stageScale(w, h) * c.zoom, o = stageCentre(w, h);
  return { x: o.x + c.panX + s * (a[0] * v.x + a[1] * v.y + a[2] * v.z), y: o.y + c.panY - s * (b[0] * v.x + b[1] * v.y + b[2] * v.z) };
}
function unproject(x, y, c, w, h, plane = c.plane, depth = c.depth) {
  const { a, b } = basis(c), s = stageScale(w, h) * c.zoom, o = stageCentre(w, h), px = (x - o.x - c.panX) / s, py = -(y - o.y - c.panY) / s;
  const axes = plane === "XY" ? [0, 1, 2] : plane === "XZ" ? [0, 2, 1] : [1, 2, 0];
  const [i, j, k] = axes;
  const X = px - a[k] * depth, Y = py - b[k] * depth, det = a[i] * b[j] - a[j] * b[i];
  if (Math.abs(det) < 0.035) throw new Error("This working plane is edge-on. Choose \u201CFace plane\u201D before placing.");
  const v = [0, 0, 0];
  v[k] = depth;
  v[i] = (X * b[j] - a[j] * Y) / det;
  v[j] = (a[i] * Y - X * b[i]) / det;
  if (c.snap) {
    v[i] = Math.round(v[i] * 10) / 10;
    v[j] = Math.round(v[j] * 10) / 10;
  }
  return { x: v[0], y: v[1], z: v[2] };
}
function facePlane(c) {
  if (c.plane === "XY") {
    c.yaw = 0;
    c.pitch = 0;
  }
  if (c.plane === "XZ") {
    c.yaw = 0;
    c.pitch = -Math.PI / 2;
  }
  if (c.plane === "YZ") {
    c.yaw = Math.PI / 2;
    c.pitch = 0;
  }
}
export {
  basis,
  defaultCamera,
  facePlane,
  project,
  stageCentre,
  stageScale,
  unproject
};
