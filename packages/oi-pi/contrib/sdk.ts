// Embedded SDK entry: construct an explicit ResourceLoader for the O:I package.
//
// When Pi is embedded programmatically, use this factory instead of relying on
// ambient resource discovery. The O:I package contributes a Surface (the Pi
// extension) and deliberately contributes no skills, prompt templates or themes,
// so it never re-forwards or double-loads Skills the DSH engine already owns.

import { DefaultResourceLoader } from "@earendil-works/pi-coding-agent";
import type { InlineExtension, ResourceLoader } from "@earendil-works/pi-coding-agent";
import oiPiExtension from "./index.ts";

export interface OiPiLoaderOptions {
  cwd?: string;
  agentDir?: string;
  /** Extra host extension paths to keep loading; the package adds none of its own. */
  additionalExtensionPaths?: string[];
}

/**
 * An explicit ResourceLoader whose only package-owned contribution is the oi-pi
 * extension factory. Skills/prompts/themes are passed through unchanged from the
 * host loader, so the package never introduces uncontrolled discovery of its own.
 */
export function createOiPiResourceLoader(
  options: OiPiLoaderOptions = {},
): ResourceLoader {
  const inline: InlineExtension = {
    name: "oi-pi",
    factory: oiPiExtension,
  };

  return new DefaultResourceLoader({
    cwd: options.cwd,
    agentDir: options.agentDir,
    extensionFactories: [inline],
    additionalExtensionPaths: options.additionalExtensionPaths ?? [],
    // Package-owned skills/prompts/themes: none. The oi-pi package is a Surface
    // contribution, not a skill tree.
  }) as unknown as ResourceLoader;
}
