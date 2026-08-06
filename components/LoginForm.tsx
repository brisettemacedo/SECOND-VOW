"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/navigation";
export default function LoginForm(){
 const router=useRouter(); const sp=useSearchParams(); const supabase=createClient();
 const next=safeInternalPath(sp.get("next")); const dress=sp.get("dress");
 const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState<string|null>(null); const [loading,setLoading]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setError(null);setLoading(true);const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error){setLoading(false);setError("Correo o contraseña incorrectos.");return;}if(dress&&data.user){const r=await supabase.from("favorites").upsert({user_id:data.user.id,dress_id:dress},{onConflict:"user_id,dress_id"});if(r.error) setError("Iniciaste sesión, pero no se pudo guardar el vestido.");}setLoading(false);router.replace(next);router.refresh();}
 return <main style={{maxWidth:400,margin:"0 auto",padding:"64px 24px"}}><h1 style={{fontSize:26,marginBottom:24}}>Inicia sesión</h1>{error&&<div className="alert-error">{error}</div>}{dress&&<div className="alert-success">Inicia sesión para guardar este vestido.</div>}<form onSubmit={submit}><div className="field"><label htmlFor="email">Correo electrónico</label><input id="email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></div><div className="field"><label htmlFor="password">Contraseña</label><input id="password" type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></div><button className="btn btn-primary" disabled={loading} style={{width:"100%"}}>{loading?"Entrando...":"Iniciar sesión"}</button></form><p style={{marginTop:14,fontSize:13.5}}><Link href="/recuperar">¿Olvidaste tu contraseña?</Link></p><p style={{fontSize:13.5}}>¿No tienes cuenta? <Link href={`/signup?next=${encodeURIComponent(next)}${dress?`&dress=${encodeURIComponent(dress)}`:""}`}>Crear cuenta</Link></p></main>;
}
