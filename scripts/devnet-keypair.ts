import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { resolveFromRepoRoot } from "@lens/core";

const MIN_LAMPORTS = Math.round(0.05 * LAMPORTS_PER_SOL);

export async function ensureDevnetKeypair(): Promise<{ file: string; pubkey: string; balanceSol: number }> {
  const file = resolveFromRepoRoot(process.env.SOLANA_KEYPAIR_PATH?.trim() || "data/devnet-keypair.json");
  mkdirSync(path.dirname(file), { recursive: true });

  let keypair: Keypair;
  if (existsSync(file)) {
    const secret = JSON.parse(readFileSync(file, "utf8")) as number[];
    keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
    console.log(JSON.stringify({ msg: "using existing devnet keypair", file, pubkey: keypair.publicKey.toBase58() }));
  } else {
    keypair = Keypair.generate();
    writeFileSync(file, JSON.stringify(Array.from(keypair.secretKey)));
    console.log(JSON.stringify({ msg: "wrote devnet keypair", file, pubkey: keypair.publicKey.toBase58() }));
  }

  const rpcs = [
    process.env.SOLANA_RPC_URL?.trim(),
    "https://api.devnet.solana.com",
    "https://rpc.ankr.com/solana_devnet",
  ].filter((url, index, all): url is string => Boolean(url) && all.indexOf(url) === index);

  let lastError = "airdrop did not run";
  for (const rpc of rpcs) {
    const connection = new Connection(rpc, "confirmed");
    try {
      let balance = await connection.getBalance(keypair.publicKey);
      if (balance >= MIN_LAMPORTS) {
        const balanceSol = balance / LAMPORTS_PER_SOL;
        console.log(JSON.stringify({ msg: "devnet balance is enough", rpc, balanceSol }));
        return { file, pubkey: keypair.publicKey.toBase58(), balanceSol };
      }
      for (const sol of [1, 0.5]) {
        try {
          const signature = await connection.requestAirdrop(
            keypair.publicKey,
            Math.round(sol * LAMPORTS_PER_SOL),
          );
          const latest = await connection.getLatestBlockhash();
          await connection.confirmTransaction({ signature, ...latest }, "confirmed");
          balance = await connection.getBalance(keypair.publicKey);
          const balanceSol = balance / LAMPORTS_PER_SOL;
          console.log(JSON.stringify({ msg: "airdrop confirmed", rpc, signature, balanceSol }));
          return { file, pubkey: keypair.publicKey.toBase58(), balanceSol };
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          console.log(
            JSON.stringify({
              msg: "airdrop attempt failed",
              rpc,
              sol,
              error: lastError.slice(0, 220),
            }),
          );
          if (/429|limit|run dry/i.test(lastError)) break;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.log(JSON.stringify({ msg: "devnet rpc failed", rpc, error: lastError.slice(0, 220) }));
    }
  }

  throw new Error(
    `Could not fund ${keypair.publicKey.toBase58()} on devnet. Last error: ${lastError}. Fund it from a faucet and rerun.`,
  );
}
