'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { AdminNav } from '@/components/AdminNav';
import { supabase } from '@/lib/supabase';
import { safeFileName } from '@/lib/format';
import type { FeaturedPost } from '@/lib/types';

type FeaturedForm = {
  id?: string;
  title: string;
  subtitle: string;
  body: string;
  image_url: string;
  cta_label: string;
  cta_href: string;
  sort_order: string;
  is_active: boolean;
};

const emptyForm: FeaturedForm = {
  title: '',
  subtitle: '',
  body: '',
  image_url: '',
  cta_label: '',
  cta_href: '',
  sort_order: '0',
  is_active: true
};

export default function FeaturedAdminPage() {
  const [posts, setPosts] = useState<FeaturedPost[]>([]);
  const [form, setForm] = useState<FeaturedForm>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadPosts();
  }, []);

  async function loadPosts() {
    setStatus('Loading posts...');
    const { data, error } = await supabase
      .from('featured_posts')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) setStatus(error.message);
    else {
      setPosts((data || []) as FeaturedPost[]);
      setStatus('');
    }
  }

  async function uploadImage() {
    if (!imageFile) return form.image_url || null;

    const extension = imageFile.name.split('.').pop() || 'jpg';
    const path = `${Date.now()}-${safeFileName(form.title || 'featured')}.${extension}`;
    const { error } = await supabase.storage.from('site-images').upload(path, imageFile, {
      cacheControl: '3600',
      upsert: false
    });

    if (error) throw error;
    const { data } = supabase.storage.from('site-images').getPublicUrl(path);
    return data.publicUrl;
  }

  async function savePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus('Saving post...');

    try {
      const imageUrl = await uploadImage();
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        body: form.body.trim() || null,
        image_url: imageUrl,
        cta_label: form.cta_label.trim() || null,
        cta_href: form.cta_href.trim() || null,
        sort_order: Number(form.sort_order || 0),
        is_active: form.is_active
      };

      if (!payload.title) throw new Error('Title is required.');

      const response = form.id
        ? await supabase.from('featured_posts').update(payload).eq('id', form.id)
        : await supabase.from('featured_posts').insert(payload);

      if (response.error) throw response.error;
      setForm(emptyForm);
      setImageFile(null);
      setStatus('Post saved.');
      await loadPosts();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save post.');
    } finally {
      setSaving(false);
    }
  }

  function editPost(post: FeaturedPost) {
    setForm({
      id: post.id,
      title: post.title,
      subtitle: post.subtitle || '',
      body: post.body || '',
      image_url: post.image_url || '',
      cta_label: post.cta_label || '',
      cta_href: post.cta_href || '',
      sort_order: String(post.sort_order),
      is_active: post.is_active
    });
    setImageFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function toggleActive(post: FeaturedPost) {
    const { error } = await supabase.from('featured_posts').update({ is_active: !post.is_active }).eq('id', post.id);
    if (error) setStatus(error.message);
    else await loadPosts();
  }

  async function deletePost(post: FeaturedPost) {
    if (!confirm(`Delete "${post.title}"?`)) return;
    const { error } = await supabase.from('featured_posts').delete().eq('id', post.id);
    if (error) setStatus(error.message);
    else {
      setStatus('Post deleted.');
      await loadPosts();
    }
  }

  return (
    <AdminGuard>
      <main className="admin-layout">
        <AdminNav />
        <section className="admin-two-col">
          <form className="admin-card admin-form" onSubmit={savePost}>
            <p className="eyebrow">What&apos;s New</p>
            <h1 style={{ fontSize: '2.6rem' }}>{form.id ? 'Edit signature scent post' : 'Add signature scent post'}</h1>
            <p className="muted">Posts you mark as active will appear in the public What&apos;s New section. If no post is active, the section stays hidden.</p>
            <label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Signature scent picks for the weekend" required /></label>
            <label>Small label / subtitle<input value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} placeholder="New arrival, Best seller, Weekend pick" /></label>
            <label>Post text<textarea rows={5} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Describe the scent, occasion, or offer." /></label>
            <label>Upload picture<input type="file" accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] || null)} /></label>
            {form.image_url ? <img className="product-thumb" src={form.image_url} alt="Current post" /> : null}
            <div className="form-grid">
              <label>Button label<input value={form.cta_label} onChange={(event) => setForm({ ...form, cta_label: event.target.value })} placeholder="Shop now" /></label>
              <label>Button link<input value={form.cta_href} onChange={(event) => setForm({ ...form, cta_href: event.target.value })} placeholder="#shop or https://wa.me/..." /></label>
            </div>
            <label>Sort order<input type="number" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} /></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}><input type="checkbox" style={{ width: 'auto' }} checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Show on website</label>
            <div className="admin-actions">
              <button className="btn btn-primary" disabled={saving} type="submit">{form.id ? 'Update post' : 'Publish post'}</button>
              {form.id ? <button className="btn btn-secondary" type="button" onClick={() => { setForm(emptyForm); setImageFile(null); }}>Cancel edit</button> : null}
            </div>
            {status ? <p className="notice">{status}</p> : null}
          </form>

          <article className="table-card">
            <div className="section-header" style={{ marginBottom: 10 }}>
              <div>
                <p className="eyebrow">Public homepage</p>
                <h2 style={{ fontSize: '2.3rem' }}>Manage signature scent posts</h2>
              </div>
              <button className="btn btn-secondary" type="button" onClick={loadPosts}>Refresh</button>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Image</th><th>Post</th><th>Order</th><th>Visible</th><th>Actions</th></tr></thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id}>
                      <td>{post.image_url ? <img className="product-thumb" src={post.image_url} alt={post.title} /> : <span className="muted">No image</span>}</td>
                      <td><strong>{post.title}</strong><br /><span className="muted">{post.subtitle || 'No subtitle'}</span></td>
                      <td>{post.sort_order}</td>
                      <td>{post.is_active ? 'Yes' : 'No'}</td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-secondary" type="button" onClick={() => editPost(post)}>Edit</button>
                          <button className="btn btn-secondary" type="button" onClick={() => toggleActive(post)}>{post.is_active ? 'Hide' : 'Show'}</button>
                          <button className="btn btn-danger" type="button" onClick={() => deletePost(post)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {posts.length === 0 ? <p className="muted">No What&apos;s New posts yet. Add one when you want it to appear publicly.</p> : null}
            </div>
          </article>
        </section>
      </main>
    </AdminGuard>
  );
}
