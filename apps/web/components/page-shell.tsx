import type { ReactNode } from "react";

/** Two columns on wide screens: the task on the left, short facts on the right. Stacks on phones. */
export const COLUMNS = "grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10";

export function PageShell({
  title,
  lede,
  aside,
  narrow = false,
  children,
}: {
  title: string;
  lede?: string;
  aside?: ReactNode;
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <main className={`py-10 sm:py-14 ${narrow ? "mx-auto max-w-2xl" : ""}`}>
      <header className="rise max-w-3xl">
        <h1 className="font-serif text-4xl tracking-tight text-ink sm:text-5xl">{title}</h1>
        {lede ? <p className="mt-3 text-lg leading-7 text-muted">{lede}</p> : null}
      </header>
      {aside ? (
        <div className={`mt-8 ${COLUMNS}`}>
          <div className="min-w-0">{children}</div>
          <aside className="space-y-4">{aside}</aside>
        </div>
      ) : (
        <div className="mt-8">{children}</div>
      )}
    </main>
  );
}

export function SideCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="mt-3 text-base leading-7 text-muted">{children}</div>
    </section>
  );
}
