import React from "react";
import Link from "next/link";
import Image from "next/image";

export default function HeroBanner() {
  return (
    <section className="relative w-full min-h-[90vh] flex items-center bg-gradient-to-br from-[#FAF7F2] via-[#F0E8DF] to-[#E8DDD4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">
          {/* Left side text */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="font-heading text-4xl md:text-6xl text-[#2C1810]">
              Handcrafted Press-On Nails
              <br />
              <span className="font-script text-3xl md:text-5xl">Made with Intention</span>
            </h1>
            <p className="mt-6 text-base md:text-lg text-[#8B6F5E]">
              Each set is hand-painted. No two are exactly alike.
            </p>
            <Link
              href="/shop"
              className="inline-block mt-8 px-8 py-3 text-sm font-light tracking-widest uppercase bg-[#C4896F] text-white rounded-[4px] hover:bg-[#A8705A] transition-colors"
            >
              Shop Now
            </Link>
          </div>

          {/* Right side image */}
          <div className="flex-1 w-full max-w-md aspect-square rounded-[2px] overflow-hidden relative">
            <Image
              src="/hero-nails.jpg"
              alt="Handcrafted press-on nails by Press Charm"
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
