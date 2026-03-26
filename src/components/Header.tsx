"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FiShoppingBag, FiMenu, FiX } from "react-icons/fi";
import { useCart } from "./CartProvider";

const navLinks = [
  { label: "Shop", href: "/shop" },
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
];

export default function Header() {
  const { getCartCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const count = getCartCount();

  return (
    <header className="sticky top-0 z-50 bg-[#FAF7F2]/90 backdrop-blur-sm border-b border-[#E8DDD4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="text-lg font-heading italic tracking-wide text-[#2C1810] hover:text-[#C4896F] transition-colors"
          >
            Press Charm
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-light tracking-wide text-[#8B6F5E] hover:text-[#C4896F] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Cart + Mobile Toggle */}
          <div className="flex items-center gap-4">
            <Link href="/cart" className="relative p-2">
              <FiShoppingBag className="w-5 h-5 text-[#8B6F5E]" />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4.5 h-4.5 text-[10px] font-medium text-white bg-[#B8966A] rounded-full">
                  {count}
                </span>
              )}
            </Link>

            <button
              className="md:hidden p-2"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <FiX className="w-5 h-5 text-[#8B6F5E]" />
              ) : (
                <FiMenu className="w-5 h-5 text-[#8B6F5E]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-[#E8DDD4] bg-[#FAF7F2]">
          <nav className="flex flex-col px-4 py-4 gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="text-sm font-light tracking-wide text-[#8B6F5E] hover:text-[#C4896F] transition-colors py-1"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
