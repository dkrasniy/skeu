import { FAQ, Landing } from "@/components/landing";

const appData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Skeu",
  url: "https://skeu.app",
  description: "A free screenshot editor that runs in the browser. Add a window frame, shadow, 3D tilt and background, crop, and export a PNG, JPG or WebP.",
  applicationCategory: "DesignApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: ["Light and dark window frames", "Adjustable shadows", "3D tilt and rotation", "Gradient and solid backgrounds", "Crop with edge snapping", "PNG, JPG and WebP export at up to 3×", "Copy to clipboard", "No signup, nothing uploaded"],
};

const faqData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
};

export default function Home() {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([appData, faqData]) }} />
    <Landing />
  </>;
}
