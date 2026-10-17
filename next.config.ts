import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Versión visible en la consola (commit desplegado) para saber qué código está corriendo.
  env: { NEXT_PUBLIC_VERSION: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7) },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
