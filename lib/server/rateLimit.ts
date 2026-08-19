import { createAdminClient } from "@/lib/server/adminSupabase";
export async function consumeRateLimit(actorKey: string, action: string, limit: number, windowSeconds: number) {
  const { data, error } = await createAdminClient().rpc("backend_consume_rate_limit", { p_actor_key: actorKey, p_action: action, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) throw new Error(error.message);
  return data === true;
}
