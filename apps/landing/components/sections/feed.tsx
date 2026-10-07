import { Badge, RiskPill } from "@/components/ui/badge";
import { PostCard } from "@/components/post-card";
import { ProofChip } from "@/components/proof-chip";
import { Section } from "@/components/sections/section";
import { PauseRegion } from "@/components/motion/pause-region";
import { FEED, type FeedItem } from "@/content/feed";
import { FEED_COPY } from "@/content/copy";
import { X_HANDLE } from "@/lib/site";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<FeedItem["kind"], string> = {
  reply: "Reply to a tag",
  warning: "Outbound warning",
  call: "Outbound call",
};

function FeedCard({ item }: { item: FeedItem }) {
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
      <PostCard author={{ name: "Lens", handle: X_HANDLE, lens: true }} ago={item.ago} text={item.reply} automated>
        <ProofChip memo={item.memo} signature={item.signature} className="mt-3" />
      </PostCard>
    </div>
  );
}

function Column({ items, speed, className }: { items: FeedItem[]; speed: number; className?: string }) {
  return (
    <div
      className={cn("scroll-col h-[640px] overflow-hidden motion-reduce:h-auto", className)}
      style={{ ["--marquee-speed" as string]: `${speed}s` }}
    >
      <div className="scroll-col-track flex flex-col">
        <div className="flex flex-col gap-4 pb-4">
          {items.map((item, i) => (
            <FeedCard key={i} item={item} />
          ))}
        </div>
        <div className="flex flex-col gap-4 pb-4" aria-hidden data-motion-dup inert>
          {items.map((item, i) => (
            <FeedCard key={i} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Feed() {
  const [safe, mid, danger, warning, call] = FEED;
  return (
    <Section
      id="feed"
      title={FEED_COPY.title}
      tag={<Badge variant="placeholder">Illustrative examples with test tokens</Badge>}
    >
      <PauseRegion label="feed">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Column items={[danger, safe, call]} speed={55} />
          <Column items={[mid, warning, safe]} speed={70} className="hidden md:block" />
          <Column items={[call, danger, mid]} speed={62} className="hidden lg:block" />
        </div>
      </PauseRegion>
    </Section>
  );
}
