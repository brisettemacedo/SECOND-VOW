export function safeDisplayName(value: unknown, fallback = "Usuaria"): string {
  const name = String(value ?? "").trim();
  if (!name || name.includes("@") || /^https?:\/\//i.test(name)) return fallback;
  return name;
}
