// Decisions the hero and the background canvas share. Kept pure so a failed
// scene and a late load can be tested without a browser.

/** Preload the 1.3 MB scene only where the hero will actually mount it. */
export const SPLINE_PRELOAD_MEDIA =
  "(min-width: 768px) and (prefers-reduced-motion: no-preference)";

export function heroVisual(
  measured: boolean | null,
  canRun3D: boolean,
  loadFailed: boolean,
): "pending" | "poster" | "scene" {
  // A failed download still has a measured desktop viewport. The poster wins.
  if (loadFailed) return "poster";
  // null until the client measures, so a desktop first paint does not flash the poster.
  if (measured === null) return "pending";
  if (!canRun3D) return "poster";
  return "scene";
}

/**
 * react-spline calls onLoad even after its effect has disposed the scene.
 * Keep the app only when this is still the load we started and the robot is on screen.
 */
export function shouldKeepSplineLoad(startedToken: number, currentToken: number, robotShown: boolean): boolean {
  return robotShown && startedToken === currentToken;
}

const ASMR_AREA = 2000;
const ASMR_DESKTOP_CAP = 450;
const ASMR_NARROW_CAP = 220;
/** Per-frame veil. Two narrow frames must fade the same amount as one desktop pair. */
export const ASMR_TRAIL_ALPHA = 0.18;

export function asmrParticleCount(width: number, height: number, narrow: boolean): number {
  const cap = narrow ? ASMR_NARROW_CAP : ASMR_DESKTOP_CAP;
  return Math.min(cap, Math.max(0, Math.round((width * height) / ASMR_AREA)));
}

/** Narrow screens draw every other frame and step the simulation twice, so speed matches. */
export function asmrStepsPerFrame(narrow: boolean): number {
  return narrow ? 2 : 1;
}

export function asmrTrailAlpha(narrow: boolean): number {
  if (!narrow) return ASMR_TRAIL_ALPHA;
  const keep = 1 - ASMR_TRAIL_ALPHA;
  return 1 - keep * keep;
}
