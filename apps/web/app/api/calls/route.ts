import { SCORECARD_KINDS } from "@lens/core";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const rt = await getRuntime();
  const checks = await rt.store.listChecks({ limit: 200, kinds: SCORECARD_KINDS });
  return Response.json({
    checks: checks.map((check) => ({
      id: check.id,
      kind: check.kind,
      tokenMint: check.tokenMint,
      tokenSymbol: check.tokenSymbol,
      tokenName: check.tokenName,
      riskLevel: check.riskLevel,
      dataMode: check.dataMode,
      createdAt: check.createdAt,
      reportUrl: `${rt.config.publicBaseUrl}/r/${check.id}`,
      proof: check.proof
        ? {
            hash: check.proof.contentHash,
            signature: check.proof.txSignature,
            cluster: check.proof.cluster,
            explorerUrl: check.proof.explorerUrl,
            signedAt: check.proof.signedAt,
          }
        : null,
      outcome: check.outcome,
    })),
  });
}
