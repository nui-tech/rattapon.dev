import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nui Rattapon — Senior Full-Stack Developer",
  description:
    "Senior Full-Stack Web Developer based in Christchurch, New Zealand. 8+ years building web applications with Angular, React, Three.js and Node.js. Three.js / 3D WebGL specialist and AI adoption lead.",
  keywords: [
    "Full-stack developer Christchurch",
    "Three.js developer New Zealand",
    "Angular developer NZ",
    "React developer Christchurch",
    "Senior web developer New Zealand",
    "Nui Rattapon",
  ],
  authors: [{ name: "Nui Rattapon", url: "https://rattapon.dev" }],
  openGraph: {
    title: "Nui Rattapon — Senior Full-Stack Developer",
    description:
      "8+ years building web apps with Angular, React, Three.js. Three.js / 3D WebGL specialist. Based in Christchurch, NZ.",
    url: "https://rattapon.dev",
    siteName: "rattapon.dev",
    locale: "en_NZ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nui Rattapon — Senior Full-Stack Developer",
    description:
      "8+ years building web apps with Angular, React, Three.js. Three.js / 3D WebGL specialist. Based in Christchurch, NZ.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-gray-950 text-gray-100 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
