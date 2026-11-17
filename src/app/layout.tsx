import type { Metadata, Viewport } from "next";
import { DM_Sans, Nunito } from "next/font/google";
import "./globals.css";

// Headings: Nunito. Body and numbers: DM Sans. Both are variable fonts served by next/font.
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Yakap Bear", template: "%s · Yakap Bear" },
  description:
    "Prototype: a plush bear that helps adults on maintenance mental-health medication take their doses on time — in a loved one's voice.",
};

export const viewport: Viewport = {
  themeColor: "#f8f2e8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${dmSans.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
