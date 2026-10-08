import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl py-16 text-center">
      <h1 className="font-serif text-4xl tracking-tight">Page not found</h1>
      <p className="mt-3 text-lg leading-7 text-muted">The link may be wrong, or the check was never saved.</p>
      <Button asChild className="mt-6">
        <Link href="/check">Check a token</Link>
      </Button>
    </main>
  );
}
