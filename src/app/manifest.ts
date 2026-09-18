import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: `${siteConfig.name} — Readiness, evidence and decisions`,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#3F9F32",
    lang: "en",
    dir: "auto",
    categories: ["business", "productivity"],
    prefer_related_applications: false,
    // Install / home-screen tile only (browser tab uses bidvera-mark via layout metadata)
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "Open your executive overview",
        url: "/dashboard",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Analyze tender",
        short_name: "Analyze",
        description: "Upload and verify a new tender",
        url: "/tenders/upload",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Tenders",
        short_name: "Tenders",
        description: "Browse your tender pipeline",
        url: "/tenders",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
