import type { Metadata } from "next";
import { publicConfig } from "@/lib/public-config";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { xBotHandle } = await publicConfig();
  const description = `Is this Solana token risky? Ask @${xBotHandle} on X or check it here. Every answer is stamped on Solana.`;
  return {
    metadataBase: siteUrl(),
    title: { default: "Lens", template: "%s · Lens" },
    description,
    openGraph: { title: "Lens", description, siteName: "Lens" },
    twitter: { card: "summary_large_image", title: "Lens", description },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
