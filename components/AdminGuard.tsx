'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BUSINESS } from '@/lib/business';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user.email;

      if (!data.session) {
        router.replace('/admin/login');
        return;
      }

      if (email !== BUSINESS.adminEmail) {
        await supabase.auth.signOut();
        setError(`This dashboard is restricted to ${BUSINESS.adminEmail}.`);
        setTimeout(() => router.replace('/admin/login'), 1500);
        return;
      }

      setReady(true);
    }

    void checkSession();
  }, [router]);

  if (error) return <div className="admin-layout"><p className="notice error">{error}</p></div>;
  if (!ready) return <div className="admin-layout"><p className="notice">Checking admin access...</p></div>;
  return <>{children}</>;
}
