"use client";

import React, { useState } from "react";
import SizeSelector from "@/components/SizeSelector";
import { useCart } from "@/components/CartProvider";

interface ProductDetailClientProps {
  productId: string;
  name: string;
  price: number;
  image: string;
  sizes: { XS: number; S: number; M: number; L: number };
}

export default function ProductDetailClient({
  productId,
  name,
  price,
  image,
  sizes,
}: ProductDetailClientProps) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const { addToCart } = useCart();

  const totalStock = sizes.XS + sizes.S + sizes.M + sizes.L;

  function handleAddToCart() {
    if (!selectedSize) return;

    addToCart({
      productId,
      name,
      size: selectedSize,
      quantity: 1,
      price,
      image,
    });

    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="mt-6 space-y-5">
      {/* Size Selector */}
      <div>
        <label className="block text-xs font-light tracking-wide text-[#8B6F5E] uppercase mb-2">
          Size
        </label>
        <SizeSelector
          sizes={sizes}
          selectedSize={selectedSize}
          onSelect={setSelectedSize}
        />
      </div>

      {/* Add to Cart */}
      <button
        onClick={handleAddToCart}
        disabled={!selectedSize || totalStock === 0}
        className={`w-full py-3 rounded-[4px] text-sm font-light tracking-widest uppercase transition-colors ${
          !selectedSize || totalStock === 0
            ? "bg-[#E8DDD4] text-[#8B6F5E] cursor-not-allowed"
            : added
            ? "bg-green-500 text-white"
            : "bg-[#C4896F] text-white hover:bg-[#A8705A]"
        }`}
      >
        {totalStock === 0
          ? "Sold Out"
          : added
          ? "Added!"
          : !selectedSize
          ? "Select a Size"
          : "Add to Cart"}
      </button>
    </div>
  );
}
