export function ModeBanner({ dataMode, proofMode }: { dataMode: string; proofMode: string }) {
  if (dataMode !== "mock" && proofMode !== "mock") {
    return (
      <p className="border-b border-line bg-low-bg px-4 py-2 text-center text-sm text-low">
        Live token reads. Proofs are written on {proofMode === "solana" ? "Solana" : proofMode}.
      </p>
    );
  }
  const parts = [
    dataMode === "mock" ? "Market figures are fixtures, not mainnet" : null,
    proofMode === "mock" ? "Proofs are stored in this database, not on Solana" : null,
  ].filter(Boolean);
  return (
    <p className="border-b border-med/40 bg-med-bg px-4 py-2 text-center text-sm text-med">
      Mock mode. {parts.join(". ")}.
    </p>
  );
}
