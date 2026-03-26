"use client";

import React from "react";

export type SortOption = "newest" | "price-asc" | "price-desc";

interface SortSelectProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const options: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

export default function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortOption)}
      className="appearance-none bg-[#FAF7F2] border border-[#E8DDD4] rounded-md px-3 py-1.5 text-sm font-light text-[#8B6F5E] focus:outline-none focus:ring-1 focus:ring-[#C4896F] focus:border-[#C4896F] cursor-pointer"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
