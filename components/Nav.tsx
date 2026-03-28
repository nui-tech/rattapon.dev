"use client";

import { useEffect, useState } from "react";

const links = [
  { href: "#about", label: "About" },
  { href: "#experience", label: "Experience" },
  { href: "#projects", label: "Projects" },
  { href: "#skills", label: "Skills" },
  { href: "#contact", label: "Contact" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-gray-950/90 backdrop-blur-md border-b border-gray-800/60"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href="#" className="text-cyan-400 font-mono font-bold text-sm tracking-wider">
          rattapon.dev
        </a>
        <div className="hidden sm:flex items-center gap-6">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-gray-400 hover:text-cyan-400 text-sm transition-colors duration-200 font-mono"
            >
              {l.label}
            </a>
          ))}
          <a
            href="/Nui_Rattapon_CV.pdf"
            download
            className="px-4 py-1.5 rounded-lg border border-cyan-500/40 text-cyan-400 text-sm font-mono hover:bg-cyan-500/10 transition-colors duration-200"
          >
            CV ↓
          </a>
        </div>
      </div>
    </nav>
  );
}
