import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth-form';

export const metadata: Metadata = { title: 'Регистрация' };
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AuthForm mode="register" />
    </Suspense>
  );
}
