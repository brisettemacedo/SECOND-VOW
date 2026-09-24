import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NotificationMenu from "@/components/NotificationMenu";

function CountBadge({ count }: { count: number }) {
  if (!count) return null;
  return <span className="nav-count" aria-label={`${count} pendientes`}>{count > 99 ? "99+" : count}</span>;
}

export default async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isAdmin = false;
  let unreadMessages = 0;
  let actionableOrders = 0;
  let notifications: any[] = [];

  if (user) {
    const [{ data: profile }, unreadRes, ordersRes, notificationsRes] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      supabase.from("messages").select("id", { count: "exact", head: true }).is("read_at", null).neq("sender_id", user.id),
      supabase.from("orders").select("id,status,buyer_id,seller_id,shipping_quote_set_at")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .in("status", ["awaiting_payment", "paid", "preparing_shipment", "shipped"]),
      supabase.from("notifications")
        .select("id,order_id,dress_id,kind,title,body,created_at,metadata")
        .eq("user_id", user.id)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(9),
    ]);
    isAdmin = profile?.role === "admin";
    unreadMessages = unreadRes.count ?? 0;
    actionableOrders = (ordersRes.data ?? []).filter((o: any) =>
      (o.seller_id === user.id && o.status === "awaiting_payment" && !o.shipping_quote_set_at) ||
      (o.seller_id === user.id && ["paid", "preparing_shipment"].includes(o.status)) ||
      (o.buyer_id === user.id && o.status === "shipped")
    ).length;
    notifications = notificationsRes.data ?? [];
  }

  return (
    <header className="site-header">
      <Link href="/" className="brand">SECOND VOW</Link>
      <nav>
        <Link href="/vestidos">Vestidos</Link>
        {user && <Link href="/publicar">Vender</Link>}
        {user && <Link href="/favoritos">Guardados</Link>}
        {user && <Link className="nav-with-count" href="/mensajes">Mensajes<CountBadge count={unreadMessages} /></Link>}
        {user && <Link className="nav-with-count" href="/pedidos">Pedidos<CountBadge count={actionableOrders} /></Link>}
        {user && <NotificationMenu initial={notifications} />}
        {user && <Link href="/cuenta">Cuenta</Link>}
        {isAdmin && <Link href="/admin">Administración</Link>}
        {!user ? <Link href="/login">Ingresar</Link> : <form action="/auth/signout" method="post"><button type="submit" className="link-button">Salir</button></form>}
      </nav>
    </header>
  );
}
