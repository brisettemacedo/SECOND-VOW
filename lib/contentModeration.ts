export const OFF_PLATFORM_MESSAGE =
  "No pudimos enviar este mensaje porque parece contener datos de contacto, enlaces o una invitación para continuar la operación fuera de SECOND VOW.\n\nPor seguridad, mantén la conversación, la oferta y el pago dentro de la plataforma.";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Detección preventiva para dar retroalimentación inmediata. La misma regla se
 * aplica nuevamente en Supabase, que es la fuente de verdad y evita que un
 * cliente modificado pueda saltarse el filtro.
 */
export function hasDisallowedContactContent(value: string) {
  const normalized = normalize(value);
  const text = normalized.replace(
    /(?:https?:\/\/)?(?:www\.)?second-vow\.com(?:\/[\w?&=%#./~-]*)?/gi,
    " ",
  );
  const compact = text.replace(/[^a-z0-9@.]/g, "");

  const hasExternalLink =
    /(?:https?:\/\/|www\.)\S+/i.test(text) ||
    /\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?\b/i.test(text);
  const hasEmail =
    /\b[a-z0-9._%+-]+\s*@\s*[a-z0-9.-]+\s*\.\s*[a-z]{2,}\b/i.test(text) ||
    /\b(?:gmail|hotmail|outlook|yahoo|icloud)\b/i.test(text) ||
    /\b(?:arroba|punto\s+(?:com|mx|net|org))\b/i.test(text);
  const hasHandle = /(^|\s)@[a-z0-9._-]{2,}/i.test(text);
  const hasPhone = /(?:\+?\d[\s().-]*){10,}/.test(text);
  const hasSocialApp =
    /\b(?:whats(?:app)?|wsp|telegram|instagram|facebook|messenger|tiktok|signal|snapchat|wechat)\b/i.test(text) ||
    /w[\s._-]*h[\s._-]*a[\s._-]*t[\s._-]*s[\s._-]*a[\s._-]*p[\s._-]*p/i.test(text) ||
    compact.includes("wa.me");
  const hasExternalPayment =
    /\b(?:clabe|transferencia|deposito|cuenta\s+bancaria|paypal|mercado\s*pago|western\s*union)\b/i.test(text);
  const hasOffPlatformInvitation =
    /\b(?:trato|pago|venta|compra|operacion|negociacion)\s+(?:por\s+)?fuera\b/i.test(text) ||
    /\bfuera\s+de\s+(?:second\s*vow|la\s+plataforma)\b/i.test(text) ||
    /\b(?:evitar|ahorrar|saltar|sin)\s+(?:la\s+)?comision\b/i.test(text) ||
    /\b(?:escribe(?:me)?|contacta(?:me)?|llama(?:me)?|manda(?:me)?|habla(?:me)?)\s+(?:por|al)\b/i.test(text);

  return (
    hasExternalLink ||
    hasEmail ||
    hasHandle ||
    hasPhone ||
    hasSocialApp ||
    hasExternalPayment ||
    hasOffPlatformInvitation
  );
}
