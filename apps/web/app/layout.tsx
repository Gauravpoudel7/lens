import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader, Source_Sans_3 } from "next/font/google";
import { ModeNotice } from "@/components/mode-notice";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { publicConfig } from "@/lib/public-config";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source",
  display: "swap",
});

const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { xBotHandle } = await publicConfig();
  const description = `Is this Solana token risky? Ask @${xBotHandle} on X or check it here. Every answer is stamped on Solana.`;
  return {
    title: { default: "Lens", template: "%s · Lens" },
    description,
    openGraph: { title: "Lens", description, siteName: "Lens" },
    twitter: { card: "summary_large_image", title: "Lens", description },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable} ${mono.variable} antialiased`}>
        <a href="#content" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <ModeNotice />
        <div id="content" className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 pb-16 sm:px-6">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
