import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "La cancelación manual de ventas ya no está disponible, los pedidos sin envío se cancelan automáticamente al vencer el plazo" }, { status: 410 });
}
