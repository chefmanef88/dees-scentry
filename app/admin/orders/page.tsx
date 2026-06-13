'use client';

import { useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { AdminNav } from '@/components/AdminNav';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Order } from '@/lib/types';

const statuses = ['New', 'Confirmed', 'Delivered', 'Cancelled'] as const;

type OrderStatus = typeof statuses[number];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState('Loading orders...');
  const [savingId, setSavingId] = useState('');

  useEffect(() => {
    void loadOrders();
  }, []);

  async function loadOrders() {
    setStatus('Loading orders...');
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });

    if (error) setStatus(error.message);
    else {
      setOrders((data || []) as Order[]);
      setStatus('');
    }
  }

  async function updateStatus(order: Order, nextStatus: OrderStatus) {
    setSavingId(order.id);
    setStatus('Updating order...');

    try {
      if (nextStatus === 'Cancelled' && order.status !== 'Cancelled') {
        const { error } = await supabase.rpc('cancel_order_and_restore_inventory', { p_order_id: order.id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('orders').update({ status: nextStatus }).eq('id', order.id);
        if (error) throw error;
      }

      await loadOrders();
      setStatus('Order updated.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not update order.');
    } finally {
      setSavingId('');
    }
  }

  return (
    <AdminGuard>
      <main className="admin-layout">
        <AdminNav />
        <div className="section-header">
          <div>
            <p className="eyebrow">Orders</p>
            <h1 style={{ fontSize: '3rem' }}>Customer orders</h1>
            <p className="muted">Orders submitted from the website and WhatsApp checkout appear here.</p>
          </div>
          <button className="btn btn-secondary" type="button" onClick={loadOrders}>Refresh</button>
        </div>

        {status ? <p className="notice">{status}</p> : null}

        <section className="order-list">
          {orders.length === 0 ? <p className="empty-state">No orders yet.</p> : null}
          {orders.map((order) => (
            <article className="order-card" key={order.id}>
              <header>
                <div>
                  <p className="eyebrow">{order.channel === 'whatsapp' ? 'WhatsApp Checkout' : 'Website Checkout'}</p>
                  <h2 style={{ fontSize: '2rem' }}>{order.order_number}</h2>
                  <p className="muted" style={{ margin: 0 }}>{formatDate(order.created_at)}</p>
                </div>
                <div style={{ minWidth: 180 }}>
                  <label>Status
                    <select value={order.status} disabled={savingId === order.id || order.status === 'Cancelled'} onChange={(event) => updateStatus(order, event.target.value as OrderStatus)}>
                      {statuses.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                </div>
              </header>

              <div className="form-grid">
                <div><strong>Customer</strong><p className="muted">{order.customer_name}<br />{order.phone}</p></div>
                <div><strong>Delivery</strong><p className="muted">{order.delivery_location}<br />{order.delivery_time || 'No preferred time'}</p></div>
              </div>

              <ul className="order-items">
                {(order.order_items || []).map((item) => (
                  <li key={item.id}>{item.quantity} x {item.product_name} — {formatCurrency(item.subtotal)}</li>
                ))}
              </ul>

              <div className="summary-line">
                <span>Total</span>
                <strong>{formatCurrency(order.total_amount)}</strong>
              </div>
              {order.notes ? <p className="notice">Notes: {order.notes}</p> : null}
              {order.status === 'Cancelled' ? <p className="notice">This order has been cancelled. Stock was restored when it was cancelled.</p> : null}
            </article>
          ))}
        </section>
      </main>
    </AdminGuard>
  );
}
