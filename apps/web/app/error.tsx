"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="py-16">
      <h1 className="text-4xl font-semibold tracking-tight">The page could not be loaded.</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 h-11 rounded-full bg-emerald-400 px-5 text-sm font-medium text-black hover:bg-emerald-300"
      >
        Try again
      </button>
    </main>
  );
}
