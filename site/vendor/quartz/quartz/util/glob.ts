import path from "path"
import type { FilePath } from "./path"
import { globby } from "globby"

export function toPosixPath(fp: string): string {
  return fp.split(path.sep).join("/")
}

export async function glob(
  pattern: string,
  cwd: string,
  ignorePatterns: string[],
): Promise<FilePath[]> {
  const fps = (
    await globby(pattern, {
      cwd,
      ignore: ignorePatterns,
      // O:I stages already selected public Markdown in an ignored build
      // directory. Git's storage excludes must not suppress that input;
      // Quartz's explicit private/ignorePatterns remain applied above.
      gitignore: process.env.OI_QUARTZ_STAGED_INPUTS !== "1",
    })
  ).map(toPosixPath)
  return fps as FilePath[]
}
