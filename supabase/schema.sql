-- Dee's Scentry database setup
-- Run this in Supabase SQL Editor before deploying the app.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  category text not null check (category in ('Men', 'Women', 'Unisex')),
  size_ml integer check (size_ml is null or size_ml > 0),
  price numeric(10,2) not null check (price >= 0),
  description text,
  fragrance_notes text,
  image_url text,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.featured_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  body text,
  image_url text,
  cta_label text,
  cta_href text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null default ('DS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  customer_name text not null,
  phone text not null,
  delivery_location text not null,
  delivery_time text,
  notes text,
  channel text not null default 'website' check (channel in ('website', 'whatsapp')),
  status text not null default 'New' check (status in ('New', 'Confirmed', 'Delivered', 'Cancelled')),
  total_amount numeric(10,2) not null default 0 check (total_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  subtotal numeric(10,2) not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  movement_type text not null check (movement_type in ('restock', 'sale', 'adjustment', 'return')),
  quantity integer not null,
  reason text,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists set_featured_posts_updated_at on public.featured_posts;
create trigger set_featured_posts_updated_at
before update on public.featured_posts
for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create or replace function public.is_dees_scentry_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'deesscentry@gmail.com';
$$;

create or replace function public.create_order_with_inventory(
  p_customer_name text,
  p_phone text,
  p_delivery_location text,
  p_delivery_time text,
  p_notes text,
  p_channel text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_subtotal numeric(10,2);
  v_total numeric(10,2) := 0;
begin
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'Customer name is required.';
  end if;

  if p_phone is null or length(trim(p_phone)) = 0 then
    raise exception 'Phone number is required.';
  end if;

  if p_delivery_location is null or length(trim(p_delivery_location)) = 0 then
    raise exception 'Delivery location is required.';
  end if;

  if p_channel not in ('website', 'whatsapp') then
    raise exception 'Invalid order channel.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;

  insert into public.orders (
    customer_name,
    phone,
    delivery_location,
    delivery_time,
    notes,
    channel,
    status
  ) values (
    trim(p_customer_name),
    trim(p_phone),
    trim(p_delivery_location),
    nullif(trim(coalesce(p_delivery_time, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_channel,
    'New'
  ) returning id, order_number into v_order_id, v_order_number;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_quantity is null or v_quantity < 1 then
      raise exception 'Invalid product quantity.';
    end if;

    select * into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid
      and is_active = true
    for update;

    if not found then
      raise exception 'A selected product is no longer available.';
    end if;

    if v_product.stock_quantity < v_quantity then
      raise exception 'Only % left for %.', v_product.stock_quantity, v_product.name;
    end if;

    v_subtotal := v_product.price * v_quantity;
    v_total := v_total + v_subtotal;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      subtotal
    ) values (
      v_order_id,
      v_product.id,
      v_product.name,
      v_quantity,
      v_product.price,
      v_subtotal
    );

    update public.products
    set stock_quantity = stock_quantity - v_quantity
    where id = v_product.id;

    insert into public.inventory_movements (
      product_id,
      movement_type,
      quantity,
      reason,
      order_id
    ) values (
      v_product.id,
      'sale',
      -v_quantity,
      'Customer order ' || v_order_number,
      v_order_id
    );
  end loop;

  update public.orders
  set total_amount = v_total
  where id = v_order_id;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_total
  );
end;
$$;

create or replace function public.cancel_order_and_restore_inventory(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
begin
  if not public.is_dees_scentry_admin() then
    raise exception 'Admin access required.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order.status = 'Cancelled' then
    return;
  end if;

  for v_item in select * from public.order_items where order_id = p_order_id
  loop
    if v_item.product_id is not null then
      update public.products
      set stock_quantity = stock_quantity + v_item.quantity
      where id = v_item.product_id;

      insert into public.inventory_movements (
        product_id,
        movement_type,
        quantity,
        reason,
        order_id
      ) values (
        v_item.product_id,
        'return',
        v_item.quantity,
        'Cancelled order ' || v_order.order_number,
        p_order_id
      );
    end if;
  end loop;

  update public.orders
  set status = 'Cancelled'
  where id = p_order_id;
end;
$$;

alter table public.products enable row level security;
alter table public.featured_posts enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_movements enable row level security;

-- Products: public customers can view active products only.
drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products"
on public.products
for select
using (is_active = true or public.is_dees_scentry_admin());

drop policy if exists "Admin can insert products" on public.products;
create policy "Admin can insert products"
on public.products
for insert
to authenticated
with check (public.is_dees_scentry_admin());

drop policy if exists "Admin can update products" on public.products;
create policy "Admin can update products"
on public.products
for update
to authenticated
using (public.is_dees_scentry_admin())
with check (public.is_dees_scentry_admin());

drop policy if exists "Admin can delete products" on public.products;
create policy "Admin can delete products"
on public.products
for delete
to authenticated
using (public.is_dees_scentry_admin());


-- Public visitors can only read active What's New posts.
drop policy if exists "Public can view active featured posts" on public.featured_posts;
create policy "Public can view active featured posts"
on public.featured_posts
for select
to anon, authenticated
using (is_active = true);

-- Admin can fully manage What's New posts from the dashboard.
drop policy if exists "Admin can view all featured posts" on public.featured_posts;
create policy "Admin can view all featured posts"
on public.featured_posts
for select
to authenticated
using (public.is_dees_scentry_admin());

drop policy if exists "Admin can insert featured posts" on public.featured_posts;
create policy "Admin can insert featured posts"
on public.featured_posts
for insert
to authenticated
with check (public.is_dees_scentry_admin());

drop policy if exists "Admin can update featured posts" on public.featured_posts;
create policy "Admin can update featured posts"
on public.featured_posts
for update
to authenticated
using (public.is_dees_scentry_admin())
with check (public.is_dees_scentry_admin());

drop policy if exists "Admin can delete featured posts" on public.featured_posts;
create policy "Admin can delete featured posts"
on public.featured_posts
for delete
to authenticated
using (public.is_dees_scentry_admin());

-- Orders and inventory: admin only from the browser. Customer order creation happens through the server API.
drop policy if exists "Admin can view orders" on public.orders;
create policy "Admin can view orders"
on public.orders
for select
to authenticated
using (public.is_dees_scentry_admin());

drop policy if exists "Admin can update orders" on public.orders;
create policy "Admin can update orders"
on public.orders
for update
to authenticated
using (public.is_dees_scentry_admin())
with check (public.is_dees_scentry_admin());

drop policy if exists "Admin can view order items" on public.order_items;
create policy "Admin can view order items"
on public.order_items
for select
to authenticated
using (public.is_dees_scentry_admin());

drop policy if exists "Admin can view inventory movements" on public.inventory_movements;
create policy "Admin can view inventory movements"
on public.inventory_movements
for select
to authenticated
using (public.is_dees_scentry_admin());

drop policy if exists "Admin can insert inventory movements" on public.inventory_movements;
create policy "Admin can insert inventory movements"
on public.inventory_movements
for insert
to authenticated
with check (public.is_dees_scentry_admin());

-- Supabase Storage bucket for product images.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
on storage.objects
for select
using (bucket_id = 'product-images');

drop policy if exists "Admin can upload product images" on storage.objects;
create policy "Admin can upload product images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'product-images' and public.is_dees_scentry_admin());

drop policy if exists "Admin can update product images" on storage.objects;
create policy "Admin can update product images"
on storage.objects
for update
to authenticated
using (bucket_id = 'product-images' and public.is_dees_scentry_admin())
with check (bucket_id = 'product-images' and public.is_dees_scentry_admin());

drop policy if exists "Admin can delete product images" on storage.objects;
create policy "Admin can delete product images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'product-images' and public.is_dees_scentry_admin());


-- Supabase Storage bucket for homepage and What's New images.
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do nothing;

drop policy if exists "Public can view site images" on storage.objects;
create policy "Public can view site images"
on storage.objects
for select
using (bucket_id = 'site-images');

drop policy if exists "Admin can upload site images" on storage.objects;
create policy "Admin can upload site images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'site-images' and public.is_dees_scentry_admin());

drop policy if exists "Admin can update site images" on storage.objects;
create policy "Admin can update site images"
on storage.objects
for update
to authenticated
using (bucket_id = 'site-images' and public.is_dees_scentry_admin())
with check (bucket_id = 'site-images' and public.is_dees_scentry_admin());

drop policy if exists "Admin can delete site images" on storage.objects;
create policy "Admin can delete site images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'site-images' and public.is_dees_scentry_admin());

grant execute on function public.create_order_with_inventory(text, text, text, text, text, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.cancel_order_and_restore_inventory(uuid) to authenticated, service_role;
