import { errorMessage, isBusyError, logError } from "@lens/core";

export const BUSY_MESSAGE = "Solana is busy right now. Try again in a minute.";
export const BROKEN_MESSAGE = "Something went wrong on our side. Try again in a minute.";
export const PROOF_FAILED_MESSAGE = "The proof could not be written, so nothing was published. Try again in a minute.";

/**
 * Wraps a route handler so a thrown error is logged with its details and the user gets one plain line.
 * Blink routes pass `key: "message"` because the Actions spec reads `message`.
 */
export function route<A extends unknown[]>(
  name: string,
  handler: (...args: A) => Promise<Response> | Response,
  opts: { key?: "error" | "message"; headers?: HeadersInit } = {},
): (...args: A) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      // Query strings are cut because Helius puts the API key there.
      logError(`api ${name} failed`, { detail: errorMessage(err).replace(/(https?:\/\/[^\s?]+)\?\S*/g, "$1") });
      const busy = isBusyError(err);
      return Response.json(
        { [opts.key ?? "error"]: busy ? BUSY_MESSAGE : BROKEN_MESSAGE, reason: busy ? "busy" : "server" },
        { status: busy ? 503 : 500, headers: opts.headers },
      );
    }
  };
}
