"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

export interface Product {
  id: string;
  name: string;
  price: number; // in cents
  compareAtPrice?: number; // in cents
  images: string[];
  tags?: string[];
  stockXS: number;
  stockS: number;
  stockM: number;
  stockL: number;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { id, name, price, compareAtPrice, images, stockXS, stockS, stockM, stockL } = product;
  const isSoldOut = stockXS === 0 && stockS === 0 && stockM === 0 && stockL === 0;
  const isOnSale = compareAtPrice !== undefined && compareAtPrice > price;
  const thumbnail = images?.[0] ?? "/placeholder.png";

  return (
    <Link href={`/shop/${id}`} className="group block hover-lift">
      <div className="relative overflow-hidden rounded-[2px] bg-[#F0E8DF] aspect-square">
        <Image
          src={thumbnail}
          alt={name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Sale Badge */}
        {isOnSale && !isSoldOut && (
          <span className="absolute top-3 left-3 px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase bg-[#C4896F] text-white rounded">
            Sale
          </span>
        )}

        {/* Sold Out Overlay */}
        {isSoldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#FAF7F2]/70">
            <span className="text-sm font-light tracking-widest uppercase text-[#8B6F5E]">
              Sold Out
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1">
        <h3 className="text-sm font-heading text-[#2C1810] truncate">{name}</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#2C1810]">{formatPrice(price)}</span>
          {isOnSale && (
            <span className="text-xs text-[#8B6F5E] line-through">
              {formatPrice(compareAtPrice)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
