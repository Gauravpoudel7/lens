"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { CopyButton } from "@/components/copy-button";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkoutReason, checkoutTitle, type CheckoutReason } from "@/lib/checkout-error";
import { formatTime, formatUsdc } from "@/lib/format";

type Session = {
  reference: string;
  amountUsd: number;
  solanaPayUrl?: string;
  recipient?: string;
  splToken?: string;
};

type ConfirmBody = {
  error?: string;
  reason?: string;
  already?: boolean;
  signature?: string;
  tier?: "free" | "pro";
  proUntil?: string | null;
  user?: { xHandle?: string | null; wallet?: string | null; proUntil?: string | null };
};

type WalletProvider = {
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signAndSendTransaction(transaction: unknown): Promise<{ signature: string }>;
};

/** Phantom injects `window.phantom.solana`; other wallets, and older Phantom builds, use `window.solana`. */
function walletProvider(): WalletProvider | null {
  const scope = window as Window & { phantom?: { solana?: WalletProvider }; solana?: WalletProvider };
  const provider = scope.phantom?.solana ?? scope.solana;
  return provider?.signAndSendTransaction ? provider : null;
}

function errorNotice(err: unknown, fallback: string): { reason: CheckoutReason; message: string } {
  const message = err instanceof Error ? err.message : fallback;
  const reason = err instanceof Error && "reason" in err ? String((err as { reason?: string }).reason ?? "") : "";
  return { reason: checkoutReason(message, reason), message };
}

/** Errors thrown by the wallet itself, after the server already checked the reference and balances. */
function walletNotice(err: unknown, network: string): { reason: CheckoutReason; message: string } {
  if (err instanceof Error && "reason" in err) return errorNotice(err, "The payment could not be prepared.");
  const message = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? "");
  const code = (err as { code?: number } | null)?.code;
  if (code === 4001 || /reject|cancel|denied|declined/i.test(message)) {
    return { reason: "rejected", message: "You closed the wallet request. Nothing was sent." };
  }
  if (/blockhash|simulat/i.test(message)) {
    const target = network === "devnet" ? "Devnet" : network === "mainnet-beta" ? "Mainnet" : "the network Lens uses";
    return {
      reason: "wrong_network",
      message: `Your wallet is on a different network. Switch Phantom to ${target} and try again.`,
    };
  }
  return { reason: "other", message: message || "The wallet did not send the payment." };
}

