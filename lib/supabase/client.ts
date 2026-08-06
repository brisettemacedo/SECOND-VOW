import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/env";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!browserClient) {
    const { url, key } = getSupabasePublicEnv();
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}
