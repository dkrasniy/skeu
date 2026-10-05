import type { Metadata } from "next";
import { FAQ, Landing } from "@/components/landing";

export const metadata: Metadata = {
  title: "About Skeu",
  alternates: { canonical: "/about" },
  // A page's openGraph replaces the layout's whole, image included, so it repeats the shared parts.
  openGraph: { type: "website", siteName: "Skeu", url: "/about", title: "About Skeu", images: "/opengraph-image.png" },
};

const faqData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
};

export default function About() {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }} />
    <Landing />
  </>;
}
