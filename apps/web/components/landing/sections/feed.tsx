import { Badge, RiskPill } from "@/components/landing/ui/badge";
import { PostCard } from "@/components/landing/post-card";
import { ProofChip } from "@/components/landing/proof-chip";
import { Section } from "@/components/landing/sections/section";
import { PauseRegion } from "@/components/landing/motion/pause-region";
import { FEED, type FeedItem } from "@/content/landing/feed";
import { FEED_COPY } from "@/content/landing/copy";
import { getLandingCopy } from "@/lib/landing-facts";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<FeedItem["kind"], string> = {
  reply: "Reply to a tag",
  warning: "Outbound warning",
  call: "Outbound call",
};

function FeedCard({ item, handle, cluster }: { item: FeedItem; handle: string; cluster: string }) {
  return (
    <div className="panel rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between gap-2 text-xs text-faint">
        <span>{KIND_LABEL[item.kind]}</span>
        <RiskPill level={item.risk} />
      </div>
      {item.post && (
        <PostCard
          author={{ name: item.post.name, handle: item.post.handle }}
          ago={item.post.ago}
          text={item.post.text}
          actions={false}
          threaded
        />
      )}
      <PostCard author={{ name: "Lens", handle, lens: true }} ago={item.ago} text={item.reply} automated>
        <ProofChip memo={item.memo} signature={item.signature} cluster={cluster} className="mt-3" />
      </PostCard>
    </div>
  );
}

function Column({
  items,
  speed,
  className,
  handle,
  cluster,
}: {
  items: FeedItem[];
  speed: number;
  className?: string;
  handle: string;
  cluster: string;
}) {
  return (
    <div
      className={cn("scroll-col h-[640px] overflow-hidden motion-reduce:h-auto", className)}
      style={{ ["--marquee-speed" as string]: `${speed}s` }}
    >
      <div className="scroll-col-track flex flex-col">
        <div className="flex flex-col gap-4 pb-4">
          {items.map((item, i) => (
            <FeedCard key={i} item={item} handle={handle} cluster={cluster} />
          ))}
        </div>
        <div className="flex flex-col gap-4 pb-4" aria-hidden data-motion-dup inert>
          {items.map((item, i) => (
            <FeedCard key={i} item={item} handle={handle} cluster={cluster} />
          ))}
        </div>
      </div>
    </div>
  );
}

export async function Feed() {
  const { facts } = await getLandingCopy();
  const [safe, mid, danger, warning, call] = FEED;
  const column = { handle: facts.handle, cluster: facts.proofCluster };
  return (
    <Section
      id="feed"
      title={FEED_COPY.title}
      tag={<Badge variant="placeholder">Illustrative examples with test tokens</Badge>}
    >
      <PauseRegion label="feed">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Column items={[danger, safe, call]} speed={55} {...column} />
          <Column items={[mid, warning, safe]} speed={70} className="hidden md:block" {...column} />
          <Column items={[call, danger, mid]} speed={62} className="hidden lg:block" {...column} />
        </div>
      </PauseRegion>
    </Section>
  );
}
