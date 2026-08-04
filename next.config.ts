import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  ...(isGitHubPages
    ? {
        output: "export" as const,
        basePath: "/pet-kingdom-spirit-pact",
        assetPrefix: "/pet-kingdom-spirit-pact",
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
