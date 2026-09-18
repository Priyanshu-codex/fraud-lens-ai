import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FraudLens AI — Financial Fraud Intelligence",
    template: "%s | FraudLens AI",
  },
  description:
    "AI-powered transaction risk detection and explainability platform. See the risk. Understand the reason. Decide with confidence.",
  keywords: ["fraud detection", "AI", "machine learning", "financial intelligence"],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
