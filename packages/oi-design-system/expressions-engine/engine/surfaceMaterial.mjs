const HALO_MAX = 0.6;
const SURFACE_LAW = "O-I 854: the lens's material on the marks: roughness is the marks' imperfect edges (irregularity), elasticity their edge softness, tension their density contrast, and particles that gather less leave more peripheral ink (halo = 0.6 \xB7 (1 \u2212 particle affinity)); the colour is the colour field's first colour while the field is on. Every other mark the scene sets stands.";
const unit = (x) => Math.min(1, Math.max(0, x));
function hexOf(rgb) {
  return `#${rgb.slice(0, 3).map((c) => Math.round(unit(c) * 255).toString(16).padStart(2, "0")).join("")}`;
}
function surfaceMaterial(config, m) {
  return {
    ...config,
    material: { ...config.material, irregularity: m.roughness, softness: m.elasticity, contrast: m.tension, halo: HALO_MAX * (1 - m.particle_affinity) },
    ...config.color?.enabled ? { color: { ...config.color, primaryColor: hexOf(m.colour_rgb) } } : {}
  };
}
export {
  HALO_MAX,
  SURFACE_LAW,
  hexOf,
  surfaceMaterial
};
