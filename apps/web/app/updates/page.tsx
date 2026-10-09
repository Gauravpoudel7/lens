import Link from "next/link";
import {
  errorMessage,
  explorerTxUrl,
  logError,
  verifyTextMatchesPayload,
  xStatusUrl,
  type EditorialRecord,
} from "@lens/core";
import { formatTime } from "@/lib/format";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Updates",
  description: "Daily safety tips, crypto terms, and recaps from Lens. Each one is stamped on Solana before it is posted.",
};

const KIND_LABEL: Record<EditorialRecord["kind"], string> = {
  tip: "Safety tip",
  term: "Crypto term",
  recap: "Daily recap",
};

export default async function UpdatesPage() {
  let posts: EditorialRecord[] = [];
  let failed = false;
  try {
    const rt = await getRuntime();
    posts = await rt.store.listEditorial({ status: "posted", limit: 50 });
  } catch (err) {
    logError("updates failed", { detail: errorMessage(err) });
    failed = true;
  }

  return (
    <main className="mx-auto max-w-2xl py-10 sm:py-14">
      <h1 className="font-serif text-4xl tracking-tight">Updates</h1>
      <p className="mt-3 text-lg leading-7 text-muted">
        Daily safety tips, crypto terms, and recaps. Each text was stamped on Solana before it went to X.
      </p>

      {failed ? (
        <p className="mt-8 text-base text-muted">The updates did not load. Try again in a minute.</p>
      ) : posts.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line px-5 py-10">
          <h2 className="font-serif text-2xl">No updates yet</h2>
          <p className="mt-2 text-base leading-7 text-muted">Posted tips, terms, and recaps will show here.</p>
        </div>
      ) : (
        <ol className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {posts.map((post) => (
            <UpdateRow key={post.id} post={post} />
          ))}
        </ol>
      )}
    </main>
  );
}

function UpdateRow({ post }: { post: EditorialRecord }) {
  const check = verifyTextMatchesPayload(post.text, post.payload);
  const onX = xStatusUrl(post.xPostId);
  const explorer = post.txSignature ? explorerTxUrl(post.txSignature, post.cluster) : null;
  const verifyHref = post.txSignature
    ? `/verify?signature=${encodeURIComponent(post.txSignature)}&text=${encodeURIComponent(post.text)}`
    : null;
  const demo = post.cluster === "mock";
  return (
    <li className="px-5 py-5">
      <p className="text-sm text-faint">
        {KIND_LABEL[post.kind]} · {formatTime(post.createdAt)}
        {demo ? " · demo proof" : ""}
      </p>
      <p className="mt-2 whitespace-pre-line text-base leading-7 text-ink">{post.text}</p>
      <p className={`mt-3 text-sm ${check.ok ? "text-low" : "text-high"}`}>
        {check.ok ? "Text matches its proof." : `Text does not match its proof: ${check.reason}`}
      </p>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {onX ? (
          <a href={onX} className="text-accent-text hover:text-ink" target="_blank" rel="noreferrer">
            On X
          </a>
        ) : null}
        {explorer ? (
          <a href={explorer} className="text-accent-text hover:text-ink" target="_blank" rel="noreferrer">
            Proof on Solana
          </a>
        ) : null}
        {verifyHref ? (
          <Link href={verifyHref} className="text-accent-text hover:text-ink">
            Verify
          </Link>
        ) : null}
      </p>
    </li>
  );
}
