import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Клиент Supabase для Server Components, Server Actions и Route Handlers.
 * Куки в Next 15+ читаются асинхронно, поэтому фабрика — async.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component: куки здесь менять нельзя — их обновит middleware.
          }
        },
      },
    },
  );
}
