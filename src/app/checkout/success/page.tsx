"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";

interface OrderData {
  orderNumber: string;
  customerName: string;
  email: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  items: {
    name: string;
    size: string;
    quantity: number;
    price: number;
  }[];
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { clearCart } = useCart();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const processedRef = useRef(false);

  useEffect(() => {
    if (!sessionId || processedRef.current) return;
    processedRef.current = true;

    async function createOrder() {
      try {
        const sessionRes = await fetch(
          `/api/checkout/session?session_id=${sessionId}`
        );

        if (!sessionRes.ok) {
          const orderRes = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stripeSessionId: sessionId }),
          });

          if (orderRes.ok) {
            const orderData = await orderRes.json();
            setOrder(orderData);
            clearCart();
            sessionStorage.removeItem("press-charm-discount");
          } else {
            setError(
              "We received your payment. Your order confirmation will be sent to your email."
            );
            clearCart();
            sessionStorage.removeItem("press-charm-discount");
          }
          return;
        }

        const sessionData = await sessionRes.json();
        const meta = sessionData.metadata;

        if (!meta) {
          setError(
            "We received your payment. Your order confirmation will be sent to your email."
          );
          clearCart();
          sessionStorage.removeItem("press-charm-discount");
          return;
        }

        const items = JSON.parse(meta.items || "[]");

        const orderRes = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: meta.customerName,
            email: meta.email,
            phone: meta.phone || "",
            addressLine1: meta.addressLine1,
            addressLine2: meta.addressLine2 || "",
            city: meta.city,
            state: meta.state,
            zipCode: meta.zipCode,
            items,
            discountCode: meta.discountCode || undefined,
            discountAmount: parseInt(meta.discountAmount || "0", 10),
            stripePaymentId: sessionId,
          }),
        });

        if (orderRes.ok) {
          const orderData = await orderRes.json();
          setOrder(orderData);
        } else {
          setError(
            "We received your payment. Your order confirmation will be sent to your email."
          );
        }

        clearCart();
        sessionStorage.removeItem("press-charm-discount");
      } catch {
        setError(
          "We received your payment but could not display your order details. Check your email for confirmation."
        );
        clearCart();
        sessionStorage.removeItem("press-charm-discount");
      } finally {
        setLoading(false);
      }
    }

    createOrder();
  }, [sessionId, clearCart]);

  if (!sessionId) {
    return (
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="font-heading text-2xl font-extralight tracking-[0.1em] uppercase text-[#2C1810]">
          Invalid Session
        </h1>
        <p className="mt-4 text-[#8B6F5E] font-light">
          No checkout session found.
        </p>
        <Link
          href="/shop"
          className="inline-block mt-8 px-8 py-3 text-sm font-light tracking-widest uppercase bg-[#C4896F] text-white rounded-md hover:bg-[#A8705A] transition-colors"
        >
          Continue Shopping
        </Link>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="animate-pulse">
          <div className="h-8 bg-[#F0E8DF] rounded w-1/2 mx-auto mb-4" />
          <div className="h-4 bg-[#F0E8DF] rounded w-1/3 mx-auto" />
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mb-6">
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="font-heading text-2xl md:text-3xl font-extralight tracking-[0.1em] uppercase text-[#2C1810]">
          Thank You for Your Order!
        </h1>
        {order && (
          <p className="mt-3 text-sm font-light text-[#8B6F5E]">
            Order number: <strong className="font-normal">{order.orderNumber}</strong>
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm font-light text-[#8B6F5E]">{error}</p>
        )}
      </div>

      {order && (
        <div className="bg-[#F0E8DF] rounded-lg p-6 md:p-8 mb-8">
          <h2 className="text-lg font-light tracking-wide text-[#2C1810] mb-5">
            Order Details
          </h2>
          <div className="space-y-3 mb-6">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm font-light text-[#8B6F5E]">
                <span>{item.name} ({item.size}) x{item.quantity}</span>
                <span>{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-[#E8DDD4] pt-4 space-y-2 text-sm font-light">
            <div className="flex justify-between text-[#8B6F5E]">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-[#8B6F5E]">
              <span>Shipping</span>
              <span>{order.shipping === 0 ? "Free" : formatPrice(order.shipping)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-{formatPrice(order.discount)}</span>
              </div>
            )}
            <div className="border-t border-[#E8DDD4] pt-2 flex justify-between text-[#2C1810] font-normal">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="text-center">
        <p className="text-sm font-light text-[#8B6F5E] mb-6">
          A confirmation email will be sent to your email address.
        </p>
        <Link
          href="/shop"
          className="inline-block px-8 py-3 text-sm font-light tracking-widest uppercase bg-[#C4896F] text-white rounded-md hover:bg-[#A8705A] transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    </section>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-[#F0E8DF] rounded w-1/2 mx-auto mb-4" />
            <div className="h-4 bg-[#F0E8DF] rounded w-1/3 mx-auto" />
          </div>
        </section>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
