"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function csvDownload(name: string, rows: any[]) {
  if (!rows.length) return;
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const esc = (value: any) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [keys.map(esc).join(","), ...rows.map((row) => keys.map((key) => esc(row[key])).join(","))].join("\n");
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

export default function AdminDashboard(p: { verifications: any[]; claims: any[]; brands: any[]; suggestions: any[]; users: any[]; reports: any[]; arco: any[]; orders: any[]; payments: any[]; shipments: any[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [link, setLink] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const refresh = () => router.refresh();

  async function verify(id: string, status: string) {
    const { error } = await supabase.rpc("admin_resolve_identity_verification", { p_verification_id: id, p_status: status });
    error ? alert(error.message) : refresh();
  }
  async function brand(id: string, action: string) {
    const { error } = await supabase.rpc("admin_resolve_brand_suggestion", { p_suggestion_id: id, p_action: action, p_existing_brand_id: action === "link_existing" ? (link[id] || null) : null, p_notes: null });
    error ? alert(error.message) : refresh();
  }
  async function block(user: any) {
    const reason = user.is_blocked ? null : (prompt("Motivo del bloqueo") || "Incumplimiento de reglas");
    const { error } = await supabase.rpc("admin_set_user_blocked", { p_user_id: user.id, p_blocked: !user.is_blocked, p_reason: reason });
    error ? alert(error.message) : refresh();
  }
  async function arcoAction(id: string, status: string) {
    const response = prompt("Respuesta administrativa (opcional)") || null;
    const { error } = await supabase.from("arco_requests").update({ status, admin_response: response, resolved_at: status === "resolved" ? new Date().toISOString() : null }).eq("id", id);
    error ? alert(error.message) : refresh();
  }
  async function reportAction(id: string, status: string) {
    const { error } = await supabase.from("conversation_reports").update({ status }).eq("id", id);
    error ? alert(error.message) : refresh();
  }
  async function claimAction(claim: any, action: "authorize" | "reject" | "refund") {
    setBusy(claim.id);
    try {
      if (action === "refund") {
        if (!confirm("¿Confirmas el reembolso total al medio de pago original?")) return;
        const res = await fetch("/api/stripe/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId: claim.id }) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "No fue posible procesar el reembolso");
      } else if (action === "authorize") {
        const { error } = await supabase.rpc("admin_authorize_return", { p_claim_id: claim.id });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("claims").update({ status: "rejected", resolved_at: new Date().toISOString() }).eq("id", claim.id);
        if (error) throw new Error(error.message);
      }
      refresh();
    } catch (error: any) { alert(error?.message ?? "No fue posible completar la acción"); }
    finally { setBusy(""); }
  }

  const cards = [["Pedidos activos", p.orders.length], ["Pagos por revisar", p.payments.filter((x) => !["paid", "refunded"].includes(x.status)).length], ["Envíos activos", p.shipments.filter((x) => !["delivered", "cancelled"].includes(x.status)).length], ["Reclamaciones", p.claims.length], ["Marcas por revisar", p.suggestions.length], ["Solicitudes ARCO", p.arco.length]];
  return <div className="admin-operations">
    <section className="admin-stat-grid">{cards.map(([label, count]) => <div className="admin-stat" key={String(label)}><strong>{count}</strong><span>{label}</span></div>)}</section>
    <section className="panel"><div className="admin-title"><div><h2>Usuarias</h2><p className="muted">Últimas cuentas registradas.</p></div><button className="btn btn-secondary" onClick={() => csvDownload("usuarios.csv", p.users)}>Exportar</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Usuaria</th><th>Estado</th><th>Registro</th><th>Acción</th></tr></thead><tbody>{p.users.slice(0, 10).map((user) => <tr key={user.id}><td>{user.full_name || "Sin nombre"}</td><td><span className="badge">{user.is_blocked ? "Bloqueada" : "Activa"}</span></td><td>{user.created_at ? new Date(user.created_at).toLocaleDateString("es-MX") : "No disponible"}</td><td><button className="table-action" onClick={() => block(user)}>{user.is_blocked ? "Desbloquear" : "Bloquear"}</button></td></tr>)}</tbody></table></div></section>
    <div className="admin-module-grid">
      <section className="panel"><h2>Pedidos recientes</h2>{p.orders.slice(0, 6).map((order) => <Link className="admin-mini-row" key={order.id} href={`/pedidos/${order.id}`}><span>{order.public_code || `Pedido ${order.id.slice(0, 8)}`}</span><span className="badge">{order.status}</span><strong>${Number(order.total_mxn ?? 0).toLocaleString("es-MX")}</strong></Link>)}{!p.orders.length && <p className="muted">Sin pedidos.</p>}</section>
      <section className="panel"><h2>Envíos</h2>{p.shipments.slice(0, 6).map((shipment) => <div className="admin-mini-row" key={shipment.id}><span>{shipment.carrier || "Paquetería pendiente"}</span><span className="badge">{shipment.status}</span><small>{shipment.tracking_number || "Sin guía"}</small></div>)}{!p.shipments.length && <p className="muted">Sin envíos.</p>}</section>
    </div>
    <div className="admin-module-grid">
      <section className="panel"><h2>Marcas por revisar</h2>{p.suggestions.map((suggestion) => <div className="admin-compact-item" key={suggestion.id}><strong>{suggestion.suggested_name}</strong><select value={link[suggestion.id] || ""} onChange={(e) => setLink((current) => ({ ...current, [suggestion.id]: e.target.value }))}><option value="">Vincular a existente</option>{p.brands.map((brandOption) => <option key={brandOption.id} value={brandOption.id}>{brandOption.name}</option>)}</select><div className="actions"><button className="btn btn-primary" onClick={() => brand(suggestion.id, "approve_new")}>Aprobar nueva</button><button className="btn btn-secondary" disabled={!link[suggestion.id]} onClick={() => brand(suggestion.id, "link_existing")}>Vincular</button><button className="btn btn-secondary" onClick={() => brand(suggestion.id, "reject")}>Rechazar</button></div></div>)}{!p.suggestions.length && <p className="muted">Nada pendiente.</p>}</section>
      <section className="panel"><h2>Identidad histórica</h2>{p.verifications.map((verification) => <div className="admin-compact-item" key={verification.id}><strong>{verification.legal_name || "Nombre no disponible"}</strong><span className="badge">{verification.status}</span><div className="actions"><button className="btn btn-primary" onClick={() => verify(verification.id, "verified")}>Verificar</button><button className="btn btn-secondary" onClick={() => verify(verification.id, "rejected")}>Rechazar</button></div></div>)}{!p.verifications.length && <p className="muted">No hay documentos manuales pendientes.</p>}</section>
    </div>
    <section className="panel"><h2>Reclamaciones y devoluciones</h2>{p.claims.map((claim) => <div className="admin-compact-item" key={claim.id}><strong>{claim.reason}</strong><p>{claim.description}</p><span className="badge">{claim.status}</span><div className="actions">{["open", "under_review"].includes(claim.status) && <><button className="btn btn-primary" disabled={busy === claim.id} onClick={() => claimAction(claim, "authorize")}>Autorizar devolución</button><button className="btn btn-secondary" disabled={busy === claim.id} onClick={() => claimAction(claim, "reject")}>Rechazar</button></>}{claim.status === "approved_return" && <span>Esperando que la compradora registre la devolución.</span>}{claim.status === "return_shipped" && <span>Devolución en tránsito.</span>}{claim.status === "refund_pending" && <button className="btn btn-primary" disabled={busy === claim.id} onClick={() => claimAction(claim, "refund")}>Reembolsar ahora</button>}</div></div>)}{!p.claims.length && <p className="muted">Sin reclamaciones pendientes.</p>}</section>
    <div className="admin-module-grid"><section className="panel"><h2>Reportes</h2>{p.reports.map((report) => <div className="admin-compact-item" key={report.id}><strong>{report.reason_code}</strong><p>{report.details}</p><div className="actions"><button className="btn btn-primary" onClick={() => reportAction(report.id, "resolved")}>Resolver</button><button className="btn btn-secondary" onClick={() => reportAction(report.id, "dismissed")}>Descartar</button></div></div>)}{!p.reports.length && <p className="muted">Sin reportes abiertos.</p>}</section><section className="panel"><div className="admin-title"><h2>Solicitudes ARCO</h2><button className="btn btn-secondary" onClick={() => csvDownload("solicitudes-arco.csv", p.arco)}>Exportar</button></div>{p.arco.map((request) => <div className="admin-compact-item" key={request.id}><strong>{request.request_type}</strong><p>{request.description}</p><span className="badge">{request.status}</span><div className="actions"><button className="btn btn-primary" onClick={() => arcoAction(request.id, "resolved")}>Resolver</button><button className="btn btn-secondary" onClick={() => arcoAction(request.id, "needs_information")}>Pedir información</button></div></div>)}{!p.arco.length && <p className="muted">Sin solicitudes pendientes.</p>}</section></div>
  </div>;
}
