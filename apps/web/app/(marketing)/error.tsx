"use client";

export default function LandingError({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">This page did not load.</h1>
      <p className="mt-3 text-base leading-7 text-body">Something went wrong on our side. Try again in a minute.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 h-11 rounded-full bg-ink px-5 text-sm font-medium text-canvas"
      >
        Try again
      </button>
    </main>
  );
}
