// Registers the .ts-resolving hook for node --test runs that import the
// app's TypeScript sources directly (see ts-resolve-hook.mjs).
import { register } from "node:module";
register("./ts-resolve-hook.mjs", import.meta.url);
