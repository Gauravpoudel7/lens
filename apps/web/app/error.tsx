"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="py-16">
      <h1 className="font-serif text-4xl tracking-tight">The page could not be loaded.</h1>
      <p className="mt-3 max-w-xl text-base leading-7 text-muted">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink"
      >
        Try again
      </button>
    </main>
  );
}
