"use client";

import { useState } from "react";
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

export function VerifyForm({ initialText = "", initialSignature = "" }: { initialText?: string; initialSignature?: string }) {
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
      const body = (await response.json()) as VerifyBody;
      setResult(body);
    } catch {
      setResult({ error: "Verification request failed." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
      <label htmlFor="proof-text" className="text-sm">
        Exact reply text
      </label>
      <Textarea id="proof-text" value={text} onChange={(event) => setText(event.target.value)} />
      <label htmlFor="proof-sig" className="text-sm">
        Transaction signature
      </label>
      <input
        id="proof-sig"
        value={signature}
        onChange={(event) => setSignature(event.target.value)}
        className="h-10 w-full rounded-sm border border-line bg-paper-2 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
        placeholder="mock_… or a Solana signature"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Verify"}
      </Button>
      {result?.error ? (
        <p className="border border-high/30 bg-[#f8e8e4] px-3 py-2 text-sm text-high" role="alert">
          {result.error}
        </p>
      ) : null}
      {result && !result.error ? (
        <div
          className={`border px-3 py-3 text-sm ${result.ok ? "border-low/40 text-low" : "border-high/30 text-high"}`}
          role="status"
        >
          <p className="font-medium">{result.ok ? "Match" : "No match"}</p>
          <p className="mt-1">{result.reason}</p>
          {result.hash ? <p className="mt-2 break-all font-mono text-xs text-ink">{result.hash}</p> : null}
          {result.signedAt ? <p className="mt-1 text-xs text-muted">Memo time {result.signedAt}</p> : null}
          {result.cluster ? <p className="text-xs text-muted">Cluster {result.cluster}</p> : null}
        </div>
      ) : null}
    </form>
  );
}
