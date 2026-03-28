"use client";

import React, { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  items: FAQItem[];
}

const faqData: FAQCategory[] = [
  {
    title: "Sizing",
    items: [
      {
        question: "How do I find my size?",
        answer:
          "We offer four sizes: XS, S, M, and L. To find your perfect fit, measure the widest part of your natural nail bed in millimeters. XS fits nail widths of 10-12mm, S fits 12-14mm, M fits 14-16mm, and L fits 16-18mm. If you are between sizes, we recommend sizing up for a more comfortable fit.",
      },
      {
        question: "What if my nails are different sizes on each hand?",
        answer:
          "This is very common! Each set comes with a range of nail sizes within the chosen size category. Most customers find that one size works well for both hands. If you have significantly different nail widths, feel free to reach out and we can help you find the best option.",
      },
      {
        question: "Can I trim or file the press-on nails?",
        answer:
          "Yes! Our press-on nails can be gently filed to adjust the shape and length to your preference. We recommend using a fine-grit nail file and filing in one direction for the best results.",
      },
    ],
  },
  {
    title: "Shipping",
    items: [
      {
        question: "Where do you ship?",
        answer:
          "We currently ship within the United States only. We are working on expanding to international shipping in the future.",
      },
      {
        question: "How long does shipping take?",
        answer:
          "Orders are processed within 1-2 business days. Standard shipping takes 3-5 business days after processing. You will receive a tracking number via email once your order ships.",
      },
      {
        question: "Is there free shipping?",
        answer:
          "Yes! We offer free standard shipping on all orders over $50. Orders under $50 have a flat shipping rate of $3.99.",
      },
    ],
  },
  {
    title: "Application & Care",
    items: [
      {
        question: "How do I apply press-on nails?",
        answer:
          "Start with clean, dry nails. Push back your cuticles gently, then lightly buff the surface of your natural nails. Apply a thin layer of the included nail glue to both your natural nail and the press-on nail. Press firmly for 10-15 seconds, starting from the cuticle and pressing toward the tip. Avoid water for at least one hour after application.",
      },
      {
        question: "How long do they last?",
        answer:
          "With proper application, our press-on nails typically last 1-2 weeks. Longevity depends on your daily activities and how well the nails are applied. Using the included nail glue (rather than adhesive tabs) will provide the longest wear.",
      },
      {
        question: "How do I remove them safely?",
        answer:
          "Soak your nails in warm soapy water for 10-15 minutes to loosen the adhesive. Gently wiggle each nail side to side -- never force or pull them off, as this can damage your natural nails. You can also use a cuticle oil around the edges to help with removal.",
      },
      {
        question: "Can I reuse press-on nails?",
        answer:
          "Yes, if removed carefully! After removal, gently clean any remaining adhesive from the press-on nails and store them in their original packaging. They can typically be reused 2-3 times with fresh adhesive.",
      },
    ],
  },
  {
    title: "Returns & Exchanges",
    items: [
      {
        question: "What is your return policy?",
        answer:
          "Due to the nature of our products, we cannot accept returns on used press-on nails. However, if your order arrives damaged or you received the wrong item, please contact us within 7 days of delivery and we will make it right.",
      },
      {
        question: "Can I exchange my order for a different size?",
        answer:
          "We are happy to help with exchanges for unused, unopened sets. Please reach out to us within 14 days of receiving your order and we will arrange an exchange.",
      },
      {
        question: "How do I contact customer support?",
        answer:
          "You can reach us via email at hello@presscharm.com. We typically respond within 24 hours during business days.",
      },
    ],
  },
];

function AccordionItem({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-[#E8DDD4]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left"
      >
        <span className="text-sm font-light text-[#2C1810] pr-4">
          {item.question}
        </span>
        <svg
          className={`w-4 h-4 text-[#8B6F5E] flex-shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <div className="pb-4 pr-8">
          <p className="text-sm font-light leading-relaxed text-[#8B6F5E]">
            {item.answer}
          </p>
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      {/* Heading */}
      <div className="text-center mb-14">
        <h1 className="font-heading text-2xl md:text-3xl font-extralight tracking-[0.1em] uppercase text-[#2C1810]">
          Frequently Asked Questions
        </h1>
        <p className="mt-3 text-sm font-light text-[#8B6F5E] tracking-wide">
          Everything you need to know
        </p>
      </div>

      {/* FAQ Categories */}
      <div className="space-y-10">
        {faqData.map((category) => (
          <div key={category.title}>
            <h2 className="font-heading text-base font-light tracking-wide text-[#2C1810] mb-4 pb-2 border-b border-[#C4896F]/40">
              {category.title}
            </h2>
            <div>
              {category.items.map((item, i) => (
                <AccordionItem key={i} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Contact CTA */}
      <div className="mt-16 text-center bg-[#F0E8DF] rounded-lg p-8">
        <h3 className="font-heading text-base font-light tracking-wide text-[#2C1810] mb-2">
          Still have questions?
        </h3>
        <p className="text-sm font-light text-[#8B6F5E]">
          Reach out to us at{" "}
          <a
            href="mailto:hello@presscharm.com"
            className="text-[#C4896F] hover:underline"
          >
            hello@presscharm.com
          </a>
        </p>
      </div>
    </section>
  );
}
