"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTime, formatUsdc, shortMint } from "@/lib/format";

type Watch = { id: string; mint: string; symbol: string };

type AccountBody = {
  error?: string;
  user?: {
    xHandle: string | null;
    wallet: string | null;
    proUntil: string | null;
  } | null;
  watches?: Watch[];
  tier?: "free" | "pro";
};

export function AccountPanel({
  initialHandle,
  initialWallet,
  priceUsd,
  periodDays,
}: {
  initialHandle: string;
  initialWallet: string;
  priceUsd: number;
  periodDays: number;
}) {
  const [handle, setHandle] = useState(initialHandle);
  const [wallet, setWallet] = useState(initialWallet);
  const [mint, setMint] = useState("");
  const [account, setAccount] = useState<AccountBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<"load" | "add" | "remove" | null>(null);

  async function load(nextHandle = handle, nextWallet = wallet) {
    setPending("load");
    setError(null);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (nextHandle.trim()) params.set("handle", nextHandle.trim());
      if (nextWallet.trim()) params.set("wallet", nextWallet.trim());
      const response = await fetch(`/api/pro/account?${params.toString()}`);
      const payload = (await response.json()) as AccountBody;
      if (!response.ok) throw new Error(payload.error ?? "Could not load the account.");
      setAccount(payload);
      if (!payload.user) setMessage("No account for that handle or wallet yet.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the account.");
    } finally {
      setPending(null);
    }
  }

  useEffect(() => {
    if (initialHandle.trim() || initialWallet.trim()) {
      void load(initialHandle, initialWallet);
    }
    // Load once from the URL. Later lookups use the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onLookup(event: React.FormEvent) {
    event.preventDefault();
    if (!handle.trim() && !wallet.trim()) {
      setError("Enter an X handle or a wallet.");
      return;
    }
    await load();
  }

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    setPending("add");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/pro/watch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ xHandle: handle, wallet, mint }),
      });
      const payload = (await response.json()) as { error?: string; watches?: Watch[] };
      if (!response.ok) throw new Error(payload.error ?? "Could not save the watch.");
      setAccount((current) => (current ? { ...current, watches: payload.watches ?? [] } : current));
      setMint("");
      setMessage("Watch saved. A HIGH result on this mint sends a DM to the X account on this plan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the watch.");
    } finally {
      setPending(null);
    }
  }

  async function onRemove(target: string) {
    setPending("remove");
    setError(null);
    try {
      const response = await fetch("/api/pro/watch", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ xHandle: handle, wallet, mint: target }),
      });
      const payload = (await response.json()) as { error?: string; watches?: Watch[] };
      if (!response.ok) throw new Error(payload.error ?? "Could not remove the watch.");
      setAccount((current) => (current ? { ...current, watches: payload.watches ?? [] } : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the watch.");
    } finally {
      setPending(null);
    }
  }

  const user = account?.user ?? null;
  const tier = user ? (account?.tier ?? "free") : null;
  const watches = account?.watches ?? [];
  const pro = tier === "pro";

  return (
    <div className="mt-8 space-y-6">
      <form onSubmit={onLookup} className="space-y-4 rounded-2xl border border-line bg-panel p-5">
        <div>
          <label className="text-sm text-muted" htmlFor="account-handle">
            X handle
          </label>
          <Input
            id="account-handle"
            className="mt-2"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="@yourhandle"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="text-sm text-muted" htmlFor="account-wallet">
            Wallet
          </label>
          <Input
            id="account-wallet"
            className="mt-2"
            value={wallet}
            onChange={(event) => setWallet(event.target.value)}
            placeholder="Wallet that sent the USDC"
            autoComplete="off"
          />
        </div>
        <Button type="submit" disabled={pending !== null}>
          {pending === "load" ? "Looking up…" : "Look up account"}
        </Button>
      </form>

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {message ? <Notice tone="info">{message}</Notice> : null}

      {user && tier ? (
        <section className="rounded-2xl border border-line bg-panel p-5" aria-live="polite">
          <h2 className="font-serif text-2xl tracking-tight">{pro ? "Pro" : "Free"}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-faint">X handle</dt>
              <dd>{user.xHandle ? `@${user.xHandle}` : "None on this record"}</dd>
            </div>
            <div>
              <dt className="text-faint">Wallet</dt>
              <dd className="break-all font-mono text-xs">{user.wallet ?? "None on this record"}</dd>
            </div>
            <div>
              <dt className="text-faint">Expiry</dt>
              <dd>
                {pro && user.proUntil
                  ? `Active until ${formatTime(user.proUntil)}`
                  : user.proUntil
                    ? `Ended ${formatTime(user.proUntil)}. This account is on the free plan.`
                    : "No paid period on this account."}
              </dd>
            </div>
          </dl>
          {!pro ? (
            <p className="mt-4 text-sm leading-6 text-muted">
              Pro is {formatUsdc(priceUsd)} USDC for {periodDays} days.{" "}
              <Link href="/pro" className="text-accent-text hover:text-ink">
                Pay with USDC
              </Link>
              .
            </p>
          ) : null}
          {!user.xHandle ? (
            <p className="mt-3 text-sm leading-6 text-muted">
              This plan has no X handle. Warning DMs need the account that tags @justasklens. Include that handle the
              next time you start checkout with this wallet.
            </p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-faint">
              DMs go to this X account when a watched mint is checked as HIGH. Lens does not hold funds for the
              account.
            </p>
          )}
        </section>
      ) : null}

      {user ? (
        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="font-serif text-2xl tracking-tight">Watchlist</h2>
          {pro ? (
            <form onSubmit={onAdd} className="mt-4 space-y-3">
              <label className="text-sm text-muted" htmlFor="watch-mint">
                Mint to watch
              </label>
              <Input
                id="watch-mint"
                value={mint}
                onChange={(event) => setMint(event.target.value)}
                placeholder="Solana token mint"
                autoComplete="off"
              />
              <Button type="submit" disabled={pending !== null}>
                {pending === "add" ? "Saving…" : "Add to watchlist"}
              </Button>
            </form>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted">Watchlist alerts are part of Pro.</p>
          )}
          {watches.length === 0 ? (
            <p className="mt-4 text-sm text-faint">No mints on this watchlist.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {watches.map((watch) => (
                <li key={watch.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">${watch.symbol}</p>
                    <p className="truncate font-mono text-xs text-faint" title={watch.mint}>
                      {shortMint(watch.mint)}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled={pending !== null} onClick={() => onRemove(watch.mint)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
