/** A dead worker under LENS_ROLE=all should stop the container so the host restarts it. */
export function workerStopExitCode(code) {
  if (typeof code !== "number" || code === 0) return 1;
  return code;
}
