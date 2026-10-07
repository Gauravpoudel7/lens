import { AlertTriangle, BellRing, Cpu, Fingerprint, LineChart, MessageSquareReply } from "lucide-react";
import { GlowCard } from "@/components/motion/glow-card";
import { Reveal } from "@/components/motion/reveal";
import { Section } from "@/components/sections/section";
import { MemoTyper } from "@/components/sections/memo-typer";
import { RiskPill } from "@/components/ui/badge";
import { FEATURES, HERO } from "@/content/copy";

function Tile({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col p-6 md:p-7">
      <Icon className="size-5 text-ink" aria-hidden />
      <h3 className="mt-5 text-lg font-semibold tracking-tight text-ink">{title}</h3>
      <p className="mt-2 max-w-[52ch] text-base leading-relaxed text-body">{body}</p>
      {children && <div className="mt-6 flex-1">{children}</div>}
    </div>
  );
}

function BlinkPreview({ symbol, level }: { symbol: string; level: "LOW" | "HIGH" }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-ink">${symbol}</span>
        <RiskPill level={level} />
      </div>
      {level === "LOW" ? (
        <div className="mt-4 grid grid-cols-3 gap-2" aria-hidden>
          {["0.1", "0.5", "1"].map((a) => (
            <span key={a} className="rounded-lg bg-white/[0.08] py-2 text-center text-xs text-ink">
              Buy {a} SOL
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-high/30 bg-high/10 p-2.5 text-xs leading-snug text-[#fda4af]">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
          HIGH risk. No buy button. Read the report first.
        </div>
      )}
    </div>
  );
}

export function Features() {
  const t = FEATURES.tiles;
  return (
    <Section id="product" title={FEATURES.title}>
      <div className="grid gap-4 [perspective:1200px] md:grid-cols-3">
        <Reveal className="md:col-span-2">
          <GlowCard tilt className="h-full">
            <Tile icon={Fingerprint} title={t.proof.title} body={t.proof.body}>
              <div className="rounded-xl border border-white/10 bg-black/50 p-4">
                <div className="mb-2 text-xs text-faint">Memo written to Solana</div>
                <MemoTyper text={HERO.memo} />
              </div>
            </Tile>
          </GlowCard>
        </Reveal>
        <Reveal delay={0.06}>
          <GlowCard className="h-full">
            <Tile icon={MessageSquareReply} title={t.replies.title} body={t.replies.body}>
              <div className="flex flex-wrap gap-2">
                <RiskPill level="LOW" />
                <RiskPill level="MEDIUM" />
                <RiskPill level="HIGH" />
              </div>
            </Tile>
          </GlowCard>
        </Reveal>
        <Reveal delay={0.04}>
          <GlowCard className="h-full">
            <Tile icon={LineChart} title={t.scorecard.title} body={t.scorecard.body} />
          </GlowCard>
        </Reveal>
        <Reveal delay={0.08}>
          <GlowCard className="h-full">
            <Tile icon={Cpu} title={t.rules.title} body={t.rules.body} />
          </GlowCard>
        </Reveal>
        <Reveal delay={0.12}>
          <GlowCard className="h-full">
            <Tile icon={BellRing} title={t.pro.title} body={t.pro.body} />
          </GlowCard>
        </Reveal>
        <Reveal className="md:col-span-3">
          <GlowCard tilt>
            <div className="grid gap-6 md:grid-cols-[1fr_1.2fr] md:items-center">
              <Tile icon={AlertTriangle} title={t.blink.title} body={t.blink.body} />
              <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2 md:py-7 md:pr-7 md:pl-0">
                <BlinkPreview symbol="SAFE" level="LOW" />
                <BlinkPreview symbol="DANGER" level="HIGH" />
              </div>
            </div>
          </GlowCard>
        </Reveal>
      </div>
    </Section>
  );
}
