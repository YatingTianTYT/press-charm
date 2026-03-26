"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ProductCard, { Product } from "@/components/ProductCard";
import TagFilter from "@/components/TagFilter";
import SortSelect, { SortOption } from "@/components/SortSelect";

interface ApiProduct {
  id: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  tags: string;
  stockXS: number;
  stockS: number;
  stockM: number;
  stockL: number;
  images: { url: string; position: number }[];
}

function ShopContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialTag = searchParams.get("tag") || "";

  const [products, setProducts] = useState<Product[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    initialTag ? [initialTag] : []
  );
  const [sort, setSort] = useState<SortOption>("newest");
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedTags.length === 1) {
        params.set("tag", selectedTags[0]);
      }
      if (sort) {
        params.set("sort", sort);
      }
      params.set("status", "published");
      const res = await fetch(`/api/products?${params.toString()}`);
      const data: ApiProduct[] = await res.json();

      const formatted: Product[] = data.map((p) => ({
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

      setProducts(formatted);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedTags, sort]);

  // Fetch all products once to extract tags
  useEffect(() => {
    async function loadTags() {
      try {
        const res = await fetch("/api/products?status=published");
        const data: ApiProduct[] = await res.json();
        const tagSet = new Set<string>();
        data.forEach((p) => {
          if (p.tags) {
            p.tags.split(",").forEach((t) => {
              const trimmed = t.trim();
              if (trimmed) tagSet.add(trimmed);
            });
          }
        });
        setAllTags(Array.from(tagSet).sort());
      } catch (err) {
        console.error("Failed to load tags:", err);
      }
    }
    loadTags();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Sync selected tags to URL
  useEffect(() => {
    const tag = selectedTags.length === 1 ? selectedTags[0] : "";
    const params = new URLSearchParams();
    if (tag) params.set("tag", tag);
    const query = params.toString();
    router.replace(`/shop${query ? `?${query}` : ""}`, { scroll: false });
  }, [selectedTags, router]);

  function handleTagToggle(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [tag]
    );
  }

  // Filter products client-side when multiple tags selected
  const filtered =
    selectedTags.length > 1
      ? products.filter((p) =>
          selectedTags.some((t) => p.tags?.includes(t))
        )
      : products;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      {/* Page Header */}
      <div className="text-center mb-10">
        <h1 className="font-heading text-2xl md:text-3xl font-extralight tracking-[0.1em] uppercase text-[#2C1810]">
          Shop All
        </h1>
        <p className="mt-2 text-sm font-light text-[#8B6F5E] tracking-wide">
          Browse our full collection
        </p>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <TagFilter
          tags={allTags}
          selectedTags={selectedTags}
          onTagToggle={handleTagToggle}
        />
        <SortSelect value={sort} onChange={setSort} />
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square bg-[#F0E8DF] rounded-lg" />
              <div className="mt-3 h-4 bg-[#F0E8DF] rounded w-3/4" />
              <div className="mt-2 h-4 bg-[#F0E8DF] rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-[#8B6F5E] font-light">
            No products found. Try a different filter.
          </p>
        </div>
      )}
    </section>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="text-center mb-10">
            <div className="h-8 bg-[#F0E8DF] rounded w-1/4 mx-auto mb-2" />
            <div className="h-4 bg-[#F0E8DF] rounded w-1/6 mx-auto" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-[#F0E8DF] rounded-lg" />
                <div className="mt-3 h-4 bg-[#F0E8DF] rounded w-3/4" />
                <div className="mt-2 h-4 bg-[#F0E8DF] rounded w-1/4" />
              </div>
            ))}
          </div>
        </section>
      }
    >
      <ShopContent />
    </Suspense>
  );
}
