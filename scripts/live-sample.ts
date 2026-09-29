import { LiveTokenDataProvider, loadConfig } from "@lens/core";
import { bootstrapEnv } from "@lens/db";

bootstrapEnv();
process.env.DATA_MODE = "live";
const config = loadConfig();
const provider = new LiveTokenDataProvider(config);

const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

async function pumpMint(): Promise<string | null> {
  const response = await fetch("https://api.dexscreener.com/latest/dex/search?q=pump", {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    pairs?: Array<{ chainId?: string; dexId?: string; baseToken?: { address?: string; symbol?: string } }>;
  };
  const pair = (body.pairs ?? []).find(
    (row) => row.chainId === "solana" && row.dexId === "pumpfun" && row.baseToken?.address,
  );
  return pair?.baseToken?.address ?? null;
}

function brief(label: string, snapshot: Awaited<ReturnType<LiveTokenDataProvider["getToken"]>>) {
  if (!snapshot) {
    console.log(JSON.stringify({ label, ok: false }));
    return;
  }
  console.log(
    JSON.stringify({
      label,
      ok: true,
      mint: snapshot.mint,
      symbol: snapshot.symbol,
      name: snapshot.name,
      createdAt: snapshot.createdAt,
      priceUsd: snapshot.priceUsd,
      liquidityUsd: snapshot.liquidityUsd,
      lpLocked: snapshot.lpLocked,
      top10HolderPct: snapshot.top10HolderPct,
      mintAuthorityActive: snapshot.mintAuthorityActive,
      freezeAuthorityActive: snapshot.freezeAuthorityActive,
      sniperPct: snapshot.sniperPct,
      burnedPct: snapshot.burnedPct,
      sources: snapshot.sources,
    }),
  );
}

const bonk = await provider.getToken(BONK);
brief("BONK", bonk);
const pump = await pumpMint();
if (!pump) {
  console.log(JSON.stringify({ label: "pump", ok: false, error: "no pump.fun pair in search" }));
  process.exit(bonk ? 0 : 1);
}
const token = await provider.getToken(pump);
brief("pump", token);
if (!bonk?.symbol || !token?.symbol) process.exit(1);
