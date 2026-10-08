export function ModeBanner({
  dataMode,
  proofMode,
  cluster,
}: {
  dataMode: string;
  proofMode: string;
  cluster: string;
}) {
  if (dataMode !== "mock" && proofMode !== "mock") {
    return (
      <p className="border-b border-line bg-panel px-4 py-2 text-center text-sm text-muted">
        Live token data. Answers are stamped on Solana {cluster === "devnet" ? "Devnet" : "Mainnet"}.
      </p>
    );
  }
  const parts = [
    dataMode === "mock" ? "token numbers are samples" : null,
    proofMode === "mock" ? "stamps are saved locally, not on Solana" : null,
  ].filter(Boolean);
  return (
    <p className="border-b border-med/40 bg-med-bg px-4 py-2 text-center text-base text-med">
      Demo mode: {parts.join(", and ")}.
    </p>
  );
}
