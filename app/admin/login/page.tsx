'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BUSINESS } from '@/lib/business';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(BUSINESS.adminEmail);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function redirectIfLoggedIn() {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.email === BUSINESS.adminEmail) router.replace('/admin/dashboard');
    }
    void redirectIfLoggedIn();
  }, [router]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus('Signing in...');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    if (data.user?.email !== BUSINESS.adminEmail) {
      await supabase.auth.signOut();
      setStatus(`Only ${BUSINESS.adminEmail} can access this admin dashboard.`);
      setLoading(false);
      return;
    }

    router.push('/admin/dashboard');
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleLogin}>
        <a href="/" className="brand" style={{ marginBottom: 22 }}>
          <span className="brand-mark">D</span>
          <span>Dee&apos;s Scentry</span>
        </a>
        <p className="eyebrow">Admin Login</p>
        <h1 style={{ fontSize: '2.6rem' }}>Manage products, orders, and inventory.</h1>
        <p className="muted">Log in with the admin account created for {BUSINESS.adminEmail}.</p>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <button className="btn btn-primary full-width" disabled={loading} type="submit">Sign in</button>
        {status ? <p className={`notice ${status.includes('Signing') ? '' : 'error'}`}>{status}</p> : null}
      </form>
    </main>
  );
}
