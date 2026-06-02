import type { MetadataRoute } from "next";

const BASE = "https://heim-virid.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE,                   lastModified: new Date(), changeFrequency: "weekly",  priority: 1 },
    { url: `${BASE}/login`,        lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/roadmap`,      lastModified: new Date(), changeFrequency: "weekly",  priority: 0.6 },
    { url: `${BASE}/privacy`,      lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/terms`,        lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
  ];
}
