import { Badge } from "@/components/landing/ui/badge";
import { Marquee } from "@/components/landing/motion/marquee";
import { PostCard } from "@/components/landing/post-card";
import { Section } from "@/components/landing/sections/section";
import { PLACEHOLDER_TESTIMONIALS } from "@/content/landing/placeholders";

function Quote({ t }: { t: (typeof PLACEHOLDER_TESTIMONIALS)[number] }) {
  return (
    <div className="panel mx-2 w-[320px] shrink-0 rounded-2xl p-5 md:w-[360px]">
      <PostCard author={{ name: t.name, handle: t.handle }} ago="1d" text={t.text} />
    </div>
  );
}

export function Testimonials() {
  return (
    <Section
      id="voices"
      title="What traders are saying."
      tag={<Badge variant="placeholder">Sample, replace with real posts</Badge>}
    >
      <Marquee label="sample posts" speed={50}>
        {PLACEHOLDER_TESTIMONIALS.map((t) => (
          <Quote key={t.handle} t={t} />
        ))}
      </Marquee>
    </Section>
  );
}
