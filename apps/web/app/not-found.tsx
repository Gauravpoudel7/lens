import Link from "next/link";

export default function NotFound() {
  return (
    <main className="py-12">
      <h1 className="font-serif text-4xl">That page is not in the record.</h1>
      <p className="mt-3 text-sm text-muted">The check id may be wrong, or it was never saved.</p>
      <Link href="/" className="mt-4 inline-block text-sm underline">
        Back to the scorecard
      </Link>
    </main>
  );
}
