'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { AdminNav } from '@/components/AdminNav';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import type { InventoryMovement, Product } from '@/lib/types';

type AdjustmentForm = Record<string, { quantity: string; reason: string }>;

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [forms, setForms] = useState<AdjustmentForm>({});
  const [status, setStatus] = useState('Loading inventory...');

  useEffect(() => {
    void loadInventory();
  }, []);

  async function loadInventory() {
    setStatus('Loading inventory...');
    const [productsResponse, movementsResponse] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('inventory_movements').select('*').order('created_at', { ascending: false }).limit(30)
    ]);

    if (productsResponse.error || movementsResponse.error) {
      setStatus(productsResponse.error?.message || movementsResponse.error?.message || 'Could not load inventory.');
      return;
    }

    setProducts((productsResponse.data || []) as Product[]);
    setMovements((movementsResponse.data || []) as InventoryMovement[]);
    setStatus('');
  }

  function updateForm(productId: string, patch: Partial<{ quantity: string; reason: string }>) {
    setForms((current) => ({
      ...current,
      [productId]: { quantity: current[productId]?.quantity || '', reason: current[productId]?.reason || '', ...patch }
    }));
  }

  async function adjustStock(event: FormEvent<HTMLFormElement>, product: Product) {
    event.preventDefault();
    const adjustment = forms[product.id];
    const quantity = Number(adjustment?.quantity || 0);
    const reason = adjustment?.reason?.trim() || 'Manual inventory adjustment';

    if (!Number.isInteger(quantity) || quantity === 0) {
      setStatus('Enter a whole number. Use positive numbers to add stock and negative numbers to reduce stock.');
      return;
    }

    const nextStock = product.stock_quantity + quantity;
    if (nextStock < 0) {
      setStatus(`Cannot reduce ${product.name} below zero stock.`);
      return;
    }

    setStatus('Updating stock...');
    const { error: updateError } = await supabase.from('products').update({ stock_quantity: nextStock }).eq('id', product.id);
    if (updateError) {
      setStatus(updateError.message);
      return;
    }

    const movementType = quantity > 0 ? 'restock' : 'adjustment';
    const { error: movementError } = await supabase.from('inventory_movements').insert({
      product_id: product.id,
      movement_type: movementType,
      quantity,
      reason
    });

    if (movementError) setStatus(movementError.message);
    else {
      updateForm(product.id, { quantity: '', reason: '' });
      setStatus('Inventory updated.');
      await loadInventory();
    }
  }

  return (
    <AdminGuard>
      <main className="admin-layout">
        <AdminNav />
        <div className="section-header">
          <div>
            <p className="eyebrow">Inventory</p>
            <h1 style={{ fontSize: '3rem' }}>Stock control</h1>
            <p className="muted">Customer orders reduce stock automatically. Use this page to add new stock or correct inventory.</p>
          </div>
          <button className="btn btn-secondary" type="button" onClick={loadInventory}>Refresh</button>
        </div>

        {status ? <p className="notice">{status}</p> : null}

        <section className="admin-two-col">
          <article className="table-card">
            <h2 style={{ fontSize: '2rem' }}>Adjust stock</h2>
            <div className="table-wrapper" style={{ marginTop: 16 }}>
              <table>
                <thead><tr><th>Product</th><th>Current</th><th>Adjustment</th></tr></thead>
                <tbody>
                  {products.map((product) => {
                    const productForm = forms[product.id] || { quantity: '', reason: '' };
                    return (
                      <tr key={product.id}>
                        <td><strong>{product.name}</strong><br /><span className="muted">{product.category}</span></td>
                        <td><span className={`stock-badge ${product.stock_quantity <= product.low_stock_threshold ? 'low' : ''}`}>{product.stock_quantity}</span></td>
                        <td>
                          <form className="admin-form" onSubmit={(event) => adjustStock(event, product)}>
                            <input type="number" placeholder="+10 or -2" value={productForm.quantity} onChange={(event) => updateForm(product.id, { quantity: event.target.value })} />
                            <input placeholder="Reason" value={productForm.reason} onChange={(event) => updateForm(product.id, { reason: event.target.value })} />
                            <button className="btn btn-primary" type="submit">Update</button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>

          <article className="table-card">
            <h2 style={{ fontSize: '2rem' }}>Recent movements</h2>
            <div className="table-wrapper" style={{ marginTop: 16 }}>
              <table>
                <thead><tr><th>Date</th><th>Type</th><th>Qty</th><th>Reason</th></tr></thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{formatDate(movement.created_at)}</td>
                      <td>{movement.movement_type}</td>
                      <td>{movement.quantity}</td>
                      <td>{movement.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {movements.length === 0 ? <p className="muted">No inventory movements yet.</p> : null}
            </div>
          </article>
        </section>
      </main>
    </AdminGuard>
  );
}
