import type { Metadata, Viewport } from "next";
import { Inter, Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { MarketProvider } from "@/components/providers/MarketProvider";
import { Toaster } from "@/components/ui/Toaster";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

const SITE = "https://alphasync.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "AlphaSync — Copy the world's best traders, automatically",
    template: "%s · AlphaSync",
  },
  description:
    "AlphaSync mirrors verified strategy providers straight into your account. Transparent track records, real risk controls, M-Pesa, card and crypto funding, and a full demo desk to practise on.",
  keywords: [
    "copy trading",
    "social trading",
    "forex",
    "ECN account",
    "mirror trading",
    "trading platform",
  ],
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "AlphaSync",
    title: "AlphaSync — Copy the world's best traders, automatically",
    description:
      "Mirror verified strategy providers into your account in one click. Audited track records, real risk controls, instant funding.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AlphaSync — Copy the world's best traders",
    description:
      "Mirror verified strategy providers into your account in one click.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#04060a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased">
        <MarketProvider>
          {children}
          <Toaster />
        </MarketProvider>
      </body>
    </html>
  );
}
