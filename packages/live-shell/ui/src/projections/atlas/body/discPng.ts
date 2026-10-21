// A generated body's small disc as a picture a page can show without a canvas (T-PROCEDURAL-BODY): the RGBA pixels of globe/body.ts bodyDisc as a PNG data URL, written by hand
// (stored, uncompressed deflate blocks: a disc is a few tens of kilobytes) so the World design, which draws in an SVG and may be rendered where there is no canvas, shows the very
// pixels the globe's own generator made, and nothing else. Pure: the same pixels give the same string.
import type {BodyImage} from '../src/globe/body'

const crcTable = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (bytes: Uint8Array): number => { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]!) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const adler32 = (bytes: Uint8Array): number => { let a = 1, b = 0; for (let i = 0; i < bytes.length; i++) { a = (a + bytes[i]!) % 65521; b = (b + a) % 65521 } return ((b << 16) | a) >>> 0 }

function chunk(kind: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length), view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = kind.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** The picture as PNG bytes (8-bit RGBA). */
export function encodePng({width, height, data}: BodyImage): Uint8Array {
  const raw = new Uint8Array(height * (1 + width * 4))
  for (let j = 0; j < height; j++) raw.set(data.subarray(j * width * 4, (j + 1) * width * 4), j * (1 + width * 4) + 1)
  // zlib: a header, stored blocks of at most 65535 bytes, the adler-32 of the data
  const blocks = Math.max(1, Math.ceil(raw.length / 65535)), z = new Uint8Array(2 + raw.length + blocks * 5 + 4)
  z[0] = 0x78; z[1] = 0x01
  let at = 2
  for (let b = 0; b < blocks; b++) {
    const part = raw.subarray(b * 65535, Math.min(raw.length, (b + 1) * 65535)), last = b === blocks - 1 ? 1 : 0
    z[at++] = last; z[at++] = part.length & 255; z[at++] = part.length >> 8; z[at++] = ~part.length & 255; z[at++] = (~part.length >> 8) & 255
    z.set(part, at); at += part.length
  }
  new DataView(z.buffer).setUint32(at, adler32(raw))
  const header = new Uint8Array(13), view = new DataView(header.buffer)
  view.setUint32(0, width); view.setUint32(4, height); header[8] = 8; header[9] = 6
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', z), chunk('IEND', new Uint8Array(0))]
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** The picture as a `data:image/png;base64,…` URL for an SVG `<image>`. */
export function discPngUrl(image: BodyImage): string {
  const bytes = encodePng(image)
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!, b = bytes[i + 1], c = bytes[i + 2]
    out += ALPHABET[a >> 2]! + ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)]! + (b === undefined ? '=' : ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)]!) + (c === undefined ? '=' : ALPHABET[c & 63]!)
  }
  return `data:image/png;base64,${out}`
}
