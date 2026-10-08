import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const roots = new Map<string, string>();

/**
 * The monorepo root: the nearest folder at or above the working directory whose package.json has `workspaces`.
 * The web app runs from apps/web and the worker from the root, so paths from env must not depend on cwd.
 */
export function repoRoot(start = process.cwd()): string {
  const known = roots.get(start);
  if (known) return known;
  let dir = path.resolve(start);
  for (;;) {
    const file = path.join(dir, "package.json");
    if (existsSync(file)) {
      try {
        if ((JSON.parse(readFileSync(file, "utf8")) as { workspaces?: unknown }).workspaces) break;
      } catch {
        // Not JSON we can read; keep walking up.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      dir = path.resolve(start);
      break;
    }
    dir = parent;
  }
  roots.set(start, dir);
  return dir;
}

/** Absolute paths pass through. Relative ones resolve from the repo root, never from cwd. */
export function resolveFromRepoRoot(file: string, start?: string): string {
  return path.isAbsolute(file) ? file : path.join(repoRoot(start), file);
}
