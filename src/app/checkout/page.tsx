"use client";

import React, { useState, useEffect } from "react";
import { useCart } from "@/components/CartProvider";
import { formatPrice, calculateShipping, calculateBulkDiscount, SHIPPING_THRESHOLD } from "@/lib/utils";
import Link from "next/link";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",
  HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",
  KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",
  MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",
  MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",
  NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",
  OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",
  SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",
  VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
};

interface FormData {
  customerName: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
}

export default function CheckoutPage() {
  const { items, getCartTotal } = useCart();
  const [form, setForm] = useState<FormData>({
    customerName: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zipCode: "",
    phone: "",
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Discount from cart page
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [bulkDiscount, setBulkDiscount] = useState(0);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("press-charm-discount");
      if (stored) {
        const parsed = JSON.parse(stored);
        setDiscountCode(parsed.code || null);
        setDiscountAmount(parsed.amount || 0);
        setBulkDiscount(parsed.bulkDiscount || 0);
      }
    } catch {
      // ignore
    }
  }, []);

  const subtotal = getCartTotal();
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const computedBulkDiscount = calculateBulkDiscount(totalQuantity);
  const activeBulkDiscount = computedBulkDiscount || bulkDiscount;
  const shipping = calculateShipping(subtotal - activeBulkDiscount);
  const total = subtotal + shipping - discountAmount - activeBulkDiscount;

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  function validate(): boolean {
    const newErrors: Partial<FormData> = {};
    if (!form.customerName.trim()) newErrors.customerName = "Name is required";
    if (!form.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = "Invalid email";
    if (!form.addressLine1.trim())
      newErrors.addressLine1 = "Address is required";
    if (!form.city.trim()) newErrors.city = "City is required";
    if (!form.state) newErrors.state = "State is required";
    if (!form.zipCode.trim()) newErrors.zipCode = "ZIP code is required";
    else if (!/^\d{5}(-\d{4})?$/.test(form.zipCode))
      newErrors.zipCode = "Invalid ZIP code";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (items.length === 0) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            name: item.name,
            size: item.size,
            quantity: item.quantity,
            price: item.price,
          })),
          shippingAddress: {
            customerName: form.customerName,
            email: form.email,
            phone: form.phone,
            addressLine1: form.addressLine1,
            addressLine2: form.addressLine2,
            city: form.city,
            state: form.state,
            zipCode: form.zipCode,
          },
          discountCode: discountCode || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || "Checkout failed");
        return;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="font-heading text-2xl font-extralight tracking-[0.1em] uppercase text-[#2C1810]">
          Checkout
        </h1>
        <p className="mt-6 text-[#8B6F5E] font-light">
          Your cart is empty.
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

  const inputClass =
    "w-full px-3 py-2.5 text-sm border border-[#E8DDD4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#C4896F] focus:border-[#C4896F] font-light";

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <h1 className="font-heading text-2xl font-extralight tracking-[0.1em] uppercase text-[#2C1810] mb-10">
        Checkout
      </h1>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Shipping Form */}
          <div className="lg:col-span-2 space-y-5">
            <h2 className="text-lg font-light tracking-wide text-[#2C1810] mb-4">
              Shipping Address
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-light text-[#8B6F5E] uppercase tracking-wide mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="customerName"
                  value={form.customerName}
                  onChange={handleChange}
                  className={inputClass}
                />
                {errors.customerName && (
                  <p className="text-xs text-red-500 mt-1">{errors.customerName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-light text-[#8B6F5E] uppercase tracking-wide mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className={inputClass}
                />
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-light text-[#8B6F5E] uppercase tracking-wide mb-1">
                Address Line 1 *
              </label>
              <input
                type="text"
                name="addressLine1"
                value={form.addressLine1}
                onChange={handleChange}
                className={inputClass}
              />
              {errors.addressLine1 && (
                <p className="text-xs text-red-500 mt-1">{errors.addressLine1}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-light text-[#8B6F5E] uppercase tracking-wide mb-1">
                Address Line 2
              </label>
              <input
                type="text"
                name="addressLine2"
                value={form.addressLine2}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-light text-[#8B6F5E] uppercase tracking-wide mb-1">
                  City *
                </label>
                <input
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  className={inputClass}
                />
                {errors.city && (
                  <p className="text-xs text-red-500 mt-1">{errors.city}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-light text-[#8B6F5E] uppercase tracking-wide mb-1">
                  State *
                </label>
                <select
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="">Select state</option>
                  {US_STATES.map((code) => (
                    <option key={code} value={code}>
                      {STATE_NAMES[code]}
                    </option>
                  ))}
                </select>
                {errors.state && (
                  <p className="text-xs text-red-500 mt-1">{errors.state}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-light text-[#8B6F5E] uppercase tracking-wide mb-1">
                  ZIP Code *
                </label>
                <input
                  type="text"
                  name="zipCode"
                  value={form.zipCode}
                  onChange={handleChange}
                  className={inputClass}
                />
                {errors.zipCode && (
                  <p className="text-xs text-red-500 mt-1">{errors.zipCode}</p>
                )}
              </div>
            </div>

            <div className="sm:w-1/2">
              <label className="block text-xs font-light text-[#8B6F5E] uppercase tracking-wide mb-1">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            <p className="text-xs text-[#8B6F5E] font-light pt-2">
              US shipping only. Orders typically ship within 1-2 business days.
            </p>
          </div>

          {/* Order Summary */}
          <div className="bg-[#F0E8DF] rounded-lg p-6 h-fit">
            <h2 className="text-lg font-light tracking-wide text-[#2C1810] mb-6">
              Order Summary
            </h2>

            <div className="space-y-3 mb-6">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.size}`}
                  className="flex justify-between text-sm font-light text-[#8B6F5E]"
                >
                  <span className="truncate pr-4">
                    {item.name} ({item.size}) x{item.quantity}
                  </span>
                  <span className="flex-shrink-0">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-[#E8DDD4] pt-4 space-y-2 text-sm font-light">
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
              {activeBulkDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Bundle Deal ({totalQuantity} sets)</span>
                  <span>-{formatPrice(activeBulkDiscount)}</span>
                </div>
              )}
              {discountCode && discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount ({discountCode})</span>
                  <span>-{formatPrice(discountAmount)}</span>
                </div>
              )}
              <div className="border-t border-[#E8DDD4] pt-2 flex justify-between text-[#2C1810] font-normal">
                <span>Total</span>
                <span>{formatPrice(Math.max(total, 0))}</span>
              </div>
            </div>

            {submitError && (
              <p className="text-sm text-red-500 mt-4">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-6 py-3 text-sm font-light tracking-widest uppercase bg-[#C4896F] text-white rounded-md hover:bg-[#A8705A] transition-colors disabled:opacity-50"
            >
              {submitting ? "Processing..." : "Pay Now"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
