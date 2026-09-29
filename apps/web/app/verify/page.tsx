import { VerifyForm } from "./verify-form";

export const metadata = { title: "Verify a reply" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ signature?: string; text?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="max-w-2xl py-8">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">Proof check</p>
      <h1 className="mt-2 font-serif text-4xl">Does this text match the chain?</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Paste the exact reply and its signature. Lens recomputes the SHA-256 and compares it with the
        memo. Mock signatures are checked against the local record. Solana signatures are read from
        the configured cluster.
      </p>
      <VerifyForm initialSignature={params.signature ?? ""} initialText={params.text ?? ""} />
    </main>
  );
}
