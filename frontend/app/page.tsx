import Navbar from "@/components/common/Navbar";
import Hero from "@/components/landing/Hero";
import Categories from "@/components/landing/Categories";
import BannerSlot from "@/components/common/BannerSlot";
import TrustSection from "@/components/landing/TrustSection";
import HowItWorks from "@/components/landing/HowItWorks";
import PartnerSection from "@/components/landing/PartnerSection";
import FAQ from "@/components/landing/FAQ";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/common/Footer";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      {/* Dynamic Banner Slot: After Hero */}
      <BannerSlot placement="homepage_after_hero" />

      <Categories />
      {/* Dynamic Banner Slot: After Categories */}
      <BannerSlot placement="homepage_after_categories" />

      <TrustSection />
      {/* Dynamic Banner Slot: After Services / Trust */}
      <BannerSlot placement="homepage_after_services" />

      <HowItWorks />
      <PartnerSection />
      <FAQ />

      {/* Dynamic Banner Slot: Bottom before Footer/FinalCTA */}
      <BannerSlot placement="homepage_bottom" />

      <FinalCTA />
      <Footer />
    </main>
  );
}
