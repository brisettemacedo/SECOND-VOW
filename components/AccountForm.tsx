"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AccountForm({ email, initialFullName }: { email: string; initialFullName: string }) {
  const supabase = createClient();
  const [fullName, setFullName] = useState(initialFullName);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setSavingProfile(true); setProfileMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    setSavingProfile(false);
    setProfileMsg(error ? { type: "error", text: "No se pudo guardar. Intenta de nuevo." } : { type: "success", text: "Perfil actualizado." });
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) { setPasswordMsg({ type: "error", text: "La contraseña debe tener al menos 8 caracteres." }); return; }
    setSavingPassword(true); setPasswordMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false); setNewPassword("");
    setPasswordMsg(error ? { type: "error", text: "No se pudo cambiar la contraseña." } : { type: "success", text: "Contraseña actualizada." });
  }

  async function handleSignOut() { await supabase.auth.signOut(); window.location.href = "/"; }

  return <div>
    <form onSubmit={saveProfile} style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 16, marginBottom: 16 }}>Datos de cuenta</h2>
      {profileMsg && <div className={profileMsg.type === "success" ? "alert-success" : "alert-error"}>{profileMsg.text}</div>}
      <div className="field"><label>Correo (privado)</label><input type="email" value={email} disabled style={{ opacity: 0.6 }} /></div>
      <div className="field"><label htmlFor="fullName">Nombre para tu cuenta</label><input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} /></div>
      <button className="btn btn-primary" type="submit" disabled={savingProfile}>{savingProfile ? "Guardando..." : "Guardar cambios"}</button>
    </form>
    <form onSubmit={changePassword} style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 16, marginBottom: 16 }}>Cambiar contraseña</h2>
      {passwordMsg && <div className={passwordMsg.type === "success" ? "alert-success" : "alert-error"}>{passwordMsg.text}</div>}
      <div className="field"><label htmlFor="newPassword">Nueva contraseña</label><input id="newPassword" type="password" minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} /></div>
      <button className="btn btn-secondary" type="submit" disabled={savingPassword}>{savingPassword ? "Guardando..." : "Cambiar contraseña"}</button>
    </form>
    <button className="btn btn-secondary" onClick={handleSignOut}>Cerrar sesión</button>
  </div>;
}
