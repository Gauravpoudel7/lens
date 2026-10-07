"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { tickerNoticeTitle } from "@/lib/notices";

export function CheckForm({
  examples,
}: {
  examples: Array<{ label: string; value: string }>;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [wallet, setWallet] = useState("");
  const [error, setError] = useState<{ kind: "notice" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value) {
      setError({ kind: "error", text: "Paste a token address, a $ticker, or the text of a post." });
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: value, wallet: wallet.trim() || undefined }),
      });
      const body = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !body.id) {
        const text = body.error ?? "The check did not finish.";
        setError({ kind: response.status === 422 ? "notice" : "error", text });
        setPending(false);
        return;
      }
      router.push(`/r/${body.id}`);
    } catch {
      setError({ kind: "error", text: "The check request failed. Is the server still running?" });
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl border border-line bg-panel p-5">
      <div>
        <label htmlFor="token-input" className="text-sm text-muted">
          Post text or token address
        </label>
        <Textarea
          id="token-input"
          name="input"
          className="mt-2"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Paste a Solana mint, or a post that names $TICKER"
          disabled={pending}
        />
      </div>
      <div>
        <label htmlFor="pro-wallet" className="text-sm text-muted">
          Pro wallet, optional
        </label>
        <Input
          id="pro-wallet"
          className="mt-2"
          value={wallet}
          onChange={(event) => setWallet(event.target.value)}
          placeholder="The wallet that paid for Pro"
          disabled={pending}
          autoComplete="off"
        />
        <p className="mt-2 text-sm text-faint">This is not a login. It only skips the hourly limit when that wallet is Pro.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {examples.map((example) => (
          <Button
            key={example.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setInput(example.value);
              setError(null);
            }}
          >
            {example.label}
          </Button>
        ))}
      </div>
      {error?.kind === "notice" ? (
        <Notice tone="info" title={tickerNoticeTitle(error.text)}>
          <p className="whitespace-pre-line">{error.text}</p>
        </Notice>
      ) : null}
      {error?.kind === "error" ? <Notice tone="bad">{error.text}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Run the check"}
      </Button>
    </form>
  );
}
