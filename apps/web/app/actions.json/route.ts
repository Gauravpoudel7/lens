import { ACTIONS_JSON, ACTIONS_JSON_HEADERS } from "@lens/core";

export const dynamic = "force-dynamic";

/** Solana Actions rules file. GET and OPTIONS both send Access-Control-Allow-Origin: *. */
export function GET() {
  return Response.json(ACTIONS_JSON, { headers: ACTIONS_JSON_HEADERS });
}

export function OPTIONS() {
  return Response.json(ACTIONS_JSON, { headers: ACTIONS_JSON_HEADERS });
}
