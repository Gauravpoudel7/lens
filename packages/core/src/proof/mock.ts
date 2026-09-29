import { randomBytes } from "node:crypto";
import type { LensStore } from "../store/types.js";
import type { ProofPublisher } from "./solana.js";

export function createMockProofPublisher(store: LensStore): ProofPublisher {
  return {
    async publish(payload) {
      const signature = `mock_${randomBytes(16).toString("hex")}`;
      await store.saveChainMemo(signature, payload, "mock");
      return { signature, cluster: "mock" };
    },
    async readMemo(signature) {
      const memo = await store.getChainMemo(signature);
      if (!memo) return { payload: null, cluster: "mock", slotTime: null };
      return { payload: memo.payload, cluster: memo.cluster, slotTime: null };
    },
  };
}
