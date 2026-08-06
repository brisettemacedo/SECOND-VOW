import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/cuenta");
  return { supabase, user };
}

export async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (data?.role !== "admin") redirect("/");
  return { supabase, user };
}
