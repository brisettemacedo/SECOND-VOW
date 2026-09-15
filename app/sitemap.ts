import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const STATIC_PAGES = [
  ["", "daily", 1],
  ["/vestidos", "daily", 1],
  ["/vender-vestido-de-novia", "weekly", 0.9],
  ["/que-hacer-con-mi-vestido-de-novia", "monthly", 0.8],
  ["/como-funciona", "monthly", 0.8],
  ["/nosotros", "monthly", 0.6],
  ["/faq", "monthly", 0.7],
  ["/contacto", "yearly", 0.4],
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map(([path, changeFrequency, priority]) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("dresses")
      .select("id,updated_at,created_at")
      .eq("status", "approved")
      .is("removed_by_seller_at", null)
      .order("updated_at", { ascending: false })
      .limit(5000);

    return [
      ...staticEntries,
      ...(data ?? []).map((dress) => ({
        url: `${SITE_URL}/vestidos/${dress.id}`,
        lastModified: new Date(dress.updated_at || dress.created_at),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    return staticEntries;
  }
}
