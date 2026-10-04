import { QuartzComponent, QuartzComponentConstructor } from "./types"
import { resolveRelative } from "../util/path"

/** The foundation is a reading anchor, independent of a page's folder ancestry. */
export default (() => {
  const EssayAnchor: QuartzComponent = ({ fileData, allFiles }) => {
    const foundation = allFiles.find((file) =>
      /^section-rooms\/00-integral-threshold\/ROOM(?:-00-integral-threshold)?$/.test(file.slug ?? ""),
    )
    if (!foundation?.slug || !fileData.slug) return null
    const root = allFiles.find((file) => file.slug === "index")
    return (
      <nav class="essay-anchor" aria-label="Essay reading routes">
        {root?.slug && <a href={resolveRelative(fileData.slug, root.slug)}>Essay field</a>}
        {fileData.slug !== foundation.slug && (
          <a href={resolveRelative(fileData.slug, foundation.slug)}>§0/1 · The foundation</a>
        )}
      </nav>
    )
  }
  EssayAnchor.css = ".essay-anchor { display: flex; flex-wrap: wrap; gap: .4rem 1.2rem; margin: .75rem 0; font-size: .9rem; }"
  return EssayAnchor
}) satisfies QuartzComponentConstructor
