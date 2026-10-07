import type { Metadata } from "next";
import { Vectorizer } from "@/components/vectorizer";

const title = "Vectorize: turn an image into an SVG";
const description = "Trace a PNG or JPEG into an SVG you can scale to any size, recolor and edit. It runs in your browser, so the image never leaves your device.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/vectorize" },
  openGraph: { type: "website", siteName: "Skeu", url: "/vectorize", title, description },
  twitter: { card: "summary_large_image", title, description },
};

export default function VectorizePage() {
  return <Vectorizer />;
}
