import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaClient from "./pwa-client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const DESCRIPTION =
  "An envelope-native stablecoin account. Deposits auto-split into named buckets by the percentages you set, and a card spends from whichever bucket you pick.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "banqdrop — money that lands splits itself", template: "%s · banqdrop" },
  description: DESCRIPTION,
  applicationName: "banqdrop",
  keywords: ["budgeting", "envelopes", "buckets", "stablecoin", "USDC", "PWA", "neobank"],
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "banqdrop" },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "banqdrop",
    title: "banqdrop — money that lands splits itself",
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "banqdrop" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "banqdrop — money that lands splits itself",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0f1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PwaClient />
        {children}
      </body>
    </html>
  );
}
