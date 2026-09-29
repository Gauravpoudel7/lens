import { bootstrapEnv } from "@lens/db";
import { ensureDevnetKeypair } from "./devnet-keypair.js";

bootstrapEnv();
process.env.SOLANA_CLUSTER = "devnet";
const funded = await ensureDevnetKeypair();
console.log(`pubkey=${funded.pubkey}`);
console.log(`SOLANA_KEYPAIR_PATH=${funded.file}`);
console.log(`balance_sol=${funded.balanceSol}`);
console.log("Set PROOF_MODE=solana and keep this file out of git. data/*.json is already ignored.");
