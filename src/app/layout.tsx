import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const description = "Put a screenshot in a window, on a background, with a soft shadow. Copy it or download a PNG, JPG or WebP. It all happens in your browser.";

export const metadata: Metadata = {
  metadataBase: new URL("https://skeu.app"),
  title: "Skeu: make beautiful screenshots",
  description,
  applicationName: "Skeu",
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Skeu", url: "/", title: "Skeu: make beautiful screenshots", description },
  twitter: { card: "summary_large_image", title: "Skeu: make beautiful screenshots", description },
  // Skeu has no dark theme yet, so dark-mode extensions mustn't repaint it: they'd change the colors you're picking.
  other: { "darkreader-lock": "true" },
};

// viewport-fit=cover lets the mobile download bar pad itself clear of the iPhone home indicator.
// "only light" keeps browsers (Chrome's auto dark mode) from darkening the page, swatches and previews included.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", colorScheme: "only light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="light" className={inter.variable}><body>{children}<Analytics /></body></html>;
}
