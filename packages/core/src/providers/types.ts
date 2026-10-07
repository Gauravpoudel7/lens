import type { TokenSnapshot } from "../types.js";

export interface ResolvedSymbol {
  mint: string;
  symbol: string;
  name: string;
}

/** One verified token, several, none, or the verified list could not be loaded. */
export type SymbolMatch =
  | { status: "unique"; token: ResolvedSymbol }
  | { status: "ambiguous" }
  | { status: "none" }
  | { status: "unavailable" };

export interface TokenDataProvider {
  readonly name: string;
  resolveBySymbol(symbol: string): Promise<SymbolMatch>;
  getToken(mint: string): Promise<TokenSnapshot | null>;
  getPrice(mint: string): Promise<number | null>;
}
