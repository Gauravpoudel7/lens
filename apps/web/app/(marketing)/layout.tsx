import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MotionProvider } from "@/components/landing/motion/provider";
import { AsmrBackground } from "@/components/landing/ui/asmr-background";
import { SPLINE_SCENE } from "@/content/landing/copy";
import { SPLINE_PRELOAD_MEDIA } from "@/lib/landing-budget";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#050506",
  colorScheme: "dark",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="landing-root" className={`landing ${sans.variable} ${mono.variable}`}>
      <link rel="preconnect" href="https://prod.spline.design" crossOrigin="anonymous" />
      {/* The 1.3 MB scene starts with the page only where the hero will show it.
          Reduced motion and viewports under 768px never mount the robot. */}
      <link rel="preload" href={SPLINE_SCENE} as="fetch" crossOrigin="anonymous" media={SPLINE_PRELOAD_MEDIA} />
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
    </div>
  );
}
