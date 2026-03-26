"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import CartDrawer from "@/components/CartDrawer";
import { formatPrice, calculateShipping, calculateBulkDiscount, SHIPPING_THRESHOLD, BULK_DISCOUNT_THRESHOLD, BULK_DISCOUNT_PER_SET } from "@/lib/utils";

export default function CartPage() {
  const { items, updateQuantity, removeFromCart, getCartTotal } = useCart();

  const [discountCode, setDiscountCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountError, setDiscountError] = useState("");
  const [applyingCode, setApplyingCode] = useState(false);

  const subtotal = getCartTotal();
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const bulkDiscount = calculateBulkDiscount(totalQuantity);
  const shipping = calculateShipping(subtotal - bulkDiscount);
  const total = subtotal + shipping - discountAmount - bulkDiscount;

  async function handleApplyDiscount() {
    if (!discountCode.trim()) return;

    setApplyingCode(true);
    setDiscountError("");

    try {
      const res = await fetch("/api/discount/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: discountCode.trim().toUpperCase(),
          subtotal,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.valid) {
        setDiscountError(data.error || "Invalid discount code");
        setDiscountAmount(0);
        setAppliedCode(null);
      } else {
        setDiscountAmount(data.discountAmount);
        setAppliedCode(discountCode.trim().toUpperCase());
        setDiscountError("");
      }
    } catch {
      setDiscountError("Failed to validate code");
    } finally {
      setApplyingCode(false);
    }
  }

  function handleRemoveDiscount() {
    setAppliedCode(null);
    setDiscountAmount(0);
    setDiscountCode("");
    setDiscountError("");
  }

  if (items.length === 0) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="font-heading text-2xl font-extralight tracking-[0.1em] uppercase text-[#2C1810]">
          Your Cart
        </h1>
        <p className="mt-6 text-[#8B6F5E] font-light">Your cart is empty.</p>
        <Link
          href="/shop"
          className="inline-block mt-8 px-8 py-3 text-sm font-light tracking-widest uppercase bg-[#C4896F] text-white rounded-md hover:bg-[#A8705A] transition-colors"
        >
          Continue Shopping
        </Link>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <h1 className="font-heading text-2xl font-extralight tracking-[0.1em] uppercase text-[#2C1810] mb-8">
        Your Cart
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          {items.map((item) => (
            <CartDrawer
              key={`${item.productId}-${item.size}`}
              productId={item.productId}
              name={item.name}
              size={item.size}
              quantity={item.quantity}
              price={item.price}
              image={item.image}
              onUpdateQuantity={updateQuantity}
              onRemove={removeFromCart}
            />
          ))}
        </div>

        {/* Order Summary */}
        <div className="bg-[#F0E8DF] rounded-lg p-6 h-fit">
          <h2 className="text-lg font-light tracking-wide text-[#2C1810] mb-6">
            Order Summary
          </h2>

          <div className="space-y-3 text-sm font-light">
            <div className="flex justify-between text-[#8B6F5E]">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>

            <div className="flex justify-between text-[#8B6F5E]">
              <span>Shipping</span>
              <span>{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
            </div>

            {shipping > 0 && (
              <p className="text-xs text-[#C4896F]">
                Free shipping on orders over {formatPrice(SHIPPING_THRESHOLD)}
              </p>
            )}

            {/* Bulk Discount */}
            {bulkDiscount > 0 ? (
              <div className="flex justify-between text-green-600">
                <span>Bundle Deal ({totalQuantity} sets x {formatPrice(BULK_DISCOUNT_PER_SET)} off)</span>
                <span>-{formatPrice(bulkDiscount)}</span>
              </div>
            ) : (
              <p className="text-xs text-[#C4896F]">
                Buy {BULK_DISCOUNT_THRESHOLD}+ sets and save {formatPrice(BULK_DISCOUNT_PER_SET)} per set!
              </p>
            )}

            {/* Discount */}
            {appliedCode ? (
              <div className="flex justify-between items-center text-green-600">
                <span className="flex items-center gap-2">
                  Discount ({appliedCode})
                  <button
                    onClick={handleRemoveDiscount}
                    className="text-xs text-[#8B6F5E] hover:text-[#2C1810] underline"
                  >
                    Remove
                  </button>
                </span>
                <span>-{formatPrice(discountAmount)}</span>
              </div>
            ) : (
              <div className="pt-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    placeholder="Discount code"
                    className="flex-1 px-3 py-2 text-sm border border-[#E8DDD4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#C4896F] focus:border-[#C4896F]"
                  />
                  <button
                    onClick={handleApplyDiscount}
                    disabled={applyingCode}
                    className="px-4 py-2 text-sm font-light tracking-wide bg-[#2C1810] text-white rounded-md hover:bg-[#8B6F5E] transition-colors disabled:opacity-50"
                  >
                    {applyingCode ? "..." : "Apply"}
                  </button>
                </div>
                {discountError && (
                  <p className="text-xs text-red-500 mt-1">{discountError}</p>
                )}
              </div>
            )}

            <div className="border-t border-[#E8DDD4] pt-3 mt-3 flex justify-between text-[#2C1810] font-normal">
              <span>Total</span>
              <span>{formatPrice(Math.max(total, 0))}</span>
            </div>
          </div>

          <Link
            href={{
              pathname: "/checkout",
              ...(appliedCode
                ? {}
                : {}),
            }}
            onClick={() => {
              // Store discount info in sessionStorage for checkout page
              if (appliedCode || bulkDiscount > 0) {
                sessionStorage.setItem(
                  "press-charm-discount",
                  JSON.stringify({
                    code: appliedCode || null,
                    amount: discountAmount,
                    bulkDiscount,
                  })
                );
              } else {
                sessionStorage.removeItem("press-charm-discount");
              }
            }}
            className="block w-full mt-6 py-3 text-center text-sm font-light tracking-widest uppercase bg-[#C4896F] text-white rounded-md hover:bg-[#A8705A] transition-colors"
          >
            Proceed to Checkout
          </Link>

          <Link
            href="/shop"
            className="block text-center mt-3 text-xs font-light text-[#8B6F5E] hover:text-[#2C1810] transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </section>
  );
}
