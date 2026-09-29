/**
 * Canonical liquid-staking mints. Matched by mint address, not by ticker,
 * so a copycat symbol still takes the normal mint-authority penalty.
 * An enabled mint authority on these pools is the stake pool itself.
 */
export const STAKE_POOL_MINTS: Readonly<Record<string, string>> = {
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: "JitoSOL",
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: "mSOL",
  bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1: "bSOL",
  jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v: "jupSOL",
  "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm": "INF",
};

/** Programs that are allowed to hold mint authority for a receipt token. */
export const STAKE_POOL_PROGRAMS: ReadonlySet<string> = new Set([
  "SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy",
  "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD",
  "SP12tWFxD9oJsVWNavTTBZvMbA6gkAmxtVgxdqvyvhY",
  "SPMBzsVUuoHA4Jm6KunbsotaahvVikZs1JyTW6iJvbn",
]);

export function isStakePoolToken(mint: string | null | undefined, mintAuthority: string | null | undefined): boolean {
  if (mint && STAKE_POOL_MINTS[mint]) return true;
  if (mintAuthority && STAKE_POOL_PROGRAMS.has(mintAuthority)) return true;
  return false;
}
