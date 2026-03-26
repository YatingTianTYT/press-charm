import HeroBanner from "@/components/HeroBanner";
import WhyHandmade from "@/components/WhyHandmade";
import FarmersMarket from "@/components/FarmersMarket";
import ProductCard from "@/components/ProductCard";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

const categories = [
  { name: "Classic" },
  { name: "Trendy" },
  { name: "Seasonal" },
  { name: "French" },
  { name: "Art" },
];

export default async function HomePage() {
  const featuredProducts = await prisma.product.findMany({
    where: { featured: true },
    include: {
      images: {
        orderBy: { position: "asc" },
      },
    },
    take: 8,
  });

  const formattedProducts = featuredProducts.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    compareAtPrice: p.compareAtPrice ?? undefined,
    images: p.images.map((img) => img.url),
    tags: p.tags ? p.tags.split(",").map((t) => t.trim()) : [],
    stockXS: p.stockXS,
    stockS: p.stockS,
    stockM: p.stockM,
    stockL: p.stockL,
  }));

  return (
    <>
      {/* Hero */}
      <HeroBanner />

      {/* Why Handmade */}
      <WhyHandmade />

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="font-heading text-2xl md:text-3xl font-extralight tracking-[0.1em] uppercase text-[#2C1810]">
            Featured
          </h2>
          <p className="mt-2 text-sm font-light text-[#8B6F5E] tracking-wide">
            Our most loved designs
          </p>
        </div>

        {formattedProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {formattedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="text-center text-[#8B6F5E] font-light">
            New designs coming soon.
          </p>
        )}

        <div className="text-center mt-10">
          <Link
            href="/shop"
            className="inline-block px-8 py-3 text-sm font-light tracking-widest uppercase border border-[#E8DDD4] text-[#8B6F5E] rounded-md hover:border-[#C4896F] hover:text-[#A8705A] transition-colors"
          >
            View All
          </Link>
        </div>
      </section>

      {/* Farmers Market */}
      <FarmersMarket />

      {/* Shop by Category */}
      <section className="bg-[#F0E8DF] py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-heading text-2xl md:text-3xl font-extralight tracking-[0.1em] uppercase text-[#2C1810]">
              Shop by Category
            </h2>
            <p className="mt-2 text-sm font-light text-[#8B6F5E] tracking-wide">
              Find your perfect style
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.name}
                href={`/shop?tag=${encodeURIComponent(cat.name)}`}
                className="group flex flex-col items-center justify-center py-8 px-4 bg-[#FAF7F2] rounded-lg border border-[#E8DDD4] hover:border-[#C4896F] hover:shadow-sm transition-all"
              >
                <span className="text-2xl mb-3 text-[#C4896F] font-extralight tracking-widest">
                  {cat.name.charAt(0)}
                </span>
                <span className="text-sm font-light tracking-wide text-[#8B6F5E] group-hover:text-[#2C1810] transition-colors">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
