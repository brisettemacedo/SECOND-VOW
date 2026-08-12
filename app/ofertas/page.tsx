import OffersClient from "@/components/OffersClient";
import { requireUser } from "@/lib/auth";

export default async function OffersPage() {
  const { supabase, user } = await requireUser();
  await supabase.rpc("expire_stale_offers");
  const { data } = await supabase
    .from("offers")
    .select("id,dress_id,buyer_id,seller_id,created_by,amount_mxn,status,expires_at,created_at,note,dresses(model,brands(name))")
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order("created_at", { ascending: false });
  return <main className="page"><h1>Ofertas</h1><OffersClient offers={data ?? []} userId={user.id} /></main>;
}
