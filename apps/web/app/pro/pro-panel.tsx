"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkoutReason, checkoutTitle, type CheckoutReason } from "@/lib/checkout-error";
import { formatTime, formatUsdc } from "@/lib/format";
import { RequestError, injectedWallet, sendJson, signInWithWallet, walletRejected } from "@/lib/wallet-client";

type Session = {
  reference: string;
  amountUsd: number;
  solanaPayUrl?: string;
  recipient?: string;
};

type Confirmed = {
  already?: boolean;
  signature?: string;
  proUntil?: string | null;
  user?: { wallet?: string | null };
};

type NoticeState = { reason: CheckoutReason; message: string };

const CARD = "space-y-4 rounded-2xl border border-line bg-panel p-5";
const CONFIRM_TIMEOUT_MS = 90_000;
const CONFIRM_EVERY_MS = 3_000;

function networkLabel(network: string): string {
  return network === "devnet" ? "Devnet" : network === "mainnet-beta" ? "Mainnet" : "the payment network";
}

function toNotice(err: unknown, fallback: string): NoticeState {
  if (err instanceof RequestError) return { reason: checkoutReason(err.message, err.reason), message: err.message };
  return { reason: "other", message: fallback };
}

/** Errors thrown by the wallet itself. The server has already checked the reference, balances, and a simulation. */
function walletNotice(err: unknown, network: string): NoticeState {
  if (err instanceof RequestError) return toNotice(err, "The payment could not be prepared. Try again.");
  if (walletRejected(err)) return { reason: "rejected", message: "You closed the wallet request. Nothing was sent." };
  const text = err instanceof Error ? err.message : String((err as { message?: string } | null)?.message ?? "");
  // The same transfer just passed a simulation on the payment network, so a blockhash or simulation failure
  // inside the wallet means the wallet is pointed at a different network.
  if (/blockhash|simulat/i.test(text)) {
    return {
      reason: "wrong_network",
      message: `Phantom is on a different network. Switch Phantom to ${networkLabel(network)}, then try again.`,
    };
  }
  return { reason: "other", message: "The wallet did not send the payment. Try again." };
}

