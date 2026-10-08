// Browser helper shared by the home search box and the /check form.

export type CheckOutcome = { id: string } | { kind: "notice" | "error"; text: string };

export async function runCheck(input: string): Promise<CheckOutcome> {
  const value = input.trim();
  if (!value) return { kind: "error", text: "Paste a token address or a $ticker." };
  try {
    const response = await fetch("/api/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: value }),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
    if (response.ok && body.id) return { id: body.id };
    return {
      // 422 is a ticker notice (several coins, SOL, a stablecoin): information, not a failure.
      kind: response.status === 422 ? "notice" : "error",
      text: body.error ?? "Something went wrong on our side. Try again in a minute.",
    };
  } catch {
    return { kind: "error", text: "Lens could not be reached. Check your connection and try again." };
  }
}
