/**
 * FND-04 format detection. The owner's `mime_hint` (Central's magic-byte
 * sniff, `ctrl/src/files.rs`) wins when it is known; a small extension
 * table is the fallback for the pre-read decision (FileSurface must
 * choose a renderer before any owner round trip has happened) and for
 * the rare case the owner discloses no hint at all.
 */
export type MaterialFormat = "html" | "markdown" | "image" | "pdf" | "text" | "unsupported";

const HTML_EXTENSIONS = new Set(["html", "htm"]);
const MARKDOWN_EXTENSIONS = new Set(["md", "markdown"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
const PDF_EXTENSIONS = new Set(["pdf"]);
/** Extensions known to carry binary content this renderer cannot show —
 * an honest "unsupported" disposition rather than a wasted UTF-8 read. */
const UNSUPPORTED_EXTENSIONS = new Set([
  "bin", "exe", "dylib", "so", "dll", "zip", "tar", "gz", "7z", "dmg", "app",
  "wasm", "ttf", "otf", "woff", "woff2", "mp3", "mp4", "mov", "wav", "ogg",
  "avi", "sqlite", "db",
]);

function extensionOf(path?: string): string | undefined {
  if (!path) return undefined;
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return undefined;
  return name.slice(dot + 1).toLowerCase();
}

function fromMimeHint(mimeHint: string): MaterialFormat | undefined {
  if (mimeHint === "text/html") return "html";
  if (mimeHint === "text/markdown") return "markdown";
  if (mimeHint === "application/pdf") return "pdf";
  if (mimeHint.startsWith("image/")) return "image";
  if (mimeHint.startsWith("text/") || mimeHint === "application/json") return "text";
  return undefined;
}

function fromExtension(extension: string | undefined): MaterialFormat {
  if (!extension) return "text";
  if (HTML_EXTENSIONS.has(extension)) return "html";
  if (MARKDOWN_EXTENSIONS.has(extension)) return "markdown";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (PDF_EXTENSIONS.has(extension)) return "pdf";
  if (UNSUPPORTED_EXTENSIONS.has(extension)) return "unsupported";
  return "text";
}

export function detectFormat(input: { path?: string; mimeHint?: string | null }): MaterialFormat {
  if (input.mimeHint) {
    const fromHint = fromMimeHint(input.mimeHint);
    if (fromHint) return fromHint;
    // A disclosed but unrecognised hint (e.g. an owner mime the renderer
    // has no treatment for) is still honestly "unsupported", never
    // silently treated as text.
    if (!input.mimeHint.startsWith("text/")) return "unsupported";
  }
  return fromExtension(extensionOf(input.path));
}
