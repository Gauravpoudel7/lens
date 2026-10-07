"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/notice";
import { tickerNoticeTitle } from "@/lib/notices";

export function SearchBox() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<{ kind: "notice" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value) {
      setError({ kind: "error", text: "Paste a mint address or a $ticker." });
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
    <form onSubmit={onSubmit} className="mt-8 w-full max-w-2xl">
      <label htmlFor="hero-search" className="text-sm text-muted">
        Mint address or ticker
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="hero-search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Paste a mint or $TICKER"
          disabled={pending}
          className="h-12 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-12 shrink-0 rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink hover:bg-[#62e4ad] disabled:opacity-50"
        >
          {pending ? "Checking…" : "Check this coin"}
        </button>
      </div>
      {error?.kind === "notice" ? (
        <div className="mt-3">
          <Notice tone="info" title={tickerNoticeTitle(error.text)}>
            <p className="whitespace-pre-line">{error.text}</p>
          </Notice>
        </div>
      ) : error ? (
        <p className="mt-3 rounded-xl border border-high/40 bg-high-bg px-3 py-2 text-sm text-high" role="alert">
          {error.text}
        </p>
      ) : (
        <p className="mt-3 text-sm text-faint">The result is added to the public record. Free checks from this site are limited per hour.</p>
      )}
    </form>
  );
}
