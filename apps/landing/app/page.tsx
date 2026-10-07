import { Nav } from "@/components/sections/nav";
import { Hero } from "@/components/sections/hero";
import { Ecosystem } from "@/components/sections/ecosystem";
import { Problem } from "@/components/sections/problem";
import { Features } from "@/components/sections/features";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Feed } from "@/components/sections/feed";
import { Proof } from "@/components/sections/proof";
import { Stats } from "@/components/sections/stats";
import { Testimonials } from "@/components/sections/testimonials";
import { Pricing } from "@/components/sections/pricing";
import { FinalCta } from "@/components/sections/cta";
import { Footer } from "@/components/sections/footer";
import { Divider } from "@/components/sections/section";

export default function Home() {
  return (
    <>
      <Nav />
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
