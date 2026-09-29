import { VerifyForm } from "./verify-form";

export const metadata = { title: "Verify a reply" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ signature?: string; text?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="max-w-2xl py-10 sm:py-14">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">Proof check</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Does this text match the chain?</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        Paste the exact reply and its signature. Lens recomputes the SHA-256 and compares it with the memo. Mock
        signatures are checked against the local record. Solana signatures are read from the configured cluster.
      </p>
      <VerifyForm initialSignature={params.signature ?? ""} initialText={params.text ?? ""} />
    </main>
  );
}
