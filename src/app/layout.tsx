import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "banqdrop",
  description: "An envelope-native stablecoin account. Money that lands splits itself.",
  // Manifest + service worker wired in Phase 8 (PWA).
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
        <div className="mx-auto min-h-screen w-full max-w-md">{children}</div>
      </body>
    </html>
  );
}
