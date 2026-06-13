import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabaseAdmin';
import { formatCurrency } from '@/lib/format';

export const runtime = 'nodejs';

type OrderRequest = {
  customerName?: string;
  phone?: string;
  deliveryLocation?: string;
  deliveryTime?: string;
  notes?: string;
  channel?: 'website' | 'whatsapp';
  items?: Array<{ product_id: string; quantity: number }>;
};

function cleanText(value: unknown) {
  return String(value || '').trim();
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildOrderText(order: any) {
  const itemLines = (order.order_items || [])
    .map((item: any) => `${item.quantity} x ${item.product_name} — ${formatCurrency(item.subtotal)}`)
    .join('\n');

  return `New Dee's Scentry Order\n\nOrder Number: ${order.order_number}\nCustomer Name: ${order.customer_name}\nCustomer Phone: ${order.phone}\nDelivery Location: ${order.delivery_location}\nPreferred Delivery Time: ${order.delivery_time || 'Not specified'}\nOrder Channel: ${order.channel}\nOrder Status: ${order.status}\n\nOrder Items:\n${itemLines}\n\nOrder Total: ${formatCurrency(order.total_amount)}\nNotes: ${order.notes || 'None'}`;
}

function buildOrderHtml(order: any) {
  const itemRows = (order.order_items || [])
    .map((item: any) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eadfcb;">${escapeHtml(item.product_name)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eadfcb; text-align: center;">${escapeHtml(item.quantity)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eadfcb; text-align: right;">${escapeHtml(formatCurrency(item.subtotal))}</td>
      </tr>
    `)
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; color: #221a16; background: #fffaf2; padding: 24px;">
      <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #eadfcb; border-radius: 16px; overflow: hidden;">
        <div style="background: #241913; color: #f6d28b; padding: 24px;">
          <h1 style="margin: 0; font-size: 24px;">New Dee's Scentry Order</h1>
          <p style="margin: 8px 0 0; color: #f8e7c6;">${escapeHtml(order.order_number)}</p>
        </div>
        <div style="padding: 24px;">
          <h2 style="font-size: 18px; margin: 0 0 12px;">Customer</h2>
          <p style="margin: 0 0 20px; line-height: 1.7;">
            <strong>Name:</strong> ${escapeHtml(order.customer_name)}<br />
            <strong>Phone:</strong> ${escapeHtml(order.phone)}<br />
            <strong>Delivery Location:</strong> ${escapeHtml(order.delivery_location)}<br />
            <strong>Preferred Delivery Time:</strong> ${escapeHtml(order.delivery_time || 'Not specified')}<br />
            <strong>Channel:</strong> ${escapeHtml(order.channel)}<br />
            <strong>Status:</strong> ${escapeHtml(order.status)}
          </p>

          <h2 style="font-size: 18px; margin: 0 0 12px;">Items</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background: #f8edda;">
                <th style="padding: 10px; text-align: left;">Product</th>
                <th style="padding: 10px; text-align: center;">Qty</th>
                <th style="padding: 10px; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>

          <p style="font-size: 18px; margin: 0 0 20px;"><strong>Total:</strong> ${escapeHtml(formatCurrency(order.total_amount))}</p>
          <p style="margin: 0; line-height: 1.7;"><strong>Notes:</strong><br />${escapeHtml(order.notes || 'None')}</p>
        </div>
      </div>
    </div>
  `;
}

async function sendOrderEmail(order: any) {
  const apiKey = process.env.RESEND_API_KEY;
  const orderEmail = process.env.ORDER_EMAIL || 'deesscentry@gmail.com';
  const fromEmail = process.env.ORDER_FROM_EMAIL || "Dee's Scentry <onboarding@resend.dev>";

  if (!apiKey) {
    return { sent: false, error: 'RESEND_API_KEY is not configured.' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [orderEmail],
        subject: `New Dee's Scentry Order ${order.order_number}`,
        text: buildOrderText(order),
        html: buildOrderHtml(order)
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = data?.message || data?.error || `Resend returned ${response.status}`;
      return { sent: false, error: message };
    }

    return { sent: true, id: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email notification failed.';
    return { sent: false, error: message };
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OrderRequest;
    const customerName = cleanText(body.customerName);
    const phone = cleanText(body.phone);
    const deliveryLocation = cleanText(body.deliveryLocation);
    const deliveryTime = cleanText(body.deliveryTime);
    const notes = cleanText(body.notes);
    const channel = body.channel === 'whatsapp' ? 'whatsapp' : 'website';
    const items = Array.isArray(body.items) ? body.items : [];

    if (!customerName || !phone || !deliveryLocation) {
      return NextResponse.json({ error: 'Name, phone number, and delivery location are required.' }, { status: 400 });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 });
    }

    const normalizedItems = items.map((item) => ({
      product_id: cleanText(item.product_id),
      quantity: Number(item.quantity)
    }));

    if (normalizedItems.some((item) => !item.product_id || !Number.isInteger(item.quantity) || item.quantity < 1)) {
      return NextResponse.json({ error: 'Invalid cart item.' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: result, error: rpcError } = await supabase.rpc('create_order_with_inventory', {
      p_customer_name: customerName,
      p_phone: phone,
      p_delivery_location: deliveryLocation,
      p_delivery_time: deliveryTime || null,
      p_notes: notes || null,
      p_channel: channel,
      p_items: normalizedItems
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 400 });
    }

    const orderId = result?.order_id;
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order was created but could not be loaded.' }, { status: 500 });
    }

    const emailResult = await sendOrderEmail(order);
    if (!emailResult.sent) {
      console.error(`Order ${order.order_number} saved, but email notification failed:`, emailResult.error);
    }

    return NextResponse.json({ order, emailSent: emailResult.sent, emailId: emailResult.id || null, emailError: emailResult.error || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected order error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
