import { createNonceStore, type NonceStore } from "@lens/core";

// On globalThis so a dev hot reload does not drop nonces that were just issued.
const globalForNonces = globalThis as unknown as { lensNonces?: NonceStore };

export const walletNonces = (globalForNonces.lensNonces ??= createNonceStore());
