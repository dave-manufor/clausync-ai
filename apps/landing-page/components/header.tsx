"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Menu, X, Sparkles } from "lucide-react";

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-[#08041E]/80 backdrop-blur-md border-b border-[rgba(191,192,255,0.1)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4">
        <nav className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5814BA] to-[#A17CFF] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-white">
              ClauSync<span className="text-[#A17CFF]">.ai</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <NavLink href="#features">Features</NavLink>
            <NavLink href="#how-it-works">How It Works</NavLink>
            <NavLink href="#pricing">Pricing</NavLink>
            <NavLink href="#testimonials">Testimonials</NavLink>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="#"
              className="text-[rgba(255,255,255,0.7)] hover:text-white transition-colors text-sm font-medium"
            >
              Sign In
            </Link>
            <Link
              href="#get-started"
              className="btn-primary text-sm py-2.5 px-5"
            >
              Get Started Free
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </nav>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden pt-6 pb-4 border-t border-[rgba(191,192,255,0.1)] mt-4"
          >
            <div className="flex flex-col gap-4">
              <MobileNavLink href="#features" onClick={() => setIsMobileMenuOpen(false)}>Features</MobileNavLink>
              <MobileNavLink href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)}>How It Works</MobileNavLink>
              <MobileNavLink href="#pricing" onClick={() => setIsMobileMenuOpen(false)}>Pricing</MobileNavLink>
              <MobileNavLink href="#testimonials" onClick={() => setIsMobileMenuOpen(false)}>Testimonials</MobileNavLink>
              <div className="pt-4 border-t border-[rgba(191,192,255,0.1)] flex flex-col gap-3">
                <Link href="#" className="text-[rgba(255,255,255,0.7)] text-center py-2">
                  Sign In
                </Link>
                <Link href="#get-started" className="btn-primary text-center">
                  Get Started Free
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[rgba(255,255,255,0.7)] hover:text-white transition-colors text-sm font-medium relative group"
    >
      {children}
      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#A17CFF] transition-all duration-300 group-hover:w-full" />
    </Link>
  );
}

function MobileNavLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="text-[rgba(255,255,255,0.7)] hover:text-white transition-colors text-base font-medium py-2"
    >
      {children}
    </Link>
  );
}
