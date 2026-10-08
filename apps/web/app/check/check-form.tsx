"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { runCheck } from "@/lib/check-client";
import { tickerNoticeTitle } from "@/lib/notices";

export function CheckForm({
  examples,
  hourlyLimit,
}: {
  examples: Array<{ label: string; value: string }>;
  hourlyLimit: number;
}) {
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
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line bg-panel p-5">
      <div>
        <label htmlFor="token-input" className="text-base text-muted">
          Token address (mint), $ticker, or post text
        </label>
        <Textarea
          id="token-input"
          name="input"
          className="mt-2"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="e.g. $BONK, or a token address"
          disabled={pending}
        />
      </div>
      {examples.length > 0 ? (
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
      ) : null}
      {error?.kind === "notice" ? (
        <Notice tone="info" title={tickerNoticeTitle(error.text)}>
          <p className="whitespace-pre-line">{error.text}</p>
        </Notice>
      ) : null}
      {error?.kind === "error" ? <Notice tone="bad">{error.text}</Notice> : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Checking…" : "Check token"}
        </Button>
        <p className="text-base text-faint">Free: {hourlyLimit} checks an hour.</p>
      </div>
    </form>
  );
}
