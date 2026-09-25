import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration — O:I night-paper edition.
 *
 * The palette mirrors the Plate B essay shell tokens (site/src/essay/essay.css):
 * the essay and the html entrance read as one publication. See
 * site/ESSAY-QUARTZ-HARD-BRIEF-2026-09-25.md for the standing brief.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "The Return of Zero",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    analytics: {
      provider: null,
    },
    locale: "en-US",
    baseUrl: "oi.epi-logos.org/essay",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "EB Garamond",
        body: "EB Garamond",
        code: "IBM Plex Mono",
      },
      colors: {
        // Both modes carry the night palette: one theme, no jarring white page.
        lightMode: {
          light: "#141311",
          lightgray: "#3a372f",
          gray: "#a39b8c",
          darkgray: "#e6e0d4",
          dark: "#f0e9da",
          secondary: "#d7c4a3",
          tertiary: "#b08958",
          highlight: "rgba(176, 137, 88, 0.15)",
          textHighlight: "#b0895888",
        },
        darkMode: {
          light: "#141311",
          lightgray: "#3a372f",
          gray: "#a39b8c",
          darkgray: "#e6e0d4",
          dark: "#f0e9da",
          secondary: "#d7c4a3",
          tertiary: "#b08958",
          highlight: "rgba(176, 137, 88, 0.15)",
          textHighlight: "#b0895888",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
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
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
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
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
    ],
  },
} satisfies QuartzConfig

export default config
