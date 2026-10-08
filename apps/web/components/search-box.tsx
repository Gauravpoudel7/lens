"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { runCheck } from "@/lib/check-client";
import { tickerNoticeTitle } from "@/lib/notices";

export function SearchBox() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<{ kind: "notice" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const outcome = await runCheck(input);
    if ("id" in outcome) {
      router.push(`/r/${outcome.id}`);
      return;
    }
    setError(outcome);
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-8 w-full max-w-2xl text-left">
      <label htmlFor="hero-search" className="sr-only">
        Token address or $ticker
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="hero-search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Token address or $ticker"
          disabled={pending}
          className="h-12 w-full rounded-xl border border-line bg-paper px-4 text-base text-ink outline-none placeholder:text-faint focus-visible:border-ink"
        />
        <Button type="submit" disabled={pending} className="h-12 shrink-0">
          {pending ? "Checking…" : "Check token"}
        </Button>
      </div>
      {error?.kind === "notice" ? (
        <div className="mt-3">
          <Notice tone="info" title={tickerNoticeTitle(error.text)}>
            <p className="whitespace-pre-line">{error.text}</p>
          </Notice>
        </div>
      ) : error ? (
        <div className="mt-3">
          <Notice tone="bad">{error.text}</Notice>
        </div>
      ) : null}
    </form>
  );
}
