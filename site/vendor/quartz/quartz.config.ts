import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration — O:I essay edition.
 *
 * The palette is the O:I shell's own (site/src/tokens.css, shell.css): paper #fbfaf6 / black #0b0b0c,
 * gold #b2944f (#80642e on paper), so the entrance and the essay read as one publication.
 * The layout and the reading UI are in quartz.layout.ts and quartz/components/Field.tsx.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "Confronting the Limit",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "en-US",
    baseUrl: "oi.epi-logos.org/essay",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "modified",
    theme: {
      // Local stacks only: the reading faces are set in styles/field.scss, so no font service is called.
      fontOrigin: "local",
      cdnCaching: true,
      typography: {
        header: "Avenir Next",
        body: "Iowan Old Style",
        code: "ui-monospace",
      },
      colors: {
        lightMode: {
          light: "#fbfaf6",
          lightgray: "#e3e1d9",
          gray: "#8f8c84",
          darkgray: "#111112",
          dark: "#111112",
          secondary: "#80642e",
          tertiary: "#a67f2c",
          highlight: "rgba(178, 148, 79, 0.18)",
          textHighlight: "#b2944f55",
        },
        darkMode: {
          light: "#0b0b0c",
          lightgray: "#2a2a2c",
          gray: "#7e7c76",
          darkgray: "#f4f2ec",
          dark: "#f4f2ec",
          secondary: "#b2944f",
          tertiary: "#d2ae5e",
          highlight: "rgba(178, 148, 79, 0.2)",
          textHighlight: "#b2944f66",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest", lazyLoad: true }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.FieldIndex(),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
    ],
  },
} satisfies QuartzConfig

export default config
