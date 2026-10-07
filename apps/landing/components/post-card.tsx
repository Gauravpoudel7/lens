import { BarChart3, Heart, MessageCircle, Repeat2 } from "lucide-react";
import { ApertureMark } from "@/components/logo";
import { cn } from "@/lib/utils";

type Author = { name: string; handle: string; lens?: boolean };

function Avatar({ author }: { author: Author }) {
  if (author.lens) {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-canvas">
        <ApertureMark className="size-6" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neutral-600 to-neutral-800 text-sm font-semibold text-ink"
    >
      {author.handle.replace(/[^a-z]/gi, "").slice(0, 1).toUpperCase()}
    </span>
  );
}

// Generic social post styled after a timeline post. Not X's branding.
export function PostCard({
  author,
  ago,
  text,
  automated = false,
  threaded = false,
  actions = true,
  children,
  className,
}: {
  author: Author;
  ago: string;
  text: string;
  automated?: boolean;
  threaded?: boolean;
  actions?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("relative flex gap-3", className)}>
      <div className="flex flex-col items-center">
        <Avatar author={author} />
        {threaded && <span aria-hidden className="mt-1 w-px flex-1 bg-white/15" />}
      </div>
      <div className={cn("min-w-0 flex-1", threaded && "pb-5")}>
        <header className="flex flex-wrap items-center gap-x-1.5 text-sm leading-5">
          <span className="font-semibold text-ink">{author.name}</span>
          <span className="text-faint">@{author.handle}</span>
          <span aria-hidden className="text-faint">·</span>
          <span className="text-faint">{ago}</span>
          {automated && (
            <span className="ml-1 rounded border border-white/15 px-1 text-[10px] leading-4 text-faint">Automated</span>
          )}
        </header>
        <p className="mt-1 text-[15.5px] leading-[1.45] whitespace-pre-line text-body">{text}</p>
        {children}
        {actions && (
          <div aria-hidden className="mt-3 flex max-w-xs justify-between text-faint">
            <MessageCircle className="size-4" />
            <Repeat2 className="size-4" />
            <Heart className="size-4" />
            <BarChart3 className="size-4" />
          </div>
        )}
      </div>
    </article>
  );
}
