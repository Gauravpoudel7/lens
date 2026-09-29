"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function SearchBox() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value) {
      setError("Paste a mint address or a $ticker.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: value }),
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
    <form onSubmit={onSubmit} className="mt-8 w-full max-w-2xl">
      <label htmlFor="hero-search" className="sr-only">
        Mint address or ticker
      </label>
      <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
          <Search className="size-5 shrink-0 text-zinc-400" aria-hidden />
          <input
            id="hero-search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Paste a mint address or $TICKER"
            disabled={pending}
            className="h-12 w-full bg-transparent text-base text-white outline-none placeholder:text-zinc-500"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="h-12 rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-black hover:bg-emerald-300 disabled:opacity-50"
        >
          {pending ? "Checking…" : "Check token"}
        </button>
      </div>
      {error ? (
        <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">Free checks are rate-limited per hour. The result is added to the public record.</p>
      )}
    </form>
  );
}
