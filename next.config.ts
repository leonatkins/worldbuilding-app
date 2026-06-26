import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so a stray lockfile elsewhere on disk can't make
  // Turbopack infer the wrong project root.
  turbopack: { root: __dirname },
};

export default nextConfig;