export function ProPanel({
  priceUsd,
  periodDays,
  treasurySet,
  ttlHours,
}: {
  priceUsd: number;
  periodDays: number;
  treasurySet: boolean;
  ttlHours: number;
}) {
  const router = useRouter();
  const [network, setNetwork] = useState("");
  const [mode, setMode] = useState<"wallet" | "phone" | "reference">("wallet");
  const [wallet, setWallet] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [reference, setReference] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [pending, setPending] = useState<"pay" | "waiting" | "link" | "confirm" | "signin" | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [done, setDone] = useState<Confirmed | null>(null);
  const price = formatUsdc(priceUsd);

  useEffect(() => {
    fetch("/api/pro/network")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { network?: string } | null) => setNetwork(body?.network ?? ""))
      .catch(() => setNetwork(""));
  }, []);

  useEffect(() => {
    const url = session?.solanaPayUrl;
    if (!url) {
      setQr(null);
      return;
    }
    let cancelled = false;
    // Loaded only when a phone payment starts, so the page itself stays light.
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#0e1210", light: "#ffffff" } }))
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

  /** Asks the server to look for the transfer until it is confirmed, a real error comes back, or time runs out. */
  async function waitForConfirm(ref: string, patient: boolean): Promise<Confirmed | null> {
    const deadline = Date.now() + (patient ? CONFIRM_TIMEOUT_MS : 0);
    for (;;) {
      try {
        const answer = await sendJson<Confirmed & { reason?: string; error?: string }>("/api/pro/confirm", {
          reference: ref,
        });
        if (answer.reason !== "pending") return answer;
        throw new RequestError(answer.error ?? "No transfer yet.", "pending");
      } catch (err) {
        const next = toNotice(err, "The payment could not be checked. Try again.");
        if (next.reason !== "pending" || Date.now() >= deadline) {
          setNotice(
            next.reason === "pending" && patient
              ? { reason: "pending", message: "Sent, but not confirmed yet. Check again in a minute." }
              : next,
          );
          return null;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, CONFIRM_EVERY_MS));
    }
  }

  /** After paying with the wallet in this browser, one signature signs in, then the account page opens. */
  async function finish(confirmed: Confirmed, signIn: boolean) {
    setDone(confirmed);
    if (!signIn) return;
    setPending("signin");
    try {
      await signInWithWallet();
      router.push("/account");
    } catch {
      // Declining the sign-in is fine: the done card links to the account page, which asks again.
      setPending(null);
    }
  }

  async function onPayWithWallet() {
    const provider = injectedWallet();
    if (!provider?.signAndSendTransaction) {
      setNotice({ reason: "no_wallet", message: "No Solana wallet found. Install Phantom, or pay from your phone." });
      return;
    }
    setPending("pay");
    setNotice(null);
    let ref = "";
    let paidNetwork = network;
    try {
      const address = (await provider.connect()).publicKey.toString();
      setWallet(address);
      const started = await sendJson<{ session: Session }>("/api/pro/checkout", { wallet: address });
      ref = started.session.reference;
      setSession(started.session);
      setReference(ref);
      const built = await sendJson<{ transaction: string; network: string }>("/api/pro/checkout/tx", {
        reference: ref,
        account: address,
      });
      paidNetwork = built.network;
      const { Transaction } = await import("@solana/web3.js");
      const bytes = Uint8Array.from(atob(built.transaction), (char) => char.charCodeAt(0));
      await provider.signAndSendTransaction(Transaction.from(bytes));
    } catch (err) {
      setNotice(walletNotice(err, paidNetwork));
      setPending(null);
      return;
    }
    setPending("waiting");
    const confirmed = await waitForConfirm(ref, true);
    setPending(null);
    if (confirmed) await finish(confirmed, true);
  }

  async function onCreateLink(event: React.FormEvent) {
    event.preventDefault();
    setPending("link");
    setNotice(null);
    try {
      const started = await sendJson<{ session: Session }>("/api/pro/checkout", { wallet: wallet.trim() });
      setSession(started.session);
      setReference(started.session.reference);
    } catch (err) {
      setNotice(toNotice(err, "The payment link could not be created. Try again."));
    } finally {
      setPending(null);
    }
  }

  async function onCheck() {
    const ref = reference.trim();
    if (!ref) {
      setNotice({ reason: "not_found", message: "Paste the payment reference." });
      return;
    }
    setPending("confirm");
    setNotice(null);
    const confirmed = await waitForConfirm(ref, false);
    setPending(null);
    if (confirmed) await finish(confirmed, false);
  }

  const accountHref = done?.user?.wallet ? `/account?wallet=${encodeURIComponent(done.user.wallet)}` : "/account";

  if (done) {
    return (
      <section id="checkout" className="space-y-3 rounded-2xl border border-low/40 bg-low-bg p-5" aria-live="polite">
        <p className="flex items-center gap-2 text-lg font-semibold text-ink">
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
          {done.already ? "Already paid" : "Payment confirmed"}
        </p>
        <p className="text-base leading-7 text-ink">
          Pro is active{done.proUntil ? ` until ${formatTime(done.proUntil)}` : ""}. Next, link your X account.
        </p>
        {pending === "signin" ? (
          <p className="status-wait text-base text-muted">Sign the message in your wallet to open your account…</p>
        ) : (
          <Button asChild>
            <Link href={accountHref}>Go to my account</Link>
          </Button>
        )}
      </section>
    );
  }

  const busy = pending !== null;

  return (
    <div id="checkout" className="scroll-mt-24 space-y-4">
      {!treasurySet ? (
        <Notice tone="wait" title="Payments are not open yet">
          Try again later.
        </Notice>
      ) : null}

      {mode === "wallet" ? (
        <section className={CARD}>
          <h2 className="font-serif text-2xl tracking-tight">Pay in this browser</h2>
          <Button type="button" disabled={busy || !treasurySet} onClick={() => void onPayWithWallet()}>
            {pending === "pay" ? "Waiting for the wallet…" : `Pay ${price} USDC with Phantom`}
          </Button>
          {network ? (
            <p className="text-base text-muted">
              Payments run on Solana {networkLabel(network)}. Unpaid links expire after {ttlHours} hours.
            </p>
          ) : null}
          {pending === "waiting" ? (
            <p className="status-wait text-base text-med" aria-live="polite">
              Waiting for confirmation…
            </p>
          ) : null}
        </section>
      ) : null}

      {mode === "phone" ? (
        <section className={CARD}>
          <h2 className="font-serif text-2xl tracking-tight">Pay from your phone</h2>
          {!session ? (
            <form onSubmit={onCreateLink} className="space-y-3">
              <label className="block text-base text-muted" htmlFor="wallet">
                The wallet address you will pay from
              </label>
              <Input
                id="wallet"
                value={wallet}
                onChange={(event) => setWallet(event.target.value)}
                placeholder="Solana wallet address"
                autoComplete="off"
              />
              <Button type="submit" disabled={busy || !treasurySet || !wallet.trim()}>
                {pending === "link" ? "Creating…" : "Show payment QR code"}
              </Button>
            </form>
          ) : (
            <>
              <p className="text-base text-muted">Scan with a Solana wallet app. It sends {price} USDC.</p>
              {qr ? (
                // Data URL from the local qrcode library.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="Solana Pay QR code" width={240} height={240} className="rounded-xl bg-white p-2" />
              ) : (
                <p className="text-base text-faint">Drawing the QR code…</p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <CopyButton value={session.solanaPayUrl ?? ""} label="Copy payment link" />
                <a href={session.solanaPayUrl} className="text-base text-accent-text hover:text-ink">
                  Open in wallet app
                </a>
              </div>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void onCheck()}>
                {pending === "confirm" ? "Checking…" : "I paid. Check now"}
              </Button>
            </>
          )}
        </section>
      ) : null}

      {mode === "reference" ? (
        <section className={CARD}>
          <h2 className="font-serif text-2xl tracking-tight">Check a payment</h2>
          <label className="block text-base text-muted" htmlFor="reference">
            Payment reference
          </label>
          <Input
            id="reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="The reference from your payment link"
            autoComplete="off"
          />
          <Button type="button" variant="outline" disabled={busy || !reference.trim()} onClick={() => void onCheck()}>
            {pending === "confirm" ? "Checking…" : "Check now"}
          </Button>
        </section>
      ) : null}

      {notice ? (
        <Notice tone={notice.reason === "pending" ? "wait" : "bad"} title={checkoutTitle(notice.reason)}>
          {notice.message}
          {notice.reason === "pending" && reference ? (
            <Button className="mt-3" type="button" size="sm" variant="outline" disabled={busy} onClick={() => void onCheck()}>
              Check again
            </Button>
          ) : null}
        </Notice>
      ) : null}

      {mode === "wallet" && session && !pending ? (
        <p className="text-base text-faint">
          Reference <span className="break-all font-mono text-sm">{session.reference}</span>{" "}
          <CopyButton value={session.reference} label="Copy" />
        </p>
      ) : null}

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-base">
        {mode !== "wallet" ? (
          <button type="button" className="text-accent-text hover:text-ink" onClick={() => setMode("wallet")}>
            Pay in this browser
          </button>
        ) : null}
        {mode !== "phone" ? (
          <button
            type="button"
            className="text-accent-text hover:text-ink"
            onClick={() => {
              setMode("phone");
              setNotice(null);
            }}
          >
            Pay from your phone
          </button>
        ) : null}
        {mode !== "reference" ? (
          <button
            type="button"
            className="text-accent-text hover:text-ink"
            onClick={() => {
              setMode("reference");
              setNotice(null);
            }}
          >
            Already paid? Check a reference
          </button>
        ) : null}
      </div>
      <p className="text-base text-faint">
        {price} USDC for {periodDays} days. Lens never holds your funds.
      </p>
    </div>
  );
}
