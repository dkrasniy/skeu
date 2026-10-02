import type { Metadata } from "next";
import { Playground } from "@/components/playground";

// A workbench for trying control designs. Not linked anywhere, and kept out of search.
export const metadata: Metadata = { title: "Playground", robots: { index: false, follow: false } };

export default function PlaygroundPage() {
  return <Playground />;
}
