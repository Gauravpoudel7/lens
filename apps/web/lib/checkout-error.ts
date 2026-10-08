export type CheckoutReason =
  | "not_found"
  | "not_usdc"
  | "account_missing"
  | "expired"
  | "wrong_amount"
  | "pending"
  | "no_wallet"
  | "rejected"
  | "insufficient_usdc"
  | "insufficient_sol"
  | "wrong_network"
  | "wrong_wallet"
  | "already_paid"
  | "other";

const KNOWN: CheckoutReason[] = [
  "not_found",
  "not_usdc",
  "account_missing",
  "expired",
  "wrong_amount",
  "pending",
  "no_wallet",
  "rejected",
  "insufficient_usdc",
  "insufficient_sol",
  "wrong_network",
  "wrong_wallet",
  "already_paid",
];

export function checkoutReason(error: string, reason?: string | null): CheckoutReason {
  if (KNOWN.includes(reason as CheckoutReason)) return reason as CheckoutReason;
  const text = error.toLowerCase();
  if (text.includes("no checkout") || text.includes("not found")) return "not_found";
  if (text.includes("expir")) return "expired";
  if (text.includes("less than the price") || text.includes("wrong amount") || text.includes("short")) {
    return "wrong_amount";
  }
  if (text.includes("no confirmed")) return "pending";
  return "other";
}

export function checkoutTitle(reason: CheckoutReason): string {
  switch (reason) {
    case "not_found":
      return "Not found";
    case "expired":
      return "Expired";
    case "wrong_amount":
      return "Wrong amount";
    case "pending":
      return "No transfer yet";
    case "not_usdc":
      return "Not a USDC checkout";
    case "account_missing":
      return "Account missing";
    case "no_wallet":
      return "No wallet found";
    case "rejected":
      return "Payment cancelled";
    case "insufficient_usdc":
      return "Not enough USDC";
    case "insufficient_sol":
      return "Not enough SOL for the fee";
    case "wrong_network":
      return "Wrong network";
    case "wrong_wallet":
      return "Different wallet";
    case "already_paid":
      return "Already paid";
    default:
      return "Payment not confirmed";
  }
}
