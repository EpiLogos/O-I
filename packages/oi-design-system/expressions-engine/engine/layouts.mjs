const NATIVE_LAYOUTS = {
  ring: (n) => Array.from({ length: n }, (_, i) => ({ x: Math.round(Math.cos(i / n * Math.PI * 2 - Math.PI / 2) * 260), y: Math.round(Math.sin(i / n * Math.PI * 2 - Math.PI / 2) * 260) })),
  line: (n) => Array.from({ length: n }, (_, i) => ({ x: Math.round((i - (n - 1) / 2) * 180), y: 0 })),
  column: (n) => Array.from({ length: n }, (_, i) => ({ x: 0, y: Math.round(((n - 1) / 2 - i) * 120) })),
  grid: (n) => {
    const cols = Math.ceil(Math.sqrt(n));
    return Array.from({ length: n }, (_, i) => ({ x: Math.round((i % cols - (cols - 1) / 2) * 220), y: Math.round((Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * -200) }));
  },
  spiral: (n) => Array.from({ length: n }, (_, i) => {
    const a = i * 2.4, r = 40 + i * 45;
    return { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r) };
  })
};
export {
  NATIVE_LAYOUTS
};
