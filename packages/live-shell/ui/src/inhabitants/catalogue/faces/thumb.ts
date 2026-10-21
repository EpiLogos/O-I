// A figure at rest as a picture, for a list: the creature's own rest pose (face-rig `restSvg`), cropped to its silhouette and kept as an
// image, so thirty-two rows draw thirty-two pictures without thirty-two bodies in the page. Each figure is drawn once.
import {use} from './vendor'
import {built, type Figure} from './figures'
import {serpentBody} from './mount'

const SQUARE = 1.1
const cache = new Map<string, Promise<string | null>>()
let queue: Promise<unknown> = Promise.resolve()

/** The figure's rest pose as an image URL, or null when it is not built. Figures are made one after another, the page breathing between them. */
export function thumbOf(figure: Figure): Promise<string | null> {
  if (!built(figure)) return Promise.resolve(null)
  let p = cache.get(figure.id)
  if (!p) {
    p = queue = queue.then(async () => {
      await new Promise(r => setTimeout(r, 0))
      return draw(figure)
    }).catch(() => null)
    cache.set(figure.id, p as Promise<string | null>)
  }
  return p as Promise<string | null>
}

async function draw(figure: Figure): Promise<string | null> {
  const mount = figure.mount!
  await use('creature-kit')
  for (const file of mount.files) await use(file)
  let svg: string
  if (mount.kind === 'kit') {
    const d = window.CreatureKit.get(mount.def)
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
    for (let i = 0; i < d.NVERT; i++) { const x = d.VX[i], y = d.VY[i]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    const l = Math.max(x1 - x0, y1 - y0) * SQUARE, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
    svg = window.CreatureKit.restSvg(d, {size: 360, palette: {}}) as string
    svg = framed(svg, [cx - l / 2, cy - l / 2, l, l])
  } else if (mount.kind === 'lion') {
    svg = framed(window.creatureRestSvg!({size: 360}) as string, [15, 0, 954, 954])
  } else {
    const box = document.createElement('div')
    serpentBody().mountCreature(box, {size: 360, live: false, life: false})
    svg = framed(box.querySelector('svg')!.outerHTML, [-103, -183, 250, 250])
  }
  return URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}))
}

/** The svg with its viewBox set to the crop, and its size left to the image that holds it. */
function framed(svg: string, box: readonly [number, number, number, number]): string {
  return svg.replace(/<svg\b([^>]*)>/, (_m, attrs: string) => {
    const kept = attrs.replace(/\s(width|height|viewBox|preserveAspectRatio|xmlns)="[^"]*"/g, '')
    return `<svg${kept} xmlns="http://www.w3.org/2000/svg" viewBox="${box.map(n => n.toFixed(1)).join(' ')}" preserveAspectRatio="xMidYMid meet">`
  })
}
