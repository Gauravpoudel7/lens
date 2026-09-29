import {
  LiveTokenDataProvider,
  MockTokenDataProvider,
  MockXClient,
  createMockProofPublisher,
  createReplyWriter,
  createSolanaProofPublisher,
  loadConfig,
  type LensConfig,
  type LensStore,
  type ProofPublisher,
  type ReplyWriter,
  type TokenDataProvider,
  type XClient,
} from "@lens/core";
import { bootstrapEnv } from "./env.js";
import { createPrismaStore } from "./store.js";

export interface LensRuntime {
  config: LensConfig;
  store: LensStore;
  provider: TokenDataProvider;
  proofs: ProofPublisher;
  writer: ReplyWriter;
  x: XClient;
}

export async function createRuntime(overrides?: { x?: XClient }): Promise<LensRuntime> {
  bootstrapEnv();
  const config = loadConfig();
  const store = createPrismaStore();
  const provider =
    config.dataMode === "live" ? new LiveTokenDataProvider(config) : new MockTokenDataProvider();
  const mockProofs = createMockProofPublisher(store);
  const solanaProofs = createSolanaProofPublisher(config);
  const proofs: ProofPublisher = {
    publish(payload) {
      return config.proofMode === "solana" ? solanaProofs.publish(payload) : mockProofs.publish(payload);
    },
    async readMemo(signature) {
      if (signature.startsWith("mock_")) return mockProofs.readMemo(signature);
      const local = await mockProofs.readMemo(signature);
      if (local.payload) return local;
      return solanaProofs.readMemo(signature);
    },
  };
  return {
    config,
    store,
    provider,
    proofs,
    writer: createReplyWriter(config),
    x: overrides?.x ?? new MockXClient(),
  };
}
