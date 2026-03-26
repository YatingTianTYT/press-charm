"use client";

import React from "react";
import Image from "next/image";
import { FiX } from "react-icons/fi";

interface CartDrawerProps {
  productId: string;
  name: string;
  size: string;
  quantity: number;
  price: number; // in cents
  image: string;
  onUpdateQuantity: (productId: string, size: string, quantity: number) => void;
  onRemove: (productId: string, size: string) => void;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CartDrawer({
  productId,
  name,
  size,
  quantity,
  price,
  image,
  onUpdateQuantity,
  onRemove,
}: CartDrawerProps) {
  const lineTotal = price * quantity;

  return (
    <div className="flex items-center gap-4 py-4 border-b border-[#E8DDD4]">
      {/* Thumbnail */}
      <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-[#F0E8DF]">
        <Image
          src={image}
          alt={name}
          fill
          sizes="64px"
          className="object-cover"
        />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-light text-[#2C1810] truncate">{name}</h4>
        <p className="text-xs text-[#8B6F5E] mt-0.5">Size: {size}</p>
      </div>

      {/* Quantity Selector */}
      <div className="flex items-center border border-[#E8DDD4] rounded">
        <button
          onClick={() => onUpdateQuantity(productId, size, quantity - 1)}
          className="px-2 py-1 text-sm text-[#8B6F5E] hover:text-[#2C1810] transition-colors"
          aria-label="Decrease quantity"
        >
          &minus;
        </button>
        <span className="px-2 py-1 text-sm text-[#2C1810] min-w-[1.5rem] text-center">
          {quantity}
        </span>
        <button
          onClick={() => onUpdateQuantity(productId, size, quantity + 1)}
          className="px-2 py-1 text-sm text-[#8B6F5E] hover:text-[#2C1810] transition-colors"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>

      {/* Line Price */}
      <span className="text-sm text-[#2C1810] w-16 text-right">
        {formatPrice(lineTotal)}
      </span>

      {/* Remove */}
      <button
        onClick={() => onRemove(productId, size)}
        className="p-1 text-[#8B6F5E] hover:text-[#2C1810] transition-colors"
        aria-label="Remove item"
      >
        <FiX className="w-4 h-4" />
      </button>
    </div>
  );
}
