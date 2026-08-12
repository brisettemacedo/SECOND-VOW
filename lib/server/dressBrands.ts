export type DressBrandSource = {
  id: string;
  brand_id?: string | null;
  brand_suggestion_id?: string | null;
};

type SuggestionRow = { id: string; suggested_name: string; status?: string | null };

export async function resolveDressBrandNames(supabase: any, dresses: DressBrandSource[]) {
  const brandIds = Array.from(new Set(dresses.map((d) => d.brand_id).filter(Boolean))) as string[];
  const suggestionIds = Array.from(new Set(dresses.map((d) => d.brand_suggestion_id).filter(Boolean))) as string[];

  const [brandResult, suggestionResult] = await Promise.all([
    brandIds.length
      ? supabase.from("brands").select("id,name").in("id", brandIds)
      : Promise.resolve({ data: [], error: null }),
    suggestionIds.length
      ? supabase.from("brand_suggestions").select("id,suggested_name,status").in("id", suggestionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (brandResult.error) throw brandResult.error;
  if (suggestionResult.error) throw suggestionResult.error;

  const brands = new Map<string, string>();
  for (const row of brandResult.data ?? []) brands.set(String(row.id), String(row.name));

  const suggestions = new Map<string, SuggestionRow>();
  for (const row of suggestionResult.data ?? []) {
    suggestions.set(String(row.id), {
      id: String(row.id),
      suggested_name: String(row.suggested_name),
      status: row.status == null ? null : String(row.status),
    });
  }

  return {
    nameFor(dress: DressBrandSource) {
      if (dress.brand_id && brands.has(dress.brand_id)) return brands.get(dress.brand_id)!;
      if (dress.brand_suggestion_id && suggestions.has(dress.brand_suggestion_id)) {
        return suggestions.get(dress.brand_suggestion_id)!.suggested_name;
      }
      return "Sin marca";
    },
    suggestionFor(dress: DressBrandSource) {
      return dress.brand_suggestion_id ? suggestions.get(dress.brand_suggestion_id) ?? null : null;
    },
  };
}
