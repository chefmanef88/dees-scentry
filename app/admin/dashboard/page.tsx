'use client';

import { useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { AdminNav } from '@/components/AdminNav';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Order, Product } from '@/lib/types';

export default function AdminDashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState('Loading dashboard...');

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    setStatus('Loading dashboard...');
    const [productResponse, orderResponse] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(8)
    ]);

    if (productResponse.error || orderResponse.error) {
      setStatus(productResponse.error?.message || orderResponse.error?.message || 'Could not load dashboard.');
      return;
    }

    setProducts((productResponse.data || []) as Product[]);
    setOrders((orderResponse.data || []) as Order[]);
    setStatus('');
  }

  const activeProducts = products.filter((product) => product.is_active).length;
  const lowStockProducts = products.filter((product) => product.is_active && product.stock_quantity <= product.low_stock_threshold).length;
  const openOrders = orders.filter((order) => order.status === 'New' || order.status === 'Confirmed').length;
  const recentRevenue = orders.filter((order) => order.status !== 'Cancelled').reduce((sum, order) => sum + Number(order.total_amount), 0);

  return (
    <AdminGuard>
      <main className="admin-layout">
        <AdminNav />
        <section className="admin-grid">
          <article className="stat-card"><span className="muted">Active products</span><strong>{activeProducts}</strong></article>
          <article className="stat-card"><span className="muted">Low stock</span><strong>{lowStockProducts}</strong></article>
          <article className="stat-card"><span className="muted">Open orders</span><strong>{openOrders}</strong></article>
          <article className="stat-card"><span className="muted">Recent order value</span><strong>{formatCurrency(recentRevenue)}</strong></article>
        </section>

        {status ? <p className="notice">{status}</p> : null}

        <section className="admin-two-col">
          <article className="table-card">
            <h2 style={{ fontSize: '2rem' }}>Recent orders</h2>
            <div className="order-list" style={{ marginTop: 16 }}>
              {orders.length === 0 ? <p className="muted">No orders yet.</p> : null}
              {orders.map((order) => (
                <div className="order-card" key={order.id}>
                  <header>
                    <div>
                      <strong>{order.order_number}</strong>
                      <p className="muted" style={{ margin: 0 }}>{order.customer_name} · {order.phone}</p>
                    </div>
                    <span className="pill active">{order.status}</span>
                  </header>
                  <p className="muted">{order.delivery_location}</p>
                  <strong>{formatCurrency(order.total_amount)}</strong>
                  <p className="muted">{formatDate(order.created_at)}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="table-card">
            <h2 style={{ fontSize: '2rem' }}>Low stock watch</h2>
            <div className="table-wrapper" style={{ marginTop: 16 }}>
              <table>
                <thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Status</th></tr></thead>
                <tbody>
                  {products.filter((product) => product.stock_quantity <= product.low_stock_threshold).map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{product.category}</td>
                      <td>{product.stock_quantity}</td>
                      <td>{product.is_active ? 'Active' : 'Hidden'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lowStockProducts === 0 ? <p className="muted">No low-stock products.</p> : null}
            </div>
          </article>
        </section>
      </main>
    </AdminGuard>
  );
}
