import { createBrowserClient } from '@supabase/ssr';

/**
 * Клиент Supabase для клиентских компонентов ('use client').
 *
 * Типизация строк выполняется доменными типами из `@/types/database`
 * (см. приведения в компонентах). Для полной типобезопасности сгенерируйте
 * официальные типы и подставьте их в generic:
 *   supabase gen types typescript --project-id <ref> --schema public > src/types/supabase.ts
 *   createBrowserClient<Database>(...)
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
