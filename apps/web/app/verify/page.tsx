import { PageHeader } from "@/components/page-header";
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
      <PageHeader
        kicker="Verify"
        title="Does this text match the stamp?"
        lede="Paste the exact reply and its signature. Lens recomputes the SHA-256 and compares it with the memo. One changed character fails."
      />
      <VerifyForm initialSignature={params.signature ?? ""} initialText={params.text ?? ""} />
    </main>
  );
}
