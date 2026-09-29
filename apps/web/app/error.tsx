"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="py-12">
      <h1 className="font-serif text-4xl">The page could not be loaded.</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted">{error.message}</p>
      <button type="button" onClick={reset} className="mt-4 text-sm underline">
        Try again
      </button>
    </main>
  );
}
