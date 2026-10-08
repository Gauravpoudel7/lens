// Browser-only helpers shared by /pro and /account. No imports, so they stay out of the server bundle.

export type InjectedWallet = {
  publicKey?: { toString(): string } | null;
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signAndSendTransaction?(transaction: unknown): Promise<{ signature: string }>;
  signMessage?(message: Uint8Array, display?: string): Promise<Uint8Array | { signature: Uint8Array }>;
};

/** Phantom injects `window.phantom.solana`; other wallets, and older Phantom builds, use `window.solana`. */
export function injectedWallet(): InjectedWallet | null {
  const scope = window as Window & { phantom?: { solana?: InjectedWallet }; solana?: InjectedWallet };
  return scope.phantom?.solana ?? scope.solana ?? null;
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function encodeBase58(bytes: Uint8Array): string {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      carry += (digits[i] ?? 0) << 8;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let text = "";
  for (const byte of bytes) {
    if (byte !== 0) break;
    text += "1";
  }
  return text + digits.reverse().map((digit) => BASE58[digit] ?? "").join("");
}

export class RequestError extends Error {
  constructor(
    message: string,
    readonly reason?: string,
  ) {
    super(message);
  }
}

/** POST or DELETE JSON to a Lens route. A non-JSON error page still becomes one plain line. */
export async function sendJson<T = Record<string, unknown>>(url: string, body?: unknown, method = "POST"): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new RequestError("Lens could not be reached. Check your connection and try again.", "offline");
  }
  const payload = (await response.json().catch(() => ({}))) as { error?: string; reason?: string } & T;
  if (!response.ok) {
    throw new RequestError(payload.error ?? "Something went wrong on our side. Try again in a minute.", payload.reason);
  }
  return payload;
}

export function walletRejected(err: unknown): boolean {
  const code = (err as { code?: number } | null)?.code;
  const message = err instanceof Error ? err.message : String((err as { message?: string } | null)?.message ?? "");
  return code === 4001 || /reject|cancel|denied|declined/i.test(message);
}

/**
 * Signs one short message with the wallet and trades it for a 24 h session cookie.
 * Returns the signed-in wallet. Throws a RequestError with a plain message.
 */
export async function signInWithWallet(wallet = injectedWallet()): Promise<string> {
  if (!wallet?.signMessage) {
    throw new RequestError("No Solana wallet found. Install Phantom, then try again.", "no_wallet");
  }
  let address: string;
  let signed: Uint8Array | { signature: Uint8Array };
  let issued: { nonce: string; expiresAt: number; message: string };
  try {
    address = (await wallet.connect()).publicKey.toString();
    issued = await sendJson("/api/pro/nonce", { wallet: address });
    signed = await wallet.signMessage(new TextEncoder().encode(issued.message), "utf8");
  } catch (err) {
    if (err instanceof RequestError) throw err;
    if (walletRejected(err)) throw new RequestError("You closed the wallet request. Nothing was signed.", "rejected");
    throw new RequestError("The wallet did not sign. Try again.", "wallet");
  }
  const bytes = signed instanceof Uint8Array ? signed : signed.signature;
  await sendJson("/api/pro/session", {
    wallet: address,
    nonce: issued.nonce,
    expiresAt: issued.expiresAt,
    signature: encodeBase58(bytes),
  });
  return address;
}
