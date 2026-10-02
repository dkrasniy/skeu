import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://skeu.app", changeFrequency: "monthly", priority: 1 },
    { url: "https://skeu.app/editor", changeFrequency: "monthly", priority: .9 },
  ];
}
