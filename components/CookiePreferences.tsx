"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { COOKIES_VERSION } from "@/lib/site";

type Choice = { analytics: boolean; marketing: boolean; version: string; savedAt: string };
const KEY = "secondvow_cookie_preferences";

export default function CookiePreferences() {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(KEY) || "null") as Choice | null; setOpen(!saved || saved.version !== COOKIES_VERSION); }
    catch { setOpen(true); }
  }, []);
  function save(a: boolean, m: boolean) {
    const choice: Choice = { analytics: a, marketing: m, version: COOKIES_VERSION, savedAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(choice));
    window.dispatchEvent(new CustomEvent("secondvow:cookie-consent", { detail: choice }));
    setOpen(false);
  }
  if (!open) return <button className="cookie-settings-link" type="button" onClick={() => setOpen(true)}>Preferencias de cookies</button>;
  return <div className="cookie-banner" role="dialog" aria-modal="true" aria-labelledby="cookie-title">
    <div><strong id="cookie-title">Tus preferencias de privacidad</strong><p>Usamos cookies necesarias para sesión y seguridad. Analítica y publicidad permanecen apagadas hasta que las autorices. <Link href="/legal/cookies">Ver política</Link>.</p>
    {custom && <div className="cookie-options"><label className="check"><input type="checkbox" checked disabled /><span>Necesarias (siempre activas)</span></label><label className="check"><input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} /><span>Analítica</span></label><label className="check"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /><span>Publicidad</span></label></div>}</div>
    <div className="cookie-actions">{custom ? <button className="btn btn-primary" onClick={() => save(analytics, marketing)}>Guardar preferencias</button> : <button className="btn btn-secondary" onClick={() => setCustom(true)}>Configurar</button>}<button className="btn btn-secondary" onClick={() => save(false, false)}>Solo necesarias</button><button className="btn btn-primary" onClick={() => save(true, true)}>Aceptar todas</button></div>
  </div>;
}
