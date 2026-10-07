import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string;
  title: string;
  lede: string;
  children?: ReactNode;
}) {
  return (
    <header className="rise max-w-2xl">
      <p className="text-sm font-medium text-accent-text">{kicker}</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight text-ink sm:text-5xl">{title}</h1>
      <p className="mt-3 text-lg leading-7 text-muted">{lede}</p>
      {children}
    </header>
  );
}
