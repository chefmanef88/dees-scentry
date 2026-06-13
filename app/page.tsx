'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BUSINESS } from '@/lib/business';
import { formatCurrency } from '@/lib/format';
import type { CustomerDetails, FeaturedPost, Product } from '@/lib/types';

type Cart = Record<string, number>;
type CheckoutMode = 'website' | 'whatsapp';

type CreatedOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  phone: string;
  delivery_location: string;
  delivery_time: string | null;
  notes: string | null;
  channel: CheckoutMode;
  status: string;
  total_amount: number;
  order_items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
};

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productError, setProductError] = useState('');
  const [featuredPosts, setFeaturedPosts] = useState<FeaturedPost[]>([]);
  const [filter, setFilter] = useState<'All' | 'Men' | 'Women' | 'Unisex'>('All');
  const [cart, setCart] = useState<Cart>({});
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customer, setCustomer] = useState<CustomerDetails>({
    customerName: '',
    phone: '',
    deliveryLocation: '',
    deliveryTime: '',
    notes: ''
  });
  const [headerHidden, setHeaderHidden] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('dees-scentry-cart');
    if (saved) setCart(JSON.parse(saved));
    loadProducts();
    loadFeaturedPosts();
  }, []);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    function handleScroll() {
      const currentScrollY = window.scrollY;
      const isMovingDown = currentScrollY > lastScrollY;

      setHeaderHidden(isMovingDown && currentScrollY > 88);
      lastScrollY = currentScrollY;
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('dees-scentry-cart', JSON.stringify(cart));
  }, [cart]);

  async function loadProducts() {
    setLoadingProducts(true);
    setProductError('');
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) setProductError(error.message);
    setProducts((data || []) as Product[]);
    setLoadingProducts(false);
  }

  async function loadFeaturedPosts() {
    const { data, error } = await supabase
      .from('featured_posts')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (!error) setFeaturedPosts((data || []) as FeaturedPost[]);
  }

  const filteredProducts = useMemo(() => {
    if (filter === 'All') return products;
    return products.filter((product) => product.category === filter);
  }, [products, filter]);

  const cartEntries = useMemo(() => {
    return Object.entries(cart)
      .map(([productId, quantity]) => ({ product: products.find((item) => item.id === productId), quantity }))
      .filter((entry): entry is { product: Product; quantity: number } => Boolean(entry.product) && entry.quantity > 0);
  }, [cart, products]);

  const subtotal = cartEntries.reduce((sum, entry) => sum + Number(entry.product.price) * entry.quantity, 0);
  const cartCount = cartEntries.reduce((sum, entry) => sum + entry.quantity, 0);

  function addToCart(product: Product) {
    if (product.stock_quantity <= 0) return;
    setCart((current) => {
      const currentQty = current[product.id] || 0;
      if (currentQty >= product.stock_quantity) return current;
      return { ...current, [product.id]: currentQty + 1 };
    });
    setStatus(`${product.name} added to cart.`);
  }

  function updateQuantity(productId: string, nextQuantity: number) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setCart((current) => {
      const copy = { ...current };
      if (nextQuantity <= 0) delete copy[productId];
      else copy[productId] = Math.min(nextQuantity, product.stock_quantity);
      return copy;
    });
  }

  function buildWhatsAppMessage(order: CreatedOrder) {
    const lines = order.order_items
      .map((item) => `${item.quantity} x ${item.product_name} - ${formatCurrency(item.subtotal)}`)
      .join('\n');

    return `New Dee's Scentry Order\n\nOrder No: ${order.order_number}\nCustomer: ${order.customer_name}\nPhone: ${order.phone}\nDelivery Location: ${order.delivery_location}\nDelivery Time: ${order.delivery_time || 'Not specified'}\n\nOrder:\n${lines}\n\nTotal: ${formatCurrency(order.total_amount)}\n\nNotes: ${order.notes || 'None'}`;
  }

  async function submitOrder(mode: CheckoutMode) {
    if (!cartEntries.length) {
      setStatus('Please add at least one perfume to your cart.');
      return;
    }
    if (!customer.customerName.trim() || !customer.phone.trim() || !customer.deliveryLocation.trim()) {
      setStatus('Please fill your name, phone number, and delivery location.');
      return;
    }

    setIsSubmitting(true);
    setStatus('Submitting your order...');

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...customer,
          channel: mode,
          items: cartEntries.map((entry) => ({ product_id: entry.product.id, quantity: entry.quantity }))
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Order could not be submitted.');

      const order = data.order as CreatedOrder;
      setCart({});
      await loadProducts();

      if (mode === 'whatsapp') {
        const message = buildWhatsAppMessage(order);
        const whatsappUrl = `https://wa.me/${BUSINESS.whatsappNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        setStatus(`Order ${order.order_number} created. WhatsApp is opening with your order details.`);
      } else {
        setStatus(`Thank you. Your order ${order.order_number} has been submitted. Dee's Scentry will contact you to confirm availability and delivery.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong.';
      setStatus(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitOrder('website');
  }

  return (
    <>
      <header className={`site-header ${headerHidden ? 'header-hidden' : ''}`} id="top">
        <nav className="navbar" aria-label="Main navigation">
          <a href="#top" className="brand" aria-label="Dee's Scentry home">
            <span className="brand-mark">D</span>
            <span>Dee&apos;s Scentry</span>
          </a>
          <div className="nav-links">
            <a href="#shop">Shop</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
            <a href="#cart">Cart <span className="cart-count">{cartCount}</span></a>
          </div>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-content">
            <p className="eyebrow">Authentic · Curated · Delivered</p>
            <h1>Fragrances that tell your story.</h1>
            <p className="hero-text">Handpicked luxury perfumes for men, women and unisex — delivered to your door across Ghana.</p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#shop">Shop the catalog</a>
              <a className="btn btn-secondary" href={`tel:${BUSINESS.phoneTel}`}>Call to order</a>
            </div>
            <div className="quick-contact" aria-label="Dee's Scentry contact options">
              <a href={`tel:${BUSINESS.phoneTel}`}>Call: {BUSINESS.phoneDisplay}</a>
              <a href={`https://wa.me/${BUSINESS.whatsappNumber}`} target="_blank" rel="noopener noreferrer">WhatsApp us</a>
            </div>
          </div>
          <div className="hero-card hero-card-premium" aria-label="Luxury Dee's Scentry perfume bottle">
            <div className="hero-glow hero-glow-one" />
            <div className="hero-glow hero-glow-two" />
            <div className="perfume-stage">
              <svg className="luxury-bottle-svg" viewBox="0 0 420 520" role="img" aria-labelledby="heroBottleTitle">
                <title id="heroBottleTitle">Realistic Dee's Scentry perfume bottle</title>
                <defs>
                  <linearGradient id="capGold" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6f3f16" />
                    <stop offset="22%" stopColor="#f3c76c" />
                    <stop offset="50%" stopColor="#fff0b9" />
                    <stop offset="78%" stopColor="#b97823" />
                    <stop offset="100%" stopColor="#4b260d" />
                  </linearGradient>
                  <linearGradient id="glassBody" x1="8%" y1="0%" x2="92%" y2="100%">
                    <stop offset="0%" stopColor="rgba(255, 245, 225, .44)" />
                    <stop offset="20%" stopColor="rgba(98, 68, 40, .28)" />
                    <stop offset="54%" stopColor="rgba(18, 12, 9, .78)" />
                    <stop offset="82%" stopColor="rgba(207, 142, 52, .22)" />
                    <stop offset="100%" stopColor="rgba(255, 240, 190, .32)" />
                  </linearGradient>
                  <radialGradient id="warmHalo" cx="50%" cy="82%" r="55%">
                    <stop offset="0%" stopColor="#f2ce82" stopOpacity=".62" />
                    <stop offset="58%" stopColor="#8b4e19" stopOpacity=".2" />
                    <stop offset="100%" stopColor="#110a07" stopOpacity="0" />
                  </radialGradient>
                  <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="22" stdDeviation="18" floodColor="#000000" floodOpacity=".55" />
                  </filter>
                </defs>

                <ellipse cx="210" cy="468" rx="142" ry="24" fill="#000" opacity=".38" />
                <ellipse cx="210" cy="398" rx="170" ry="112" fill="url(#warmHalo)" opacity=".9" />
                <g filter="url(#softShadow)">
                  <rect x="162" y="82" width="96" height="62" rx="13" fill="url(#capGold)" />
                  <rect x="154" y="74" width="112" height="22" rx="10" fill="url(#capGold)" opacity=".93" />
                  <path d="M171 124 H249 V176 H171 Z" fill="rgba(255,240,205,.18)" stroke="rgba(255,244,220,.34)" strokeWidth="2" />
                  <path d="M105 183 Q105 154 134 154 H286 Q315 154 315 183 V379 Q315 449 252 449 H168 Q105 449 105 379 Z" fill="url(#glassBody)" stroke="rgba(255, 245, 224, .48)" strokeWidth="3" />
                  <path d="M123 190 Q123 174 141 173 H181 V430 H163 Q123 430 123 377 Z" fill="rgba(255,255,255,.13)" opacity=".72" />
                  <path d="M286 186 Q298 196 298 226 V377 Q298 414 270 430" fill="none" stroke="rgba(255,240,200,.24)" strokeWidth="8" strokeLinecap="round" />
                  <rect x="143" y="246" width="134" height="124" rx="4" fill="rgba(11,8,6,.78)" stroke="#e7bd6d" strokeWidth="3" />
                  <rect x="152" y="255" width="116" height="106" rx="2" fill="rgba(16,10,7,.92)" stroke="rgba(255,242,220,.12)" />
                  <text x="210" y="302" textAnchor="middle" fill="#f7dfad" fontFamily="Georgia, serif" fontSize="28">Dee&apos;s</text>
                  <text x="210" y="337" textAnchor="middle" fill="#fff2dc" fontFamily="Georgia, serif" fontSize="38" fontWeight="700">Scentry</text>
                  <text x="210" y="381" textAnchor="middle" fill="#d8a84d" fontFamily="Arial, sans-serif" fontSize="11" letterSpacing="3">EAU DE PARFUM</text>
                  <text x="210" y="401" textAnchor="middle" fill="#c6ac8d" fontFamily="Arial, sans-serif" fontSize="10" letterSpacing="2">100 ML</text>
                </g>
              </svg>
              <div className="stage-reflection" />
            </div>
          </div>
        </section>

        <section className="section intro" id="about">
          <div>
            <p className="eyebrow">Luxury, made personal</p>
            <h2>Curated scents for every mood, moment, and memory.</h2>
          </div>
          <p>Whether you prefer fresh, woody, floral, sweet, or bold signature scents, Dee&apos;s Scentry helps you choose perfumes that feel personal, premium, and unforgettable.</p>
        </section>

        <section className="section contact-strip" id="contact">
          <div>
            <p className="eyebrow">Need help choosing?</p>
            <h2>Talk to Dee&apos;s Scentry directly.</h2>
          </div>
          <div className="contact-actions">
            <a className="btn btn-primary" href={`tel:${BUSINESS.phoneTel}`}>Call {BUSINESS.phoneDisplay}</a>
            <a className="btn btn-secondary" href={`https://wa.me/${BUSINESS.whatsappNumber}`} target="_blank" rel="noopener noreferrer">Open WhatsApp</a>
          </div>
        </section>

        <section className="section" id="shop">
          <div className="section-header">
            <div>
              <p className="eyebrow">The Collection</p>
              <h2>Browse available perfumes.</h2>
            </div>
            <div className="filter-tabs" role="tablist" aria-label="Perfume categories">
              {(['All', 'Men', 'Women', 'Unisex'] as const).map((item) => (
                <button key={item} className={`filter ${filter === item ? 'active' : ''}`} type="button" onClick={() => setFilter(item)}>{item}</button>
              ))}
            </div>
          </div>

          {productError ? <p className="notice error">Products are temporarily unavailable. Please call or WhatsApp Dee&apos;s Scentry to confirm availability.</p> : null}
          {loadingProducts ? <p className="notice">Loading perfumes...</p> : null}

          <div className="product-grid">
            {!loadingProducts && filteredProducts.length === 0 ? (
              <div className="empty-state">No perfumes available yet. Please check back soon or call Dee&apos;s Scentry.</div>
            ) : null}
            {filteredProducts.map((product) => {
              const outOfStock = product.stock_quantity <= 0;
              const lowStock = product.stock_quantity > 0 && product.stock_quantity <= product.low_stock_threshold;
              return (
                <article className="product-card" key={product.id}>
                  {product.image_url ? <img className="product-image" src={product.image_url} alt={product.name} /> : <div className="product-placeholder"><span className="mini-bottle" /></div>}
                  <div className="product-body">
                    <h3>{product.name}</h3>
                    <div className="product-meta">
                      <span>{product.category}{product.size_ml ? ` · ${product.size_ml}ml` : ''}</span>
                      <span>{formatCurrency(product.price)}</span>
                    </div>
                    <p className="product-desc">{product.description || 'Premium fragrance from Dee\'s Scentry.'}</p>
                    {product.fragrance_notes ? <small>{product.fragrance_notes}</small> : null}
                    <p><span className={`stock-badge ${outOfStock || lowStock ? 'low' : ''}`}>{outOfStock ? 'Out of stock' : lowStock ? `Only ${product.stock_quantity} left` : 'In stock'}</span></p>
                    <div className="card-actions">
                      <button className="btn btn-primary" type="button" disabled={outOfStock} onClick={() => addToCart(product)}>{outOfStock ? 'Sold Out' : 'Add to Cart'}</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {featuredPosts.length > 0 ? (
          <section className="section featured-posts" id="featured">
            <div className="section-header">
              <div>
                <p className="eyebrow">What&apos;s new</p>
                <h2>Signature scent picks.</h2>
              </div>
              <p className="muted">Fresh picks and announcements from Dee&apos;s Scentry.</p>
            </div>
            <div className="featured-grid">
              {featuredPosts.map((post) => (
                <article className="featured-post-card" key={post.id}>
                  {post.image_url ? <img className="featured-image" src={post.image_url} alt={post.title} /> : null}
                  <div className="featured-post-body">
                    {post.subtitle ? <p className="eyebrow">{post.subtitle}</p> : null}
                    <h3>{post.title}</h3>
                    {post.body ? <p>{post.body}</p> : null}
                    {post.cta_label && post.cta_href ? <a className="btn btn-secondary" href={post.cta_href}>{post.cta_label}</a> : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="section cart-section" id="cart">
          <div className="section-header">
            <div>
              <p className="eyebrow">Checkout</p>
              <h2>Review your cart and submit your order.</h2>
            </div>
            <button className="btn btn-secondary" type="button" onClick={() => setCart({})}>Clear cart</button>
          </div>

          <div className="cart-panel">
            <div>
              <div className="cart-items">
                {cartEntries.length === 0 ? <p className="empty-cart muted">Your cart is empty. Add a perfume from the collection.</p> : null}
                {cartEntries.map(({ product, quantity }) => (
                  <article className="cart-item" key={product.id}>
                    <div>
                      <strong>{product.name}</strong>
                      <div className="muted">{formatCurrency(product.price)} × {quantity}</div>
                    </div>
                    <div className="quantity-controls" aria-label={`Quantity controls for ${product.name}`}>
                      <button type="button" onClick={() => updateQuantity(product.id, quantity - 1)}>−</button>
                      <span>{quantity}</span>
                      <button type="button" onClick={() => updateQuantity(product.id, quantity + 1)}>+</button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="summary-line" style={{ marginTop: 18 }}>
                <span>Subtotal</span>
                <strong>{formatCurrency(subtotal)}</strong>
              </div>
              <p className="muted">Delivery fee is confirmed based on your location.</p>
            </div>

            <form className="checkout-form" onSubmit={onFormSubmit}>
              <h3>Delivery details</h3>
              <p className="form-help">Fill in your delivery details, then choose how you want to submit your order.</p>
              <label>Full name<input type="text" value={customer.customerName} onChange={(e) => setCustomer({ ...customer, customerName: e.target.value })} placeholder="Your full name" required /></label>
              <label>Phone number<input type="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="024 000 0000" required /></label>
              <label>Delivery location<textarea rows={3} value={customer.deliveryLocation} onChange={(e) => setCustomer({ ...customer, deliveryLocation: e.target.value })} placeholder="Area, city, landmark, or delivery address" required /></label>
              <label>Preferred delivery time<input type="text" value={customer.deliveryTime} onChange={(e) => setCustomer({ ...customer, deliveryTime: e.target.value })} placeholder="Example: Tomorrow afternoon" /></label>
              <label>Extra notes<textarea rows={3} value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} placeholder="Any scent preference, delivery note, or special request" /></label>
              <div className="summary-line checkout-total"><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
              <div className="checkout-actions">
                <button className="btn btn-primary full-width" type="submit" disabled={isSubmitting}>Submit Order</button>
                <button className="btn btn-secondary full-width" type="button" disabled={isSubmitting} onClick={() => submitOrder('whatsapp')}>Submit to WhatsApp</button>
              </div>
              {status ? <p className={`notice ${status.toLowerCase().includes('thank') || status.toLowerCase().includes('created') ? 'success' : ''}`}>{status}</p> : <p className="form-help">Dee&apos;s Scentry will confirm availability, delivery fee, and payment details.</p>}
            </form>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>© 2026 Dee&apos;s Scentry. Crafted with love in Ghana.</p>
        <div className="footer-links">
          <a href={`tel:${BUSINESS.phoneTel}`}>Call</a>
          <a href={`https://wa.me/${BUSINESS.whatsappNumber}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a href="#top">Back to top</a>
        </div>
      </footer>
    </>
  );
}
