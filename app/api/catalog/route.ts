import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchDresses, type DressSearchParams } from "@/lib/dresses";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries()) as DressSearchParams;
  const supabase = await createClient();
  const result = await searchDresses(supabase, params);

  if (result.error) return NextResponse.json({ error: "No se pudo cargar el catálogo" }, { status: 500 });

  return NextResponse.json({ dresses: result.dresses, count: result.count, page: result.page, totalPages: result.totalPages });
}
