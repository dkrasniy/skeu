import type { Metadata } from "next";
import { Editor } from "@/components/editor";

// The editor is the home page; what Skeu is and its FAQ live at /about.
export const metadata: Metadata = {
  title: "Skeu.app",
  alternates: { canonical: "/" },
};

const appData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Skeu",
  url: "https://skeu.app",
  description: "A screenshot editor for launch posts, docs and slides: a window frame, background, shadow and 3D tilt, then PNG, JPG or WebP.",
  applicationCategory: "DesignApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: ["Light and dark window frames", "Adjustable shadows", "3D tilt and rotation", "Gradient and solid backgrounds", "Crop with edge snapping", "PNG, JPG and WebP export at up to 3×", "Copy to clipboard"],
};

export default function Home() {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appData) }} />
    <Editor />
  </>;
}
