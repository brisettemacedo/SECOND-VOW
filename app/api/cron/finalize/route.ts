import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/adminSupabase";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("backend_finalize_expired_inspections");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ finalized: data ?? 0 });
}
