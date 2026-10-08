import { PageShell } from "@/components/page-shell";
import { VerifyForm } from "./verify-form";

export const metadata = { title: "Verify a reply" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ signature?: string; text?: string }>;
}) {
  const params = await searchParams;
  return (
    <PageShell
      narrow
      title="Verify a reply"
      lede="Paste a reply and its Solana signature. One changed character fails."
    >
      <VerifyForm initialSignature={params.signature ?? ""} initialText={params.text ?? ""} />
    </PageShell>
  );
}
