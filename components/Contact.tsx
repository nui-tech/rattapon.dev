"use client";

import { useState } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

export default function Contact() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) return;
    setStatus("sending");

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? "",
          subject: `New message from rattapon.dev — ${form.name}`,
          from_name: form.name,
          // Honeypot — Web3Forms rejects if filled by a bot
          botcheck: "",
          // hCaptcha token — challenge proof
          "h-captcha-response": captchaToken,
          ...form,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("sent");
        setForm({ name: "", email: "", message: "" });
        setCaptchaToken(null);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const canSubmit = !!captchaToken && status !== "sending" && status !== "sent";

  return (
    <section id="contact" className="py-24 px-6 max-w-3xl mx-auto">
      <p className="text-cyan-400 font-mono text-sm mb-3 tracking-widest uppercase">Contact</p>
      <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Let&apos;s work together</h2>
      <p className="text-gray-400 mb-12 max-w-lg">
        I&apos;m currently open to new opportunities. Whether you have a role, a project, or just want to connect
        — reach out and I&apos;ll get back to you promptly.
      </p>

      <div className="grid sm:grid-cols-5 gap-12">
        {/* Form */}
        <form onSubmit={handleSubmit} className="sm:col-span-3 space-y-5">

          {/* Honeypot — hidden from real users, traps bots */}
          <input type="checkbox" name="botcheck" className="hidden" style={{ display: "none" }} readOnly />

          <div>
            <label className="block text-xs font-mono text-gray-500 mb-1.5 uppercase tracking-wider">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-gray-500 mb-1.5 uppercase tracking-wider">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-gray-500 mb-1.5 uppercase tracking-wider">Message</label>
            <textarea
              required
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors resize-none"
              placeholder="What's on your mind?"
            />
          </div>

          {/* hCaptcha */}
          <HCaptcha
            sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? ""}
            onVerify={(token) => setCaptchaToken(token)}
            onExpire={() => setCaptchaToken(null)}
            onError={() => setCaptchaToken(null)}
            theme="dark"
          />

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-gray-950 font-semibold transition-colors duration-200"
          >
            {status === "sending" ? "Sending..." : status === "sent" ? "Message sent ✓" : "Send Message"}
          </button>

          {status === "error" && (
            <p className="text-rose-400 text-sm font-mono">
              Something went wrong. Email me directly at nui@rattapon.dev
            </p>
          )}
        </form>

        {/* Links */}
        <div className="sm:col-span-2 flex flex-col gap-5 justify-start pt-1">
          <a href="mailto:nui@rattapon.dev" className="flex items-center gap-3 text-gray-400 hover:text-cyan-400 transition-colors group">
            <span className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center text-sm group-hover:border-cyan-500/30 transition-colors">✉</span>
            <span className="text-sm font-mono">nui@rattapon.dev</span>
          </a>
          <a href="https://linkedin.com/in/nui-tech" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-gray-400 hover:text-cyan-400 transition-colors group">
            <span className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center text-sm group-hover:border-cyan-500/30 transition-colors">in</span>
            <span className="text-sm font-mono">linkedin.com/in/nui-tech</span>
          </a>
          <a href="https://github.com/nui-tech" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-gray-400 hover:text-cyan-400 transition-colors group">
            <span className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center text-sm group-hover:border-cyan-500/30 transition-colors">⌥</span>
            <span className="text-sm font-mono">github.com/nui-tech</span>
          </a>
          <a href="/Nui_Rattapon_CV.pdf" download className="flex items-center gap-3 text-gray-400 hover:text-cyan-400 transition-colors group mt-2">
            <span className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center text-sm group-hover:border-cyan-500/30 transition-colors">↓</span>
            <span className="text-sm font-mono">Download CV</span>
          </a>
        </div>
      </div>
    </section>
  );
}