export function ProPanel({
  priceUsd,
  periodDays,
  treasurySet,
  usdcMint,
  ttlHours,
}: {
  priceUsd: number;
  periodDays: number;
  treasurySet: boolean;
  usdcMint: string;
  ttlHours: number;
}) {
  const [wallet, setWallet] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [reference, setReference] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [phase, setPhase] = useState<"edit" | "pay" | "done">("edit");
  const [pending, setPending] = useState<"checkout" | "confirm" | "wallet" | "waiting" | null>(null);
  const [notice, setNotice] = useState<{ reason: CheckoutReason; message: string } | null>(null);
  const [done, setDone] = useState<ConfirmBody | null>(null);
  const [pasted, setPasted] = useState(false);

  useEffect(() => {
    if (phase === "edit" && !notice) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("checkout")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [phase, notice]);

  useEffect(() => {
    const url = session?.solanaPayUrl;
    if (!url) {
      setQr(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(url, {
      margin: 1,
      width: 240,
      color: { dark: "#0e1210", light: "#ffffff" },
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
    const payload = (await response.json()) as { error?: string; reason?: string } & Record<string, unknown>;
    if (!response.ok) {
      const error = new Error(payload.error ?? "Request failed.") as Error & { reason?: string };
      error.reason = payload.reason;
      throw error;
    }
    return payload;
  }

  async function onCheckout(event: React.FormEvent) {
    event.preventDefault();
    setPending("checkout");
    setNotice(null);
    setDone(null);
    try {
      const payload = await post("/api/pro/checkout", { wallet });
      const next = payload.session as Session;
      setSession(next);
      setReference(next.reference);
      setPhase("pay");
    } catch (err) {
      setNotice(errorNotice(err, "Checkout failed."));
    } finally {
      setPending(null);
    }
  }

  async function onPay() {
    if (!session) return;
    const provider = walletProvider();
    if (!provider) {
      setNotice({ reason: "no_wallet", message: "Install Phantom or scan the QR with your phone." });
      return;
    }
    setPending("wallet");
    setNotice(null);
    let network = "";
    try {
      const { publicKey } = await provider.connect();
      const payload = await post("/api/pro/checkout/tx", {
        reference: session.reference,
        account: publicKey.toString(),
      });
      network = String(payload.network ?? "");
      const { Transaction } = await import("@solana/web3.js");
      const bytes = Uint8Array.from(atob(String(payload.transaction)), (char) => char.charCodeAt(0));
      await provider.signAndSendTransaction(Transaction.from(bytes));
    } catch (err) {
      setNotice(walletNotice(err, network));
      setPending(null);
      return;
    }
    setPending("waiting");
    const deadline = Date.now() + 90_000;
    for (;;) {
      try {
        const payload = (await post("/api/pro/confirm", { reference: session.reference })) as ConfirmBody;
        setDone(payload);
        setPhase("done");
        break;
      } catch (err) {
        const next = errorNotice(err, "Verification failed.");
        if (next.reason !== "pending") {
          setNotice(next);
          break;
        }
        if (Date.now() > deadline) {
          setNotice({
            reason: "pending",
            message: "The wallet sent the payment, but Solana has not confirmed it yet. Check the chain again in a minute.",
          });
          break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
    setPending(null);
  }

  async function onConfirm() {
    const ref = reference.trim();
    if (!ref) {
      setNotice({ reason: "not_found", message: "Paste the payment reference." });
      return;
    }
    setPending("confirm");
    setNotice(null);
    try {
      const payload = (await post("/api/pro/confirm", { reference: ref })) as ConfirmBody;
      setDone(payload);
      setPhase("done");
    } catch (err) {
      setNotice(errorNotice(err, "Verification failed."));
      if (session) setPhase("pay");
    } finally {
      setPending(null);
    }
  }

  const accountQuery = new URLSearchParams();
  const paidWallet = done?.user?.wallet ?? wallet.trim();
  if (paidWallet) accountQuery.set("wallet", paidWallet);
  const accountQueryString = accountQuery.toString();
  const accountHref = accountQueryString ? `/account?${accountQueryString}` : "/account";
  const price = formatUsdc(session?.amountUsd ?? priceUsd);

  return (
    <div className="space-y-4">
      {phase === "edit" ? (
        <form onSubmit={onCheckout} className="space-y-4 rounded-2xl border border-line bg-panel p-5">
          <p className="text-sm leading-6 text-muted">
            Pro is {formatUsdc(priceUsd)} USDC for {periodDays} days. Pay from the wallet you will keep. After payment,
            sign once with that wallet on your account page to get a code, then DM it to @justasklens on X to link your
            account.
          </p>
          <div>
            <label className="text-sm text-muted" htmlFor="wallet">
              Wallet
            </label>
            <Input
              id="wallet"
              className="mt-2"
              value={wallet}
              onChange={(event) => setWallet(event.target.value)}
              placeholder="Solana wallet that will send the USDC"
              autoComplete="off"
            />
          </div>
          <p className="text-sm leading-6 text-faint">
            USDC mint <span className="break-all font-mono text-muted">{usdcMint}</span>. There is no password. The
            wallet is how Lens finds the plan.
          </p>
          {!treasurySet ? (
            <Notice tone="bad" title="Payments are not open">
              A payment link cannot be created until the treasury wallet is configured.
            </Notice>
          ) : null}
          {priceUsd <= 0 ? (
            <Notice tone="bad" title="Price not set">
              The Pro price has to be greater than zero before a payment link can be created.
            </Notice>
          ) : null}
          <Button type="submit" disabled={pending !== null || !treasurySet || priceUsd <= 0 || !wallet.trim()}>
            {pending === "checkout" ? "Creating the link…" : "Create Solana Pay link"}
          </Button>
          <div>
            <button type="button" className="text-sm text-accent-text hover:text-ink" onClick={() => setPasted((value) => !value)}>
              {pasted ? "Hide reference check" : "I already have a reference"}
            </button>
            {pasted ? (
              <div className="mt-3 space-y-3">
                <label className="text-sm text-muted" htmlFor="pasted-reference">
                  Payment reference
                </label>
                <Input
                  id="pasted-reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="The reference from the Solana Pay link"
                  autoComplete="off"
                />
                <Button type="button" variant="outline" disabled={pending !== null || !reference.trim()} onClick={onConfirm}>
                  {pending === "confirm" ? "Checking Solana…" : "Check the chain"}
                </Button>
              </div>
            ) : null}
          </div>
        </form>
      ) : null}

      {phase === "pay" && session?.solanaPayUrl ? (
        <section className="space-y-4 rounded-2xl border border-line bg-panel p-5" aria-live="polite">
          <div>
            <h3 className="font-serif text-2xl tracking-tight">Send {price} USDC</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              It pays {session.recipient}. Lens does not hold this USDC. The unpaid link expires after {ttlHours} hours.
            </p>
          </div>
          <Button type="button" disabled={pending !== null} onClick={onPay}>
            {pending === "wallet" ? "Opening the wallet…" : "Pay with Phantom"}
          </Button>
          {pending === "waiting" ? <p className="status-wait text-sm text-med">Waiting for confirmation…</p> : null}
          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-sm text-muted">On your phone? Scan the code with a Solana wallet.</p>
            {qr ? (
              // Data URL from the local qrcode library.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="Solana Pay QR code" width={240} height={240} className="rounded-xl bg-white p-2" />
            ) : (
              <p className="text-sm text-faint">The QR code could not be drawn. Use the link below.</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <CopyButton value={session.solanaPayUrl} label="Copy payment link" />
              <a href={session.solanaPayUrl} className="text-sm text-accent-text hover:text-ink">
                Open in wallet app
              </a>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">Show the payment link</summary>
              <p className="mt-2 break-all font-mono text-xs text-faint">{session.solanaPayUrl}</p>
            </details>
          </div>
          <div>
            <p className="text-sm text-muted">Reference</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="break-all font-mono text-xs">{session.reference}</p>
              <CopyButton value={session.reference} label="Copy reference" />
            </div>
          </div>
          {pending === "confirm" ? <p className="status-wait text-sm text-med">Checking Solana for this reference…</p> : null}
          {notice ? (
            <Notice tone={notice.reason === "pending" ? "wait" : "bad"} title={checkoutTitle(notice.reason)}>
              {notice.message}
            </Notice>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={pending !== null} onClick={onConfirm}>
              {pending === "confirm" ? "Checking Solana…" : "I sent it — check the chain"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPhase("edit");
                setNotice(null);
              }}
            >
              Start over
            </Button>
          </div>
        </section>
      ) : null}

      {phase === "done" && done ? (
        <section className="space-y-3 rounded-2xl border border-low/40 bg-low-bg p-5" aria-live="polite">
          <p className="flex items-center gap-2 font-semibold text-ink">
            <svg viewBox="0 0 24 24" className="proof-draw size-5 text-low" aria-hidden="true">
              <path
                d="M5 12.5 10 17.5 19 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Confirmed on-chain
          </p>
          <p className="text-sm leading-6 text-ink">
            {done.already ? "This payment was already recorded. " : "The USDC transfer matched this reference. "}
            Pro is active
            {done.proUntil ? ` until ${formatTime(done.proUntil)}` : ""}.
          </p>
          {done.signature ? <p className="break-all font-mono text-xs text-muted">{done.signature}</p> : null}
          <p className="text-sm leading-6 text-ink">
            Next, link your X account. Sign with the paying wallet on your account page to get a one-time code, then DM it
            to @justasklens. The code is shown only after that signature.
          </p>
          <Button asChild>
            <Link href={accountHref}>Get my X link code</Link>
          </Button>
        </section>
      ) : null}

      {phase === "edit" && notice ? (
        <Notice tone={notice.reason === "pending" ? "wait" : "bad"} title={checkoutTitle(notice.reason)}>
          {notice.message}
        </Notice>
      ) : null}
    </div>
  );
}
