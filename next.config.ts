import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // The editor moved to / and the home page to /about; old links and bookmarks still land in the right place
  // (/?home, the old home-page link, is sent on by src/proxy.ts).
  async redirects() {
    return [
      { source: "/editor", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
