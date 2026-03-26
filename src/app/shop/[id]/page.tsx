import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { notFound } from "next/navigation";
import ProductDetailClient from "./ProductDetailClient";
import ImageGalleryClient from "./ImageGalleryClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: {
        orderBy: { position: "asc" },
      },
    },
  });

  if (!product) {
    notFound();
  }

  const images = product.images.map((img) => img.url);
  const tags = product.tags
    ? product.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const isOnSale =
    product.compareAtPrice !== null && product.compareAtPrice > product.price;

  const totalStock =
    product.stockXS + product.stockS + product.stockM + product.stockL;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">
        {/* Image Gallery */}
        <ProductImageGallery images={images} name={product.name} />

        {/* Product Info */}
        <div className="flex flex-col">
          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-[11px] font-light tracking-wide uppercase bg-[#F0E8DF] text-[#8B6F5E] rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Name */}
          <h1 className="font-heading text-2xl md:text-3xl font-light tracking-wide text-[#2C1810]">
            {product.name}
          </h1>

          {/* Price */}
          <div className="flex items-center gap-3 mt-3">
            <span className={`text-xl ${isOnSale ? "text-[#C4896F]" : "text-[#2C1810]"}`}>
              {formatPrice(product.price)}
            </span>
            {isOnSale && product.compareAtPrice && (
              <span className="text-base text-[#8B6F5E] line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
            )}
            {isOnSale && (
              <span className="px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase bg-[#C4896F] text-white rounded">
                Sale
              </span>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <p className="mt-5 text-sm font-light leading-relaxed text-[#8B6F5E]">
              {product.description}
            </p>
          )}

          {/* Stock Info */}
          <p className="mt-4 text-xs font-light text-[#8B6F5E]">
            {totalStock > 0 ? "In Stock" : "Out of Stock"}
          </p>

          {/* Interactive: Size Selector + Add to Cart */}
          <ProductDetailClient
            productId={product.id}
            name={product.name}
            price={product.price}
            image={images[0] ?? "/placeholder.png"}
            sizes={{
              XS: product.stockXS,
              S: product.stockS,
              M: product.stockM,
              L: product.stockL,
            }}
          />
        </div>
      </div>
    </section>
  );
}

/* ---------- Image Gallery (client component) ---------- */
function ProductImageGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  if (images.length === 0) {
    return (
      <div className="aspect-square bg-[#F0E8DF] rounded-lg flex items-center justify-center">
        <span className="text-[#8B6F5E] font-light text-sm">No image</span>
      </div>
    );
  }

  // For server component we show the first image large + thumbnails
  // The client wrapper handles click-to-select interactivity
  return <ImageGalleryClient images={images} name={name} />;
}
