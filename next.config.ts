import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ["*.trycloudflare.com"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
