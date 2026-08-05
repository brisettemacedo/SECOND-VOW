import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AccountForm from "@/components/AccountForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/cuenta");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, city, state")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "64px 24px" }}>
      <h1 style={{ fontSize: 26, marginBottom: 24 }}>Mi cuenta</h1>
      <AccountForm
        email={user.email ?? ""}
        initialFullName={profile?.full_name ?? ""}
        initialCity={profile?.city ?? ""}
        initialState={profile?.state ?? ""}
      />
    </main>
  );
}
