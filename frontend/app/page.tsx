import Navbar from "@/components/common/Navbar";
import Hero from "@/components/landing/Hero";
import Categories from "@/components/landing/Categories";
import PromoBanners from "@/components/landing/PromoBanners";
import TrustSection from "@/components/landing/TrustSection";
import HowItWorks from "@/components/landing/HowItWorks";
import Testimonials from "@/components/landing/Testimonials";
import PartnerSection from "@/components/landing/PartnerSection";
import FAQ from "@/components/landing/FAQ";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/common/Footer";
// import SegmentControl from "@/components/landing/SegmentControl";
import StickyNavPill from '@/components/common/StickyNavPill';

export default function Home() {
  return (
    <main className="min-h-screen">
      <StickyNavPill />
      <Navbar />
      {/* <SegmentControl /> */}
      <Hero />
      <Categories />
      <PromoBanners />
      <TrustSection />
      <HowItWorks />
      <Testimonials />
      <PartnerSection />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
