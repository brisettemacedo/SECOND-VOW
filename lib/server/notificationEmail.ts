import "server-only";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { SITE_URL } from "@/lib/site";

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!);
}

export async function sendPendingNotificationEmails(limit = 40, kinds?: string[]) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { sent: 0, failed: 0, skipped: true };
  const admin = createAdminClient();
  let query = admin.from("notifications")
    .select("id,user_id,order_id,dress_id,kind,title,body,metadata,email_attempts")
    .in("email_status", ["pending", "failed"])
    .lt("email_attempts", 5)
    .or(`email_next_attempt_at.is.null,email_next_attempt_at.lte.${new Date().toISOString()}`)
    .order("created_at", { ascending: true }).limit(limit);
  if (kinds?.length) query = query.in("kind", kinds);
  const { data: rows, error } = await query;
  if (error) throw error;
  let sent = 0; let failed = 0;
  for (const row of rows ?? []) {
    const attempts = Number(row.email_attempts ?? 0) + 1;
    const { data: account } = await admin.auth.admin.getUserById(row.user_id);
    const to = account.user?.email;
    if (!to) {
      await admin.from("notifications").update({ email_status: "not_required", email_attempts: attempts, email_last_attempt_at: new Date().toISOString(), email_last_error: "La cuenta no tiene correo" }).eq("id", row.id);
      continue;
    }
    const requestedPath = typeof row.metadata?.href_path === "string" ? row.metadata.href_path : "";
    const safePath = /^\/[a-zA-Z0-9/_?=&.-]+$/.test(requestedPath) && !requestedPath.startsWith("//") ? requestedPath : "";
    const href = safePath ? `${SITE_URL}${safePath}` : row.order_id ? `${SITE_URL}/pedidos/${row.order_id}` : row.dress_id ? `${SITE_URL}/vestidos/${row.dress_id}` : SITE_URL;
    const isDraftReminder = ["draft_publication_help", "weekly_draft_reminder"].includes(row.kind);
    const buttonLabel = isDraftReminder ? "Continuar mi publicación" : "Abrir SECOND VOW";
    const emailSubject = typeof row.metadata?.email_subject === "string" ? row.metadata.email_subject : row.title;
    const emailBody = typeof row.metadata?.email_body === "string" ? row.metadata.email_body : row.body;
    const emailParagraphs = escapeHtml(emailBody).split("\n\n").map((paragraph) => `<p style="font-size:16px;line-height:1.6">${paragraph}</p>`).join("");
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `notification-${row.id}` },
        body: JSON.stringify({ from, to: [to], subject: emailSubject, html: `<div lang="es" style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#2f2926"><h1 style="font-size:24px">${escapeHtml(emailSubject)}</h1>${emailParagraphs}<p><a href="${href}" style="background:#66633f;color:white;text-decoration:none;padding:12px 18px;border-radius:999px;display:inline-block;min-height:20px">${buttonLabel}</a></p><p style="font-size:12px;color:#756f6a">Este es un aviso operativo de tu cuenta en SECOND VOW.</p></div>` })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || `Resend ${response.status}`);
      await admin.from("notifications").update({ email_status: "sent", email_provider_id: result?.id ?? null, email_attempts: attempts, email_last_attempt_at: new Date().toISOString(), email_next_attempt_at: null, email_last_error: null }).eq("id", row.id);
      sent++;
    } catch (mailError: any) {
      const terminal = attempts >= 5;
      const retryMinutes = Math.min(1440, 5 * (2 ** Math.min(attempts, 8)));
      await admin.from("notifications").update({ email_status: "failed", email_attempts: attempts, email_last_attempt_at: new Date().toISOString(), email_next_attempt_at: terminal ? null : new Date(Date.now() + retryMinutes * 60000).toISOString(), email_last_error: String(mailError?.message ?? "Error de correo").slice(0, 1000) }).eq("id", row.id);
      failed++;
    }
  }
  return { sent, failed, skipped: false };
}
