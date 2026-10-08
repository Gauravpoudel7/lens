import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MotionProvider } from "@/components/motion/provider";
import { AsmrBackground } from "@/components/ui/asmr-background";
import { CHECK_COUNT } from "@/content/copy";
import { SITE_URL, X_HANDLE } from "@/lib/site";
import { SPLINE_SCENE } from "@/content/copy";
import { SPLINE_PRELOAD_MEDIA } from "@/lib/landing-budget";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

const TITLE = "Lens: The AI crypto analyst on X that can't lie about its record";
const DESCRIPTION = `Tag @${X_HANDLE} under any Solana token post. Lens runs ${CHECK_COUNT} on-chain checks, replies LOW, MEDIUM, or HIGH in plain English, and proves every answer on Solana before it posts.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, siteName: "Lens", url: "/" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, site: `@${X_HANDLE}`, creator: `@${X_HANDLE}` },
};

export const viewport: Viewport = {
  themeColor: "#050506",
  colorScheme: "dark",
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Lens",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web, X",
  description: DESCRIPTION,
  url: SITE_URL,
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Pro", price: "10", priceCurrency: "USD" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <head>
        <link rel="preconnect" href="https://prod.spline.design" crossOrigin="" />
        {/* Start the 1.3 MB scene with the page only where the hero will show it.
            Reduced motion and viewports under 768px never mount the robot, so they skip the file.
            A matching desktop still preloads from the first HTML byte. */}
        <link rel="preload" href={SPLINE_SCENE} as="fetch" crossOrigin="anonymous" media={SPLINE_PRELOAD_MEDIA} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only z-[70] rounded-full bg-ink px-4 py-2 text-sm font-medium text-canvas focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <AsmrBackground />
        </div>
        <MotionProvider>{children}</MotionProvider>
        <div aria-hidden className="grain" />
      </body>
    </html>
  );
}
