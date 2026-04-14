import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/trainers/:slug",
        destination: "/trainer/:slug",
        permanent: true,
      },
      {
        source: "/trainer/profile",
        destination: "/trainer",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
