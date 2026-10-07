import Link from "next/link";

export default function NotFound() {
  return (
    <main className="py-16">
      <h1 className="font-serif text-4xl tracking-tight">That page is not in the record.</h1>
      <p className="mt-3 max-w-xl text-base leading-7 text-muted">The check id may be wrong, or it was never saved.</p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink"
      >
        Back to the record
      </Link>
    </main>
  );
}
