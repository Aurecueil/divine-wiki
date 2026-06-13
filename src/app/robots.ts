import type { MetadataRoute } from "next";
import { baseUrl } from "@/lib/config";

// Served at /robots.txt. The i18n middleware (src/app/proxy.ts) already
// excludes robots.txt from rewriting, so this reaches crawlers untouched.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The in-browser draft editor has no indexable content (it's also
      // noindex via metadata). Matches /en/draft, /fr-FR/draft, etc.
      disallow: "/*/draft",
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
