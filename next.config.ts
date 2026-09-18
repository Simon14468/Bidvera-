import type { NextConfig } from "next";
import path from "path";
import { HTTP_BODY_SIZE_LIMIT } from "./src/config/server";
import { BASELINE_SECURITY_HEADERS } from "./src/config/security-headers";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // Tender packages: configurable multi-file packs via Server Actions (default was 1MB).
  experimental: {
    serverActions: {
      bodySizeLimit: HTTP_BODY_SIZE_LIMIT,
    },
    // Proxy also defaults to ~1MB; raise so large FormData is not truncated first.
    proxyClientMaxBodySize: HTTP_BODY_SIZE_LIMIT,
  },
  // Keep PDF/OCR native deps off the Turbopack/webpack graph (pdf.worker.mjs path).
  serverExternalPackages: [
    "pdf-parse",
    "pdf-parse/worker",
    "pdfjs-dist",
    "@napi-rs/canvas",
    "tesseract.js",
    "yauzl",
    "node-unrar-js",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
        pathname: "/vi/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: BASELINE_SECURITY_HEADERS,
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
    ];
  },
};

export default nextConfig;
