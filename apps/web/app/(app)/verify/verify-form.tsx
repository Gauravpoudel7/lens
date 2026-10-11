"use client";

import { useState } from "react";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface VerifyBody {
  ok?: boolean;
  reason?: string;
  hash?: string;
  signedAt?: string;
  cluster?: string | null;
  error?: string;
}

export function VerifyForm({
  initialText = "",
  initialSignature = "",
}: {
  initialText?: string;
  initialSignature?: string;
}) {
  const [text, setText] = useState(initialText);
  const [signature, setSignature] = useState(initialSignature);
  const [result, setResult] = useState<VerifyBody | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || !signature.trim()) {
      setResult({ error: "Paste both the exact reply and the signature." });
      return;
    }
    setPending(true);
    setResult(null);
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, signature: signature.trim() }),
      });
      const body = (await response.json().catch(() => ({}))) as VerifyBody;
      setResult(
        response.ok || body.reason
          ? body
          : { error: body.error ?? "Something went wrong on our side. Try again in a minute." },
      );
    } catch {
      setResult({ error: "Lens could not be reached. Check your connection and try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line bg-panel p-5">
      <div>
        <label htmlFor="proof-text" className="text-base text-muted">
          Reply text, exactly as posted
        </label>
        <Textarea id="proof-text" className="mt-2" value={text} onChange={(event) => setText(event.target.value)} />
      </div>
      <div>
        <label htmlFor="proof-sig" className="text-base text-muted">
          Solana transaction signature
        </label>
        <input
          id="proof-sig"
          value={signature}
          onChange={(event) => setSignature(event.target.value)}
          className="mt-2 h-11 w-full rounded-xl border border-line bg-paper px-3 font-mono text-base text-ink outline-none placeholder:text-faint focus-visible:border-ink"
          placeholder="From the report page"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Verify reply"}
      </Button>
      {result?.error ? <Notice tone="bad">{result.error}</Notice> : null}
      {result && !result.error ? (
        <div
          className={`rounded-xl border px-4 py-3 text-base ${
            result.ok ? "border-low/40 bg-low-bg text-low" : "border-high/40 bg-high-bg text-high"
          }`}
          role="status"
        >
          <p className="flex items-center gap-2 font-semibold text-ink">
            {result.ok ? <VerifiedMark /> : null}
            {result.ok ? "Verified" : "No match"}
          </p>
          <p className="mt-1">{result.reason}</p>
          {result.hash ? <p className="mt-2 break-all font-mono text-sm text-ink">{result.hash}</p> : null}
          {result.signedAt ? <p className="mt-1 text-sm text-muted">Stamped {result.signedAt}</p> : null}
          {result.cluster ? <p className="text-sm text-muted">Network {result.cluster}</p> : null}
        </div>
      ) : null}
    </form>
  );
}

function VerifiedMark() {
  return (
    <svg viewBox="0 0 24 24" className="proof-draw size-5" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
