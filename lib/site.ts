const production = process.env.NODE_ENV === "production";
function publicSetting(name: string, value: string | undefined, fallback: string) {
  value = value?.trim();
  if (production && !value) throw new Error(`Falta la variable obligatoria ${name}`);
  return value || fallback;
}

export const SITE_URL = publicSetting("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000").replace(/\/$/, "");
export const LEGAL_NAME = process.env.NEXT_PUBLIC_LEGAL_NAME || "SECOND VOW";
export const LEGAL_ADDRESS = process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "[COMPLETAR DOMICILIO DEL RESPONSABLE ANTES DEL LANZAMIENTO COMERCIAL]";
export const LEGAL_PHONE = process.env.NEXT_PUBLIC_LEGAL_PHONE || "[COMPLETAR TELÉFONO DE CONTACTO]";
if (production) {
  publicSetting("NEXT_PUBLIC_LEGAL_NAME", process.env.NEXT_PUBLIC_LEGAL_NAME, "SECOND VOW");
  publicSetting("NEXT_PUBLIC_LEGAL_ADDRESS", process.env.NEXT_PUBLIC_LEGAL_ADDRESS, "");
  publicSetting("NEXT_PUBLIC_LEGAL_PHONE", process.env.NEXT_PUBLIC_LEGAL_PHONE, "");
}
export const PRIVACY_EMAIL = publicSetting("NEXT_PUBLIC_PRIVACY_EMAIL", process.env.NEXT_PUBLIC_PRIVACY_EMAIL, "privacidad@secondvow.com");
export const CONTACT_EMAIL = publicSetting("NEXT_PUBLIC_CONTACT_EMAIL", process.env.NEXT_PUBLIC_CONTACT_EMAIL, "hola@secondvow.com");
export const TERMS_VERSION = "2026-08-22";
export const PRIVACY_VERSION = "2026-08-22";
export const COOKIES_VERSION = "2026-08-22";
