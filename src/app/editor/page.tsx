import type { Metadata } from "next";
import { Editor } from "@/components/editor";

export const metadata: Metadata = {
  title: "Skeu editor",
  alternates: { canonical: "/editor" },
  // A page's openGraph replaces the layout's whole, image included, so it repeats the shared parts.
  openGraph: { type: "website", siteName: "Skeu", url: "/editor", title: "Skeu editor", images: "/opengraph-image.png" },
};

export default function EditorPage() {
  return <Editor />;
}
