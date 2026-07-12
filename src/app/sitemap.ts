import type { MetadataRoute } from "next";
import { articles } from "@/content/articles";

const BASE = "https://heim-virid.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE,                   lastModified: new Date(), changeFrequency: "weekly",  priority: 1 },
    { url: `${BASE}/login`,        lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/artikler`,     lastModified: new Date(), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/roadmap`,      lastModified: new Date(), changeFrequency: "weekly",  priority: 0.6 },
    { url: `${BASE}/privacy`,      lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/terms`,        lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    ...articles.map((a) => ({
      url: `${BASE}/artikler/${a.slug}`,
      lastModified: new Date(a.date),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
