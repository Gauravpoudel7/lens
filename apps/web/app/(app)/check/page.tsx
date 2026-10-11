import Link from "next/link";
import { FIXTURES, SCORECARD_KINDS, type CheckRecord } from "@lens/core";
import { PageShell, SideCard } from "@/components/page-shell";
import { RiskStamp } from "@/components/risk-stamp";
import { CHECK_LIST } from "@/lib/facts";
import { shortMint } from "@/lib/format";
import { publicConfig } from "@/lib/public-config";
import { getRuntime } from "@/lib/runtime";
import { CheckForm } from "./check-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Check a token",
};

async function recentChecks(): Promise<CheckRecord[]> {
  try {
    const rt = await getRuntime();
    return await rt.store.listChecks({ limit: 5, kinds: SCORECARD_KINDS });
  } catch {
    return [];
  }
}

export default async function CheckPage() {
  const [config, recent] = await Promise.all([publicConfig(), recentChecks()]);
  // Fixture mints only exist in mock mode, so the shortcuts are shown only there, and labeled.
  const examples =
    config.dataMode === "mock"
      ? [
          { label: "Demo: HIGH", value: `Just aped $DANGER. CA: ${FIXTURES.danger.mint} LP locked and burned` },
          { label: "Demo: LOW", value: `$${FIXTURES.safe.symbol} ${FIXTURES.safe.mint}` },
          { label: "Demo: MEDIUM", value: FIXTURES.mid.mint },
        ]
      : [];

  return (
    <PageShell
      title="Check a token"
      lede="Paste a token address, a $ticker, or a post from X."
      aside={
        <>
          <SideCard title="What Lens looks at">
            <ul className="list-inside list-disc space-y-1">
              {CHECK_LIST.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </SideCard>
          {recent.length > 0 ? (
            <SideCard title="Latest checks">
              <ul className="divide-y divide-line">
                {recent.map((check) => (
                  <li key={check.id}>
                    <Link href={`/r/${check.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-ink">
                      <span className="min-w-0 truncate text-ink">
                        ${check.tokenSymbol}{" "}
                        <span className="font-mono text-sm text-faint">{shortMint(check.tokenMint)}</span>
                      </span>
                      <RiskStamp level={check.riskLevel} compact />
                    </Link>
                  </li>
                ))}
              </ul>
            </SideCard>
          ) : null}
        </>
      }
    >
      <CheckForm examples={examples} hourlyLimit={config.checkApiLimitPerHour} />
    </PageShell>
  );
}
