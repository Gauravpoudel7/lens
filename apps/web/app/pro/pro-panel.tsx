"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Session = {
  reference: string;
  amountUsd: number;
  solanaPayUrl?: string;
  recipient?: string;
  splToken?: string;
};

type Watch = { id: string; mint: string; symbol: string };

export function ProPanel({
  priceUsd,
  periodDays,
  treasurySet,
  usdcMint,
}: {
  priceUsd: number;
  periodDays: number;
  treasurySet: boolean;
  usdcMint: string;
}) {
  const [handle, setHandle] = useState("");
  const [wallet, setWallet] = useState("");
  const [mint, setMint] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [reference, setReference] = useState("");
  const [watches, setWatches] = useState<Watch[]>([]);
  const [tier, setTier] = useState<"free" | "pro" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    const url = session?.solanaPayUrl;
    if (!url) {
      setQr(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(url, {
      margin: 1,
      width: 220,
      color: { dark: "#07080d", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (!cancelled) setQr(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.solanaPayUrl]);

  async function post(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { error?: string } & Record<string, unknown>;
    if (!response.ok) throw new Error(payload.error ?? "Request failed.");
    return payload;
  }

  async function onCheckout(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const payload = await post("/api/pro/checkout", { xHandle: handle, wallet });
      const next = payload.session as Session;
      setSession(next);
      setReference(next.reference);
      setMessage("Send the USDC transfer, then verify the reference.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setPending(false);
    }
  }

  async function onConfirm() {
    setPending(true);
    setError(null);
    try {
      const payload = await post("/api/pro/confirm", { reference });
      setTier("pro");
      setMessage(
        payload.already
          ? "This payment was already recorded. Pro is active."
          : "Payment found on-chain. Pro is active.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setPending(false);
    }
  }

  async function onLoad() {
    setPending(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (handle.trim()) params.set("handle", handle.trim());
      if (wallet.trim()) params.set("wallet", wallet.trim());
      const response = await fetch(`/api/pro/account?${params.toString()}`);
      const payload = (await response.json()) as {
        error?: string;
        watches?: Watch[];
        tier?: "free" | "pro";
        user?: unknown;
      };
      if (!response.ok) throw new Error(payload.error ?? "Could not load the account.");
      setWatches(payload.watches ?? []);
      setTier(payload.user ? (payload.tier ?? "free") : null);
      setMessage(payload.user ? `This account is ${payload.tier}.` : "No account yet. Start a checkout first.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the account.");
    } finally {
      setPending(false);
    }
  }

  async function onWatch(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const payload = await post("/api/pro/watch", { xHandle: handle, wallet, mint });
      setWatches((payload.watches as Watch[]) ?? []);
      setMint("");
      setMessage("Watch saved. A HIGH result on this mint sends a DM.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the watch.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onCheckout} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold">1. Who gets the alerts</h2>
        <label className="block text-sm text-zinc-300" htmlFor="x-handle">
          X handle
        </label>
        <Input
          id="x-handle"
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          placeholder="@yourhandle"
          autoComplete="off"
        />
        <label className="block text-sm text-zinc-300" htmlFor="wallet">
          Wallet
        </label>
        <Input
          id="wallet"
          value={wallet}
          onChange={(event) => setWallet(event.target.value)}
          placeholder="Solana wallet that will pay, or that you already paid from"
          autoComplete="off"
        />
        <p className="text-sm leading-6 text-zinc-400">
          Pro is ${priceUsd.toFixed(2)} USDC for {periodDays} days. The transfer uses Solana Pay: USDC mint{" "}
          <span className="break-all text-zinc-200">{usdcMint}</span>. A unique reference is included so Lens can match
          the payment.
        </p>
        {!treasurySet ? (
          <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="status">
            PRO_TREASURY_WALLET is empty, so checkout cannot start until that wallet is set.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending || !treasurySet}>
            {pending ? "Working…" : "Create a Solana Pay link"}
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={onLoad}>
            Load account
          </Button>
        </div>
      </form>

      {session?.solanaPayUrl ? (
        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold">2. Pay</h2>
          <p className="text-sm leading-6 text-zinc-400">
            Scan the code or open the link in a Solana Pay wallet. It sends {session.amountUsd.toFixed(2)} USDC to{" "}
            {session.recipient}.
          </p>
          {qr ? (
            // Data URL from the local qrcode library, not a remote image.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Solana Pay QR code" width={220} height={220} className="rounded-xl bg-white p-2" />
          ) : null}
          <a className="block break-all text-sm text-emerald-300 hover:text-emerald-200" href={session.solanaPayUrl}>
            {session.solanaPayUrl}
          </a>
          <p className="text-xs text-zinc-500">Reference {session.reference}</p>
        </section>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold">3. Verify the transfer</h2>
        <label className="block text-sm text-zinc-300" htmlFor="reference">
          Payment reference
        </label>
        <Input
          id="reference"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="The reference from the Solana Pay link"
          autoComplete="off"
        />
        <Button type="button" disabled={pending || !reference.trim()} onClick={onConfirm}>
          Check the chain
        </Button>
        {tier ? <p className="text-sm">Status: {tier === "pro" ? "Pro" : "Free"}</p> : null}
      </section>

      <form onSubmit={onWatch} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold">4. Watchlist</h2>
        <p className="text-sm leading-6 text-zinc-400">
          When a watched mint comes back HIGH, Lens sends a DM to the X account on this Pro record. Free accounts
          stay on the daily reply cap and do not get DMs.
        </p>
        <Input
          value={mint}
          onChange={(event) => setMint(event.target.value)}
          placeholder="Token mint to watch"
          autoComplete="off"
        />
        <Button type="submit" disabled={pending}>
          Add to watchlist
        </Button>
        {watches.length === 0 ? (
          <p className="text-sm text-zinc-500">No watches loaded.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {watches.map((watch) => (
              <li key={watch.id} className="border-b border-white/10 pb-2">
                <span className="font-medium">${watch.symbol}</span>{" "}
                <span className="break-all text-zinc-500">{watch.mint}</span>
              </li>
            ))}
          </ul>
        )}
      </form>

      {message ? <p className="text-sm leading-6 text-zinc-200">{message}</p> : null}
      {error ? (
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
