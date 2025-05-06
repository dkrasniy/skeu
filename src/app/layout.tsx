import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react"

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "skeu.app",
  description: "Beautiful screenshots for your work",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <Analytics/>
      <body
        className={`${dmSans.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
