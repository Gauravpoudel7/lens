"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CheckForm({
  examples,
}: {
  examples: Array<{ label: string; value: string }>;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [wallet, setWallet] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value) {
      setError("Paste a token address, a $ticker, or the text of a post.");
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
        setError(body.error ?? "The check did not finish.");
        setPending(false);
        return;
      }
      router.push(`/r/${body.id}`);
    } catch {
      setError("The check request failed. Is the server still running?");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <label htmlFor="token-input" className="text-sm text-zinc-300">
        Post text or token address
      </label>
      <Textarea
        id="token-input"
        name="input"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="CA: paste a Solana mint, or a post that says $TICKER"
        disabled={pending}
      />
      <label htmlFor="pro-wallet" className="text-sm text-zinc-300">
        Paying wallet, optional
      </label>
      <Input
        id="pro-wallet"
        value={wallet}
        onChange={(event) => setWallet(event.target.value)}
        placeholder="Pro wallet skips the hourly limit"
        disabled={pending}
        autoComplete="off"
      />
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
      {error ? (
        <p className="whitespace-pre-line rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Run the check"}
      </Button>
    </form>
  );
}
