import Link from "next/link";

export default function NotFound() {
  return (
    <main className="py-16">
      <h1 className="text-4xl font-semibold tracking-tight">That page is not in the record.</h1>
      <p className="mt-3 text-sm text-zinc-400">The check id may be wrong, or it was never saved.</p>
      <Link
        href="/"
        className="mt-5 inline-flex h-11 items-center rounded-full bg-emerald-400 px-5 text-sm font-medium text-black hover:bg-emerald-300"
      >
        Back to the scorecard
      </Link>
    </main>
  );
}
