"use client";

import React from "react";

interface SizeSelectorProps {
  sizes: { XS: number; S: number; M: number; L: number };
  selectedSize: string | null;
  onSelect: (size: string) => void;
}

const sizeLabels: (keyof SizeSelectorProps["sizes"])[] = ["XS", "S", "M", "L"];

export default function SizeSelector({ sizes, selectedSize, onSelect }: SizeSelectorProps) {
  return (
    <div className="flex gap-2">
      {sizeLabels.map((size) => {
        const stock = sizes[size];
        const isAvailable = stock > 0;
        const isSelected = selectedSize === size;

        return (
          <button
            key={size}
            disabled={!isAvailable}
            onClick={() => onSelect(size)}
            className={`w-12 h-10 rounded-md text-sm font-light transition-colors ${
              !isAvailable
                ? "opacity-40 cursor-not-allowed bg-[#F0E8DF] text-[#E8DDD4] line-through"
                : isSelected
                ? "bg-[#C4896F]/20 border-2 border-[#C4896F] text-[#2C1810]"
                : "bg-[#FAF7F2] border border-[#E8DDD4] text-[#8B6F5E] hover:border-[#C4896F]"
            }`}
          >
            {size}
          </button>
        );
      })}
    </div>
  );
}
