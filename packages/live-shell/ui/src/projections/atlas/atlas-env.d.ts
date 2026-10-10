/// <reference types="vite/client" />
// Ambient types for the ported atlas modules: the found code reads
// `import.meta.env.BASE_URL` / `VITE_EPHEMERIS_URL` (vite's client types).
// This file is new in the port (the atlas's own tsconfig declared
// `types: ["vite/client", "node"]`; the host ui package does not), and it
// grants nothing beyond those ambient declarations.
