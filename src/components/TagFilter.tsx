"use client";

import React from "react";

interface TagFilterProps {
  tags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
}

export default function TagFilter({ tags, selectedTags, onTagToggle }: TagFilterProps) {
  const isAllActive = selectedTags.length === 0;

  return (
    <div className="flex flex-wrap gap-2">
      {/* All button */}
      <button
        onClick={() => {
          // Clear all selected tags
          selectedTags.forEach((tag) => onTagToggle(tag));
        }}
        className={`px-4 py-1.5 rounded-full text-xs font-light tracking-wide transition-colors ${
          isAllActive
            ? "bg-[#C4896F] text-white"
            : "bg-[#F0E8DF] text-[#8B6F5E] hover:bg-[#E8DDD4]"
        }`}
      >
        All
      </button>

      {tags.map((tag) => {
        const isActive = selectedTags.includes(tag);
        return (
          <button
            key={tag}
            onClick={() => onTagToggle(tag)}
            className={`px-4 py-1.5 rounded-full text-xs font-light tracking-wide transition-colors ${
              isActive
                ? "bg-[#C4896F] text-white"
                : "bg-[#F0E8DF] text-[#8B6F5E] hover:bg-[#E8DDD4]"
            }`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
