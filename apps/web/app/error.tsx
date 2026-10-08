"use client";

// The error text is not shown: it can be a raw server message. Next logs it on the server.
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl py-16 text-center">
      <h1 className="font-serif text-4xl tracking-tight">This page did not load.</h1>
      <p className="mt-3 text-base leading-7 text-muted">Something went wrong on our side. Try again in a minute.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 h-11 rounded-full bg-accent px-5 text-base font-semibold text-accent-ink"
      >
        Try again
      </button>
    </main>
  );
}
