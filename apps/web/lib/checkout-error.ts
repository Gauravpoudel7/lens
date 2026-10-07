export type CheckoutReason =
  | "not_found"
  | "not_usdc"
  | "account_missing"
  | "expired"
  | "wrong_amount"
  | "pending"
  | "other";

export function checkoutReason(error: string, reason?: string | null): CheckoutReason {
  if (
    reason === "not_found" ||
    reason === "not_usdc" ||
    reason === "account_missing" ||
    reason === "expired" ||
    reason === "wrong_amount" ||
    reason === "pending"
  ) {
    return reason;
  }
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
    default:
      return "Payment not confirmed";
  }
}
