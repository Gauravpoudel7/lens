export interface UserRecord {
  id: string;
  xUserId: string | null;
  xHandle: string | null;
  wallet: string | null;
  tier: "free" | "pro";
  proUntil: string | null;
  createdAt: string;
}

export interface WatchRecord {
  id: string;
  userId: string;
  mint: string;
  symbol: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  provider: "solana_usdc" | "card";
  reference: string;
  amountUsd: number;
  amountRaw: string;
  mint: string;
  recipient: string;
  signature: string | null;
  status: "pending" | "paid" | "failed";
  createdAt: string;
}

export interface AlertRecord {
  id: string;
  userId: string;
  checkId: string;
  mint: string;
  text: string;
  channel: "dm";
  status: "queued" | "sent" | "failed";
  xMessageId: string | null;
  createdAt: string;
}

export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

export function isActivePro(user: { proUntil: string | null } | null | undefined, now = new Date()): boolean {
  if (!user?.proUntil) return false;
  const until = Date.parse(user.proUntil);
  return Number.isFinite(until) && until > now.getTime();
}
