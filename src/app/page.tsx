import { Hero } from "@/components/landing/Hero";
import { SiteNav } from "@/components/landing/SiteNav";
import {
  AccountTypesSection,
  CtaBand,
  Faq,
  Features,
  Funding,
  HowItWorks,
  PlatformShowcase,
  SiteFooter,
  StatsBand,
  Testimonials,
  TopTraders,
} from "@/components/landing/Sections";

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <StatsBand />
        <HowItWorks />
        <TopTraders />
        <Features />
        <PlatformShowcase />
        <AccountTypesSection />
        <Funding />
        <Testimonials />
        <Faq />
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
