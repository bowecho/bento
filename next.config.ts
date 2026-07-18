import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@openrouter/sdk"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
