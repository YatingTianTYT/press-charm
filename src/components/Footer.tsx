import React from "react";
import Link from "next/link";
import { FiInstagram } from "react-icons/fi";

const navLinks = [
  { label: "Shop", href: "/shop" },
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
];

export default function Footer() {
  return (
    <footer className="bg-[#F0E8DF] border-t border-[#E8DDD4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="text-center md:text-left">
            <p className="text-lg font-heading tracking-wide text-[#2C1810]">
              Press Charm
            </p>
            <p className="font-script text-sm text-[#8B6F5E] mt-1">
              Handmade with love
            </p>
            <p className="text-xs text-[#8B6F5E] mt-1">
              &copy; 2024 Press Charm. All rights reserved.
            </p>
          </div>

          {/* Nav Links */}
          <nav className="flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-light text-[#8B6F5E] hover:text-[#C4896F] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Social */}
          <a
            href="#"
            className="text-[#8B6F5E] hover:text-[#C4896F] transition-colors"
            aria-label="Instagram"
          >
            <FiInstagram className="w-5 h-5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
