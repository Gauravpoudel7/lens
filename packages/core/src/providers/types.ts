import type { TokenSnapshot } from "../types.js";

export interface ResolvedSymbol {
  mint: string;
  symbol: string;
  name: string;
}

export interface TokenDataProvider {
  readonly name: string;
  resolveBySymbol(symbol: string): Promise<ResolvedSymbol | null>;
  getToken(mint: string): Promise<TokenSnapshot | null>;
  getPrice(mint: string): Promise<number | null>;
}
