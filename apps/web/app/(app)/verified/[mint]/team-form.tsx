"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeamInfo } from "@lens/core";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequestError, sendJson, signInWithWallet } from "@/lib/wallet-client";

const FIELDS: Array<[keyof TeamInfo, string]> = [
  ["website", "Website"],
  ["xUrl", "X profile"],
  ["telegramUrl", "Telegram"],
  ["auditUrl", "Audit report"],
  ["lockProofUrl", "Liquidity lock proof"],
];

/** For the creator wallet that paid. The server checks the signed-in wallet; this form only collects links. */
export function TeamForm({ mint, initial }: { mint: string; initial: TeamInfo }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<keyof TeamInfo, string>>(() => {
    const start = {} as Record<keyof TeamInfo, string>;
    for (const [field] of FIELDS) start[field] = initial[field] ?? "";
    return start;
  });
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    return sendJson(`/api/verified/${mint}`, values);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      try {
        await save();
      } catch (err) {
        // No session yet: one wallet signature, then save again.
        if (!(err instanceof RequestError) || err.reason !== "signin") throw err;
        await signInWithWallet();
        await save();
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The links were not saved. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="text-base text-accent-text hover:text-ink" onClick={() => setOpen(true)}>
        Team: edit links
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-line bg-panel p-5">
      <h2 className="text-base font-semibold text-ink">Edit team links</h2>
      <p className="text-base text-muted">Sign with the creator wallet that paid. Use full https:// links.</p>
      {FIELDS.map(([field, label]) => (
        <div key={field}>
          <label className="block text-base text-muted" htmlFor={`team-${field}`}>
            {label}
          </label>
          <Input
            id={`team-${field}`}
            type="url"
            inputMode="url"
            value={values[field]}
            onChange={(event) => setValues((prev) => ({ ...prev, [field]: event.target.value }))}
            placeholder="https://"
            autoComplete="off"
          />
        </div>
      ))}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save links"}
      </Button>
      {saved ? <p className="text-base text-low">Saved.</p> : null}
      {error ? (
        <Notice tone="bad" title="Not saved">
          {error}
        </Notice>
      ) : null}
    </form>
  );
}
