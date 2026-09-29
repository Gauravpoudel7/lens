export function ModeBanner({ dataMode, proofMode }: { dataMode: string; proofMode: string }) {
  if (dataMode !== "mock" && proofMode !== "mock") return null;
  const parts = [
    dataMode === "mock" ? "market data is fixture data, not mainnet" : null,
    proofMode === "mock" ? "proofs are stored locally instead of on Solana" : null,
  ].filter(Boolean);
  return (
    <p className="mt-4 border border-med/40 bg-[#f3e6cf] px-3 py-2 text-sm text-med">
      Mock mode: {parts.join(", ")}. Set DATA_MODE=live and PROOF_MODE=solana when you have keys.
    </p>
  );
}
