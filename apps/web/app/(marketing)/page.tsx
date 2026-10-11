import { Nav } from "@/components/landing/sections/nav";
import { Hero } from "@/components/landing/sections/hero";
import { Ecosystem } from "@/components/landing/sections/ecosystem";
import { Problem } from "@/components/landing/sections/problem";
import { Features } from "@/components/landing/sections/features";
import { HowItWorks } from "@/components/landing/sections/how-it-works";
import { Feed } from "@/components/landing/sections/feed";
import { Proof } from "@/components/landing/sections/proof";
import { Stats } from "@/components/landing/sections/stats";
import { Testimonials } from "@/components/landing/sections/testimonials";
import { Pricing } from "@/components/landing/sections/pricing";
import { FinalCta } from "@/components/landing/sections/cta";
import { Footer } from "@/components/landing/sections/footer";
import { Divider } from "@/components/landing/sections/section";
import { CHECK_COUNT } from "@/content/landing/copy";
import { getLandingCopy } from "@/lib/landing-facts";
import { siteOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const { copy, facts, xUrl } = await getLandingCopy();
  const origin = siteOrigin();
  const description = `Tag @${facts.handle} under any Solana token post. Lens runs ${CHECK_COUNT} on-chain checks, replies LOW, MEDIUM, or HIGH in plain English, and proves every answer on Solana before it posts.`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Lens",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web, X",
    description,
    url: origin,
    offers: [
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
      { "@type": "Offer", name: "Pro", price: String(facts.proPriceUsdc), priceCurrency: "USD" },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Nav handle={copy.HANDLE} xUrl={xUrl} />
      <main id="main">
        <Hero />
        <Ecosystem />
        <Problem />
        <Divider />
        <Features />
        <Divider />
        <HowItWorks />
        <Divider />
        <Feed />
        <Divider />
        <Proof />
        <Stats />
        <Divider />
        <Testimonials />
        <Divider />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
