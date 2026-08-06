function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`);
  return value;
}

export function getSupabasePublicEnv() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, key: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (o NEXT_PUBLIC_SUPABASE_ANON_KEY)", key) };
}
