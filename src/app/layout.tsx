import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const description = "Make beautiful screenshots in your browser. Add a window frame, shadow, 3D tilt and background, then download a PNG. Free, no signup, nothing uploaded.";

export const metadata: Metadata = {
  metadataBase: new URL("https://skeu.app"),
  title: "Skeu: free screenshot editor",
  description,
  applicationName: "Skeu",
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Skeu", url: "/", title: "Skeu: free screenshot editor", description },
  twitter: { card: "summary_large_image", title: "Skeu: free screenshot editor", description },
};

// viewport-fit=cover lets the mobile download bar pad itself clear of the iPhone home indicator.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="light" className={inter.variable}><body>{children}<Analytics /></body></html>;
}
