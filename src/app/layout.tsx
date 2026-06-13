import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaClient from "./pwa-client";

export const metadata: Metadata = {
  title: "banqdrop",
  description: "An envelope-native stablecoin account. Money that lands splits itself.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "banqdrop" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
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
