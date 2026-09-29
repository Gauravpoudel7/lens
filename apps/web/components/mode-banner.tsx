export function ModeBanner({ dataMode, proofMode }: { dataMode: string; proofMode: string }) {
  if (dataMode !== "mock" && proofMode !== "mock") {
    return (
      <p className="mt-4 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
        Live token reads. Proofs on {proofMode === "solana" ? "Solana" : proofMode}.
      </p>
    );
  }
  const parts = [
    dataMode === "mock" ? "market data is fixture data, not mainnet" : null,
    proofMode === "mock" ? "proofs are stored locally instead of on Solana" : null,
  ].filter(Boolean);
  return (
    <p className="mt-4 rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
      Mock mode: {parts.join(", ")}. Set DATA_MODE=live and PROOF_MODE=solana when you have keys.
    </p>
  );
}
