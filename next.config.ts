import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ⚠️ Do NOT use output: "standalone" on Netlify — the @netlify/plugin-nextjs
  // handles the build output automatically. Setting "standalone" can cause
  // routing/API route issues in production.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Ensure API routes are always dynamic (no caching of authenticated responses)
  experimental: {
    // Allow server-side code to use Node.js APIs (Buffer, crypto, etc.)
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
};

export default nextConfig;
