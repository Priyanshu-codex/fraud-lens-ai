import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/analyzer",
        destination: "/analyze",
        permanent: true,
      },
      {
        source: "/system-health",
        destination: "/settings",
        permanent: true,
      },
      {
        source: "/model-lab",
        destination: "/model",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL?.trim();
    if (backendUrl) {
      const cleanUrl = backendUrl.replace(/\/+$/, "");
      return [
        {
          source: "/api/:path*",
          destination: cleanUrl.endsWith("/api")
            ? `${cleanUrl}/:path*`
            : `${cleanUrl}/api/:path*`,
        },
      ];
    }
    return [];
  },
  async headers() {

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
