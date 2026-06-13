'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { AdminNav } from '@/components/AdminNav';
import { supabase } from '@/lib/supabase';
import { formatCurrency, safeFileName } from '@/lib/format';
import type { Product, ProductCategory } from '@/lib/types';

type ProductForm = {
  id?: string;
  name: string;
  brand: string;
  category: ProductCategory;
  size_ml: string;
  price: string;
  stock_quantity: string;
  low_stock_threshold: string;
  fragrance_notes: string;
  description: string;
  image_url: string;
  is_active: boolean;
};

type LookupSuggestion = {
  name: string;
  brand: string;
  category: ProductCategory;
  size_ml: number | null;
  fragrance_notes: string;
  description: string;
  source: string;
};

type ImageSuggestion = {
  title: string;
  thumbnail: string;
  original: string;
  source: string;
};

type LookupResponse = {
  suggestion: LookupSuggestion;
  images: ImageSuggestion[];
  imageSearchEnabled: boolean;
};

const emptyForm: ProductForm = {
  name: '',
  brand: '',
  category: 'Unisex',
  size_ml: '100',
  price: '',
  stock_quantity: '0',
  low_stock_threshold: '3',
  fragrance_notes: '',
  description: '',
  image_url: '',
  is_active: true
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [lookupStatus, setLookupStatus] = useState('');
  const [lookup, setLookup] = useState<LookupResponse | null>(null);
  const [importingImageUrl, setImportingImageUrl] = useState('');

  useEffect(() => {
    void loadProducts();
  }, []);

  async function loadProducts() {
    setStatus('Loading products...');
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) setStatus(error.message);
    else {
      setProducts((data || []) as Product[]);
      setStatus('');
    }
  }

  async function getAdminAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }

  async function findProductDetails() {
    const productName = form.name.trim();
    if (productName.length < 2) {
      setLookupStatus('Type the perfume name first.');
      return;
    }

    setLookupStatus('Finding product details and picture suggestions...');
    setLookup(null);

    try {
      const token = await getAdminAccessToken();
      const response = await fetch('/api/product-lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: productName })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not find product details.');

      setLookup(data as LookupResponse);
      setLookupStatus(data.imageSearchEnabled ? 'Review the suggestion before saving.' : 'Details found. Add SERPAPI_KEY later if you want live online image suggestions too.');
    } catch (error) {
      setLookupStatus(error instanceof Error ? error.message : 'Could not find product details.');
    }
  }

  function applyLookupSuggestion() {
    if (!lookup?.suggestion) return;
    const suggestion = lookup.suggestion;
    setForm((current) => ({
      ...current,
      name: suggestion.name || current.name,
      brand: suggestion.brand || current.brand,
      category: suggestion.category || current.category,
      size_ml: suggestion.size_ml ? String(suggestion.size_ml) : current.size_ml,
      fragrance_notes: suggestion.fragrance_notes || current.fragrance_notes,
      description: suggestion.description || current.description
    }));
    setLookupStatus('Suggestion applied. Add your price and stock, then save.');
  }

  async function importSuggestedImage(imageUrl: string) {
    setImportingImageUrl(imageUrl);
    setLookupStatus('Importing selected image into your product image storage...');

    try {
      const token = await getAdminAccessToken();
      const response = await fetch('/api/product-image-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ imageUrl, productName: form.name || lookup?.suggestion.name || 'perfume' })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not import image.');

      setForm((current) => ({ ...current, image_url: data.imageUrl }));
      setImageFile(null);
      setLookupStatus('Image imported. Review the product details, add price and stock, then save.');
    } catch (error) {
      setLookupStatus(error instanceof Error ? error.message : 'Could not import image. You can still upload manually.');
    } finally {
      setImportingImageUrl('');
    }
  }

  async function uploadImage() {
    if (!imageFile) return form.image_url || null;

    const extension = imageFile.name.split('.').pop() || 'jpg';
    const path = `${Date.now()}-${safeFileName(form.name || 'perfume')}.${extension}`;
    const { error } = await supabase.storage.from('product-images').upload(path, imageFile, {
      cacheControl: '3600',
      upsert: false
    });

    if (error) throw error;
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus('Saving product...');

    try {
      const imageUrl = await uploadImage();
      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        category: form.category,
        size_ml: form.size_ml ? Number(form.size_ml) : null,
        price: Number(form.price),
        stock_quantity: Number(form.stock_quantity),
        low_stock_threshold: Number(form.low_stock_threshold),
        fragrance_notes: form.fragrance_notes.trim() || null,
        description: form.description.trim() || null,
        image_url: imageUrl,
        is_active: form.is_active
      };

      if (!payload.name || !payload.price) throw new Error('Product name and price are required.');
      if (payload.stock_quantity < 0) throw new Error('Stock quantity cannot be negative.');

      const response = form.id
        ? await supabase.from('products').update(payload).eq('id', form.id)
        : await supabase.from('products').insert(payload);

      if (response.error) throw response.error;
      setForm(emptyForm);
      setImageFile(null);
      setLookup(null);
      setLookupStatus('');
      setStatus('Product saved.');
      await loadProducts();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save product.');
    } finally {
      setSaving(false);
    }
  }

  function editProduct(product: Product) {
    setForm({
      id: product.id,
      name: product.name,
      brand: product.brand || '',
      category: product.category,
      size_ml: product.size_ml ? String(product.size_ml) : '',
      price: String(product.price),
      stock_quantity: String(product.stock_quantity),
      low_stock_threshold: String(product.low_stock_threshold),
      fragrance_notes: product.fragrance_notes || '',
      description: product.description || '',
      image_url: product.image_url || '',
      is_active: product.is_active
    });
    setLookup(null);
    setLookupStatus('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteProduct(product: Product) {
    if (!confirm(`Delete ${product.name}? This should only be used for products with no orders.`)) return;
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (error) setStatus(error.message);
    else {
      setStatus('Product deleted.');
      await loadProducts();
    }
  }

  async function toggleActive(product: Product) {
    const { error } = await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id);
    if (error) setStatus(error.message);
    else await loadProducts();
  }

  return (
    <AdminGuard>
      <main className="admin-layout">
        <AdminNav />
        <section className="admin-two-col">
          <form className="admin-card admin-form" onSubmit={saveProduct}>
            <p className="eyebrow">Product upload</p>
            <h1 style={{ fontSize: '2.6rem' }}>{form.id ? 'Edit perfume' : 'Add new perfume'}</h1>

            <label>
              Product name
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Versace Bright Crystal" required />
            </label>

            <div className="admin-actions lookup-actions">
              <button className="btn btn-secondary" type="button" onClick={findProductDetails}>Find product details</button>
              <span className="muted">Auto-suggest notes, description, and picture options. Admin must approve before saving.</span>
            </div>

            {lookup ? (
              <div className="lookup-panel">
                <div className="lookup-summary">
                  <p className="eyebrow">Suggested details</p>
                  <h3>{lookup.suggestion.name}</h3>
                  <p><strong>Brand:</strong> {lookup.suggestion.brand || 'Not sure yet'}</p>
                  <p><strong>Category:</strong> {lookup.suggestion.category}</p>
                  <p><strong>Composition:</strong> {lookup.suggestion.fragrance_notes || 'No notes found. Add manually.'}</p>
                  <p>{lookup.suggestion.description}</p>
                  <button className="btn btn-primary" type="button" onClick={applyLookupSuggestion}>Apply suggested details</button>
                </div>

                <div>
                  <p className="eyebrow">Picture suggestions</p>
                  {!lookup.imageSearchEnabled ? <p className="muted">Live image search is not active yet. Add a SERPAPI_KEY in your environment variables, or upload a product picture manually below.</p> : null}
                  {lookup.images.length > 0 ? (
                    <div className="image-suggestions">
                      {lookup.images.map((image) => (
                        <button
                          className="image-suggestion"
                          key={image.original}
                          type="button"
                          onClick={() => importSuggestedImage(image.original)}
                          disabled={Boolean(importingImageUrl)}
                          title={image.title}
                        >
                          <img src={image.thumbnail} alt={image.title} />
                          <span>{importingImageUrl === image.original ? 'Importing...' : 'Use this picture'}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {lookupStatus ? <p className="notice">{lookupStatus}</p> : null}

            <div className="form-grid">
              <label>Brand<input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} placeholder="Versace" /></label>
              <label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ProductCategory })}><option>Men</option><option>Women</option><option>Unisex</option></select></label>
            </div>
            <div className="form-grid">
              <label>Size ml<input type="number" min="1" value={form.size_ml} onChange={(event) => setForm({ ...form, size_ml: event.target.value })} /></label>
              <label>Price GH₵<input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></label>
            </div>
            <div className="form-grid">
              <label>Stock quantity<input type="number" min="0" value={form.stock_quantity} onChange={(event) => setForm({ ...form, stock_quantity: event.target.value })} required /></label>
              <label>Low-stock alert<input type="number" min="0" value={form.low_stock_threshold} onChange={(event) => setForm({ ...form, low_stock_threshold: event.target.value })} /></label>
            </div>
            <label>Composition / fragrance notes<input value={form.fragrance_notes} onChange={(event) => setForm({ ...form, fragrance_notes: event.target.value })} placeholder="Top: yuzu. Heart: peony. Base: musk." /></label>
            <label>Description<textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Short product description" /></label>
            <label>Upload product picture<input type="file" accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] || null)} /></label>
            {form.image_url ? <img className="product-thumb large-thumb" src={form.image_url} alt="Selected product" /> : null}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}><input type="checkbox" style={{ width: 'auto' }} checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Show on website</label>
            <div className="admin-actions">
              <button className="btn btn-primary" disabled={saving} type="submit">{form.id ? 'Update product' : 'Save product'}</button>
              {form.id ? <button className="btn btn-secondary" type="button" onClick={() => { setForm(emptyForm); setImageFile(null); setLookup(null); setLookupStatus(''); }}>Cancel edit</button> : null}
            </div>
            {status ? <p className="notice">{status}</p> : null}
          </form>

          <article className="table-card">
            <div className="section-header" style={{ marginBottom: 10 }}>
              <div>
                <p className="eyebrow">Catalog</p>
                <h2 style={{ fontSize: '2.3rem' }}>Manage products</h2>
              </div>
              <button className="btn btn-secondary" type="button" onClick={loadProducts}>Refresh</button>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Image</th><th>Product</th><th>Price</th><th>Stock</th><th>Visible</th><th>Actions</th></tr></thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.image_url ? <img className="product-thumb" src={product.image_url} alt={product.name} /> : <span className="mini-bottle" style={{ transform: 'scale(.52)' }} />}</td>
                      <td><strong>{product.name}</strong><br /><span className="muted">{product.brand || 'No brand'} · {product.category}{product.size_ml ? ` · ${product.size_ml}ml` : ''}</span></td>
                      <td>{formatCurrency(product.price)}</td>
                      <td>{product.stock_quantity}</td>
                      <td>{product.is_active ? 'Yes' : 'No'}</td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-secondary" type="button" onClick={() => editProduct(product)}>Edit</button>
                          <button className="btn btn-secondary" type="button" onClick={() => toggleActive(product)}>{product.is_active ? 'Hide' : 'Show'}</button>
                          <button className="btn btn-danger" type="button" onClick={() => deleteProduct(product)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {products.length === 0 ? <p className="muted">No products yet. Add your first perfume to publish it.</p> : null}
            </div>
          </article>
        </section>
      </main>
    </AdminGuard>
  );
}
