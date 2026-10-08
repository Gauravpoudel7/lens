"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { Notice } from "@/components/notice";
import { COLUMNS } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTime, formatUsdc, shortMint } from "@/lib/format";
import { RequestError, sendJson, signInWithWallet } from "@/lib/wallet-client";

type Watch = { id: string; mint: string; symbol: string };

type AccountBody = {
  user?: {
    xHandle: string | null;
    wallet: string | null;
    proUntil: string | null;
    xLinkedAt: string | null;
  } | null;
  linkCode?: { code: string; expiresAt: string } | null;
  watches?: Watch[];
  tier?: "free" | "pro";
  restricted?: boolean;
  public?: { pro: boolean; handle: string | null } | null;
};

const CARD = "rounded-2xl border border-line bg-panel p-5";

function message(err: unknown, fallback: string): string {
  return err instanceof RequestError ? err.message : fallback;
}

async function getAccount(query = ""): Promise<AccountBody> {
  const response = await fetch(`/api/pro/account${query ? `?${query}` : ""}`, { cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as AccountBody & { error?: string };
  if (!response.ok) throw new RequestError(payload.error ?? "Something went wrong on our side. Try again in a minute.");
  return payload;
}

export function AccountPanel({
  signedIn,
  initialHandle,
  initialWallet,
  priceUsd,
  periodDays,
  botHandle,
}: {
  signedIn: string | null;
  initialHandle: string;
  initialWallet: string;
  priceUsd: number;
  periodDays: number;
  botHandle: string;
}) {
  const router = useRouter();
  const [account, setAccount] = useState<AccountBody | null>(null);
  const [lookup, setLookup] = useState(initialWallet || (initialHandle ? `@${initialHandle.replace(/^@/, "")}` : ""));
  const [found, setFound] = useState<AccountBody | null>(null);
  const [mint, setMint] = useState("");
  const [pending, setPending] = useState<"load" | "sign" | "lookup" | "add" | "remove" | "out" | null>(
    signedIn ? "load" : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const loadOwn = useCallback(async () => {
    setPending("load");
    setError(null);
    try {
      setAccount(await getAccount());
    } catch (err) {
      setError(message(err, "Your account could not be loaded. Try again in a minute."));
    } finally {
      setPending(null);
    }
  }, []);

  const runLookup = useCallback(async (value: string) => {
    const text = value.trim();
    if (!text) {
      setError("Enter an X handle or a wallet address.");
      return;
    }
    setPending("lookup");
    setError(null);
    setFound(null);
    try {
      const params = new URLSearchParams();
      if (text.startsWith("@") || text.length < 32) params.set("handle", text.replace(/^@/, ""));
      else params.set("wallet", text);
      setFound(await getAccount(params.toString()));
    } catch (err) {
      setError(message(err, "That account could not be looked up. Try again."));
    } finally {
      setPending(null);
    }
  }, []);

  useEffect(() => {
    if (signedIn) void loadOwn();
    else if (initialWallet || initialHandle) void runLookup(initialWallet || initialHandle);
  }, [signedIn, initialWallet, initialHandle, loadOwn, runLookup]);

  async function onSignIn() {
    setPending("sign");
    setError(null);
    try {
      await signInWithWallet();
      router.refresh();
    } catch (err) {
      setError(message(err, "The wallet did not sign. Try again."));
      setPending(null);
    }
  }

  async function onSignOut() {
    setPending("out");
    try {
      await sendJson("/api/pro/session", undefined, "DELETE");
    } catch {
      // The cookie is httpOnly; a failed request leaves it, and the next refresh shows the truth.
    }
    setAccount(null);
    router.refresh();
  }

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    setPending("add");
    setError(null);
    setSaved(null);
    try {
      const payload = await sendJson<{ watches: Watch[] }>("/api/pro/watch", { mint: mint.trim() });
      setAccount((current) => (current ? { ...current, watches: payload.watches } : current));
      setMint("");
      setSaved("Saved. A HIGH result on this token sends you a DM on X.");
    } catch (err) {
      setError(message(err, "That token could not be saved. Try again."));
    } finally {
      setPending(null);
    }
  }

  async function onRemove(target: string) {
    setPending("remove");
    setError(null);
    setSaved(null);
    try {
      const payload = await sendJson<{ watches: Watch[] }>("/api/pro/watch", { mint: target }, "DELETE");
      setAccount((current) => (current ? { ...current, watches: payload.watches } : current));
    } catch (err) {
      setError(message(err, "That token could not be removed. Try again."));
    } finally {
      setPending(null);
    }
  }

  const user = account?.user ?? null;
  const pro = Boolean(user) && account?.tier === "pro";
  const linked = Boolean(user?.xLinkedAt && user.xHandle);
  const watches = account?.watches ?? [];
  const price = formatUsdc(priceUsd);

  return (
    <div className={COLUMNS}>
      <div className="min-w-0 space-y-6">
        {error ? <Notice tone="bad">{error}</Notice> : null}

        {!signedIn ? (
          <>
            <section className={CARD}>
              <h2 className="font-serif text-2xl tracking-tight">Sign in</h2>
              <p className="mt-2 text-base leading-7 text-muted">
                Sign one message with your wallet. It costs nothing and stays signed in for 24 hours.
              </p>
              <Button className="mt-4" type="button" disabled={pending !== null} onClick={() => void onSignIn()}>
                {pending === "sign" ? "Waiting for the wallet…" : "Sign in with wallet"}
              </Button>
            </section>

            <section className={CARD}>
              <h2 className="font-serif text-2xl tracking-tight">Look up an account</h2>
              <form
                className="mt-4 flex flex-col gap-3 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runLookup(lookup);
                }}
              >
                <label className="sr-only" htmlFor="lookup">
                  X handle or wallet address
                </label>
                <Input
                  id="lookup"
                  value={lookup}
                  onChange={(event) => setLookup(event.target.value)}
                  placeholder="@handle or wallet address"
                  autoComplete="off"
                />
                <Button type="submit" variant="outline" disabled={pending !== null}>
                  {pending === "lookup" ? "Looking up…" : "Show plan status"}
                </Button>
              </form>
              {found ? (
                <p className="mt-4 text-base text-ink" aria-live="polite">
                  {found.public
                    ? found.public.pro
                      ? "Pro is active on this account."
                      : "This account is not on Pro."
                    : "No account found."}
                </p>
              ) : null}
            </section>
          </>
        ) : pending === "load" && !account ? (
          <p className="status-wait text-base text-muted">Loading your plan…</p>
        ) : !pro ? (
          <section className={CARD}>
            <h2 className="font-serif text-2xl tracking-tight">No active plan</h2>
            <p className="mt-2 text-base leading-7 text-muted">
              Pro is {price} USDC for {periodDays} days: no daily limit on X, and a DM when a token you watch turns HIGH.
            </p>
            <Button asChild className="mt-4">
              <Link href="/pro">Get Pro for {price} USDC</Link>
            </Button>
          </section>
        ) : (
          <>
            {!linked && account?.linkCode ? (
              <section className={`${CARD} border-accent/50`} aria-live="polite">
                <h2 className="font-serif text-2xl tracking-tight">Link your X account</h2>
                <p className="mt-2 text-base leading-7 text-muted">
                  Send this code as a DM to{" "}
                  <a
                    href={`https://x.com/${botHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-text hover:text-ink"
                  >
                    @{botHandle}
                  </a>{" "}
                  from the X account that should get Pro.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <p className="font-mono text-2xl tracking-wide text-ink">{account.linkCode.code}</p>
                  <CopyButton value={account.linkCode.code} label="Copy code" />
                </div>
                <p className="mt-3 text-base text-faint">Works once. Expires {formatTime(account.linkCode.expiresAt)}.</p>
              </section>
            ) : null}

            <section className={CARD}>
              <h2 className="font-serif text-2xl tracking-tight">Watchlist</h2>
              <p className="mt-2 text-base leading-7 text-muted">Get a DM on X when one of these tokens is rated HIGH.</p>
              <form onSubmit={onAdd} className="mt-4 flex flex-col gap-3 sm:flex-row">
                <label className="sr-only" htmlFor="watch-mint">
                  Token address
                </label>
                <Input
                  id="watch-mint"
                  value={mint}
                  onChange={(event) => setMint(event.target.value)}
                  placeholder="Token address (mint)"
                  autoComplete="off"
                />
                <Button type="submit" disabled={pending !== null || !mint.trim()}>
                  {pending === "add" ? "Saving…" : "Add to watchlist"}
                </Button>
              </form>
              {saved ? (
                <p className="mt-3 text-base text-low" role="status">
                  {saved}
                </p>
              ) : null}
              {watches.length === 0 ? (
                <p className="mt-4 text-base text-faint">No tokens yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-line border-t border-line">
                  {watches.map((watch) => (
                    <li key={watch.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">${watch.symbol}</p>
                        <p className="truncate font-mono text-sm text-faint" title={watch.mint}>
                          {shortMint(watch.mint)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending !== null}
                        onClick={() => void onRemove(watch.mint)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      <aside className="space-y-4">
        <section className={CARD} aria-live="polite">
          <p className="text-base text-faint">Plan</p>
          <p className="mt-1 font-serif text-3xl tracking-tight text-ink">
            {!signedIn ? "Not signed in" : pro ? "Pro" : "Free"}
          </p>
          <dl className="mt-4 space-y-3 text-base">
            {signedIn ? (
              <div>
                <dt className="text-faint">Wallet</dt>
                <dd className="font-mono text-sm text-ink" title={signedIn}>
                  {shortMint(signedIn)}
                </dd>
              </div>
            ) : null}
            {pro && user?.proUntil ? (
              <div>
                <dt className="text-faint">Active until</dt>
                <dd className="text-ink">{formatTime(user.proUntil)}</dd>
              </div>
            ) : null}
            {signedIn && user ? (
              <div>
                <dt className="text-faint">X account</dt>
                <dd className="text-ink">{linked ? `@${user.xHandle}` : "Not linked"}</dd>
              </div>
            ) : null}
            {!signedIn ? (
              <div>
                <dt className="text-faint">Pro</dt>
                <dd className="text-ink">
                  {price} USDC for {periodDays} days
                </dd>
              </div>
            ) : null}
          </dl>
          {signedIn ? (
            <Button className="mt-5" type="button" variant="outline" disabled={pending !== null} onClick={() => void onSignOut()}>
              {pending === "out" ? "Signing out…" : "Sign out"}
            </Button>
          ) : (
            <Button asChild className="mt-5" variant="outline">
              <Link href="/pro">Get Pro</Link>
            </Button>
          )}
        </section>
      </aside>
    </div>
  );
}
