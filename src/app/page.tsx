import HeroSection from "@/components/home/HeroSection";
import CollectiveSection from "@/components/home/CollectiveSection";
import FeaturedSection from "@/components/home/FeaturedSection";
import PromiseSection from "@/components/home/PromiseSection";
import ReviewsSection from "@/components/home/ReviewsSection";
import NeedChipsSection from "@/components/home/NeedChipsSection";
import FinalCtaSection from "@/components/home/FinalCtaSection";
import { getProducts } from "@/services/productService";
import type { Product } from "@/types";

export default async function Home() {
  const products: Product[] = await getProducts();
  const featured = products.slice(0, 8);

  return (
    <div className="bg-cream">
      <HeroSection />
      <CollectiveSection />
      <FeaturedSection products={featured} />
      <PromiseSection />
      <ReviewsSection />
      <NeedChipsSection />
      <FinalCtaSection />
    </div>
  );
}
