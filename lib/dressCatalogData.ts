import type { SupabaseClient } from "@supabase/supabase-js";

export type CatalogOption = { value: string; label: string };
export type CharacteristicOption = { id: string; label: string };

export type DressCatalogData = {
  sizes: CatalogOption[];
  sizingSystems: CatalogOption[];
  silhouettes: CatalogOption[];
  necklines: CatalogOption[];
  backs: CatalogOption[];
  sleeves: CatalogOption[];
  fabrics: CatalogOption[];
  colors: CatalogOption[];
  trains: CatalogOption[];
  conditions: CatalogOption[];
  characteristics: CharacteristicOption[];
};

async function loadCatalog(supabase: SupabaseClient, table: string): Promise<CatalogOption[]> {
  const { data, error } = await supabase
    .from(table)
    .select("code,label,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ value: row.code, label: row.label }));
}

export async function loadDressCatalogData(supabase: SupabaseClient): Promise<DressCatalogData> {
  const [sizes, sizingSystems, silhouettes, necklines, backs, sleeves, fabrics, colors, trains, conditions, characteristicsResult] = await Promise.all([
    loadCatalog(supabase, "dress_size_catalog"),
    loadCatalog(supabase, "sizing_system_catalog"),
    loadCatalog(supabase, "silhouette_catalog"),
    loadCatalog(supabase, "neckline_catalog"),
    loadCatalog(supabase, "back_catalog"),
    loadCatalog(supabase, "sleeve_catalog"),
    loadCatalog(supabase, "fabric_catalog"),
    loadCatalog(supabase, "color_catalog"),
    loadCatalog(supabase, "train_catalog"),
    loadCatalog(supabase, "condition_catalog"),
    supabase.from("characteristics").select("id,label").order("label", { ascending: true }),
  ]);

  if (characteristicsResult.error) throw characteristicsResult.error;

  return {
    sizes,
    sizingSystems,
    silhouettes,
    necklines,
    backs,
    sleeves,
    fabrics,
    colors,
    trains,
    conditions,
    characteristics: (characteristicsResult.data ?? []) as CharacteristicOption[],
  };
}
