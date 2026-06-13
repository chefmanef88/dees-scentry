'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function AdminNav() {
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/admin/login');
  }

  return (
    <>
      <div className="admin-header">
        <Link href="/" className="brand">
          <span className="brand-mark">D</span>
          <span>Dee&apos;s Scentry Admin</span>
        </Link>
        <button className="btn btn-secondary" type="button" onClick={signOut}>Sign out</button>
      </div>
      <nav className="admin-nav" aria-label="Admin navigation">
        <Link href="/admin/dashboard">Dashboard</Link>
        <Link href="/admin/products">Products</Link>
        <Link href="/admin/featured">What&apos;s New</Link>
        <Link href="/admin/orders">Orders</Link>
        <Link href="/admin/inventory">Inventory</Link>
        <Link href="/">View Website</Link>
      </nav>
    </>
  );
}
