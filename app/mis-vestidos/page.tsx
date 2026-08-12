import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { resolveDressBrandNames } from "@/lib/server/dressBrands";
import DeleteDraftButton from "@/components/DeleteDraftButton";

const labels: Record<string, string> = {
  draft: "Borrador",
  pending_review: "En revisión",
  changes_requested: "Cambios solicitados",
  approved: "Publicado",
  rejected: "Rechazado",
  archived: "Archivado",
  reserved: "Reservado",
  sold: "Vendido",
};

function cleanModel(value: any) {
  const text = String(value ?? "").trim();
  return /^(na|n\/a|no aplica|sin modelo)$/i.test(text) ? "" : text;
}

export default async function MyDresses() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("dresses")
    .select("id,brand_id,brand_suggestion_id,model,status,updated_at,precio_venta_mxn,moderation_notes,moderated_at")
    .eq("seller_id", user.id)
    .order("updated_at", { ascending: false });

  let brandNames: Awaited<ReturnType<typeof resolveDressBrandNames>> | null = null;
  let brandError = "";
  if (!error) {
    try {
      brandNames = await resolveDressBrandNames(supabase, data ?? []);
    } catch (e: any) {
      brandError = e?.message || "No fue posible cargar las marcas.";
    }
  }

  const loadError = error?.message || brandError;

  return <main className="page">
    <div className="title-row"><h1>Mis vestidos</h1><Link className="btn btn-primary" href="/publicar">Publicar vestido</Link></div>
    {loadError && <div className="alert-error"><strong>No pudimos cargar tus publicaciones.</strong><p>{loadError}</p></div>}
    <div className="cards-list">
      {!loadError && (data ?? []).map((d: any) => {
        const editable = ["draft", "changes_requested", "rejected"].includes(d.status);
        const brand = brandNames?.nameFor(d) ?? "Sin marca";
        const model = cleanModel(d.model);
        return <article className="panel" key={d.id}>
          <h2>{brand}{model ? ` ${model}` : ""}</h2>
          <p><span className="badge">{labels[d.status] ?? d.status}</span></p>
          <p>{d.precio_venta_mxn ? `$${Number(d.precio_venta_mxn).toLocaleString("es-MX")} MXN` : "Precio pendiente"}</p>
          {d.status === "pending_review" && <div className="alert-success">Tu vestido está en revisión administrativa. No necesitas hacer nada por ahora.</div>}
          {d.status === "changes_requested" && <div className="alert-error"><strong>SECOND VOW solicitó cambios:</strong><p>{d.moderation_notes || "Revisa la publicación antes de reenviarla."}</p></div>}
          {d.status === "rejected" && <div className="alert-error"><strong>Publicación rechazada:</strong><p>{d.moderation_notes || "No se indicó un motivo."}</p></div>}
          {d.status === "approved" && <div className="alert-success">Tu vestido está publicado y visible en el marketplace.</div>}
          <div className="actions">
            {editable && <Link href={`/publicar/${d.id}`} className="btn btn-secondary">{d.status === "changes_requested" ? "Corregir y reenviar" : "Editar"}</Link>}
            {d.status === "draft" && <DeleteDraftButton dressId={d.id} />}
            <Link href={`/vestidos/${d.id}`} className="btn btn-secondary">Ver</Link>
          </div>
        </article>;
      })}
      {!loadError && !data?.length && <p>No tienes publicaciones todavía.</p>}
    </div>
  </main>;
}
