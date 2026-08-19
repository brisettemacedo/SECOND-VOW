export function isSameOriginRequest(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(req.url).origin; }
  catch { return false; }
}
