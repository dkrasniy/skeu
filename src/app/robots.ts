import type { MetadataRoute } from "next";

// Every crawler is welcome, AI assistants included: being found is the point.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: "https://skeu.app/sitemap.xml", host: "https://skeu.app" };
}
