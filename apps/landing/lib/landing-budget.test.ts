import { Component } from "react";
import { describe, expect, it } from "vitest";
import { SplineLoadBoundary } from "../components/ui/splite";
import {
  ASMR_TRAIL_ALPHA,
  SPLINE_PRELOAD_MEDIA,
  asmrParticleCount,
  asmrStepsPerFrame,
  asmrTrailAlpha,
  heroVisual,
  shouldKeepSplineLoad,
} from "./landing-budget";

describe("hero scene fallback", () => {
  it("shows the poster when the scene load fails on a desktop that could have run it", () => {
    expect(heroVisual(true, true, true)).toBe("poster");
  });

  it("keeps the first desktop paint blank until the viewport is measured", () => {
    expect(heroVisual(null, false, false)).toBe("pending");
  });

  it("shows the poster when 3D is not allowed, and the scene when it is", () => {
    expect(heroVisual(false, false, false)).toBe("poster");
    expect(heroVisual(true, true, false)).toBe("scene");
  });

  it("drops a load that finishes after the robot was hidden or replaced", () => {
    expect(shouldKeepSplineLoad(0, 0, true)).toBe(true);
    expect(shouldKeepSplineLoad(0, 1, false)).toBe(false);
    expect(shouldKeepSplineLoad(0, 1, true)).toBe(false);
  });

  it("does not preload the scene for reduced motion or narrow viewports", () => {
    expect(SPLINE_PRELOAD_MEDIA).toContain("min-width: 768px");
    expect(SPLINE_PRELOAD_MEDIA).toContain("prefers-reduced-motion: no-preference");
  });
});

describe("spline load error", () => {
  it("turns the render throw from a blocked scene into the poster instead of the scene", () => {
    const seen: string[] = [];
    const boundary = new SplineLoadBoundary({
      onError: () => seen.push("fallback"),
      fallback: "poster",
      children: "scene",
    });
    expect(boundary.render()).toBe("scene");

    // @splinetool/react-spline stores a rejected load() and throws it on the next render.
    const blocked = new Error("Failed to fetch https://prod.spline.design/scene.splinecode");
    boundary.state = SplineLoadBoundary.getDerivedStateFromError(blocked);
    expect(boundary.render()).toBe("poster");
    boundary.componentDidCatch(blocked, { componentStack: "" });
    expect(seen).toEqual(["fallback"]);
    expect(boundary.render()).not.toBe("scene");
  });

  it("is a React error boundary", () => {
    expect(SplineLoadBoundary.prototype).toBeInstanceOf(Component);
  });
});

describe("background cost", () => {
  it("keeps the desktop particle cap and draws every frame", () => {
    expect(asmrParticleCount(1440, 900, false)).toBe(450);
    expect(asmrStepsPerFrame(false)).toBe(1);
    expect(asmrTrailAlpha(false)).toBe(ASMR_TRAIL_ALPHA);
  });

  it("keeps a phone's particle count and steps twice per drawn frame", () => {
    expect(asmrParticleCount(390, 844, true)).toBe(Math.round((390 * 844) / 2000));
    expect(asmrStepsPerFrame(true)).toBe(2);
    const keep = 1 - ASMR_TRAIL_ALPHA;
    expect(asmrTrailAlpha(true)).toBeCloseTo(1 - keep * keep);
  });

  it("caps a large narrow screen without touching a desktop of the same area", () => {
    expect(asmrParticleCount(700, 1000, true)).toBe(220);
    expect(asmrParticleCount(700, 1000, false)).toBe(350);
  });
});
