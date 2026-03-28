"use client";

import React, { useState } from "react";
import Image from "next/image";

interface ImageGalleryClientProps {
  images: string[];
  name: string;
}

export default function ImageGalleryClient({ images, name }: ImageGalleryClientProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <div>
      {/* Main Image */}
      <div className="relative aspect-square rounded-lg overflow-hidden bg-[#F0E8DF]">
        <Image
          src={images[selectedIndex]}
          alt={name}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
          priority
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-3 mt-4">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelectedIndex(i)}
              className={`relative w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                i === selectedIndex
                  ? "border-[#C4896F]"
                  : "border-transparent hover:border-[#C4896F]"
              }`}
            >
              <Image
                src={img}
                alt={`${name} - ${i + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
