import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { pathToRoot } from "../util/path"
// @ts-ignore
import script from "./scripts/essay-panels.inline"

/** September's two reader controls, made available at every viewport width. */
export default (() => {
  function FadeToggles({ fileData }: QuartzComponentProps) {
    return (
      <nav class="essay-reader-toolbar" aria-label="Reading tools">
        <button type="button" class="fade-toggle fade-left" data-essay-panel="pages" aria-controls="essay-pages" aria-expanded="true">Pages</button>
        <a href={`${pathToRoot(fileData.slug!)}/../`} class="essay-site-home" data-router-ignore="true">O:I</a>
        <button type="button" class="fade-toggle fade-right" data-essay-panel="connections" aria-controls="essay-connections" aria-expanded="true">Connections</button>
      </nav>
    )
  }
  FadeToggles.afterDOMLoaded = script
  return FadeToggles
}) satisfies QuartzComponentConstructor
