import { describe, expect, it } from "vitest";
// @ts-expect-error the docker entry imports this small script, which has no types
import { workerStopExitCode } from "../../../scripts/worker-stop.mjs";

describe("worker lifecycle", () => {
  it("stops the container when the worker exits", () => {
    expect(workerStopExitCode(0)).toBe(1);
    expect(workerStopExitCode(null)).toBe(1);
    expect(workerStopExitCode(2)).toBe(2);
  });
});
