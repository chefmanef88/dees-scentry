# Dee's Scentry Admin + Inventory App

This is the upgraded Dee's Scentry web app with:

- Public customer website
- Hidden admin login at `/admin/login`
- Product upload system
- Direct product image upload
- Empty public catalog until admin adds products
- What’s New / Signature Scent posts managed by admin
- Direct image upload for What’s New posts
- Cart and checkout
- Submit Order checkout
- Submit to WhatsApp checkout
- Supabase database
- Supabase Storage image uploads
- Automatic inventory reduction when an order is created
- Order management
- Inventory adjustment logs
- Resend email notifications for new website orders

## Admin email

The allowed admin email is:

```txt
deesscentry@gmail.com
```

Create this user inside Supabase Authentication.

## Important public behaviour

The website does not show demo products by default. The collection remains empty until the admin adds real perfumes in:

```txt
/admin/products
```

The What’s New section remains hidden until the admin creates an active post in:

```txt
/admin/featured
```

The public website menu does not show the admin link. Admin access is only by direct URL:

```txt
/admin/login
```

## Setup locally

Install packages:

```bash
npm install
```

Create `.env.local` from the sample:

```bash
copy .env.example .env.local
```

Fill in your Supabase values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_or_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_or_secret_key

NEXT_PUBLIC_ADMIN_EMAIL=deesscentry@gmail.com
ORDER_EMAIL=deesscentry@gmail.com
ORDER_FROM_EMAIL=Dee's Scentry <onboarding@resend.dev>
RESEND_API_KEY=your_resend_api_key

NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY=+233 24 904 3836
NEXT_PUBLIC_BUSINESS_PHONE_TEL=+233249043836
NEXT_PUBLIC_BUSINESS_WHATSAPP_NUMBER=233249043836
```

Run the development server:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

Admin login:

```txt
http://localhost:3000/admin/login
```

## Supabase setup

1. Create a Supabase project.
2. Go to SQL Editor.
3. Open `supabase/schema.sql` from this project.
4. Copy all the SQL.
5. Paste it into Supabase SQL Editor.
6. Click Run.

This creates:

- `products`
- `featured_posts`
- `orders`
- `order_items`
- `inventory_movements`
- `product-images` storage bucket
- `site-images` storage bucket
- security policies
- automatic inventory functions

## Admin user setup

In Supabase:

```txt
Authentication → Users → Add user
```

Create:

```txt
Email: deesscentry@gmail.com
Password: your chosen admin password
```

Then log in at:

```txt
/admin/login
```

## Adding products

Go to:

```txt
/admin/products
```

You can add:

- Product name
- Brand
- Category
- Size
- Price
- Stock quantity
- Low-stock alert level
- Fragrance notes
- Description
- Product image upload
- Show/hide on website

Only products marked active and in the database appear on the public website.

## Adding What’s New / Signature Scent posts

Go to:

```txt
/admin/featured
```

You can add:

- Title
- Subtitle / label
- Post text
- Picture upload
- Optional button label and link
- Sort order
- Show/hide on website

If there are no active posts, the What’s New section is hidden from customers.

## Removing early demo products

If your current database still shows the early test products, run this optional SQL file in Supabase:

```txt
supabase/clear-demo-products.sql
```

It removes only:

```txt
Amber Noir
Velvet Oud
Rose Lumière
```

## Checkout behaviour

Customers fill their delivery details, then choose:

```txt
Submit Order
Submit to WhatsApp
```

`Submit Order` saves the order into the database, reduces inventory, and sends an order notification email through Resend.

`Submit to WhatsApp` saves the order, reduces inventory, and opens WhatsApp with the full order message prepared. It also triggers the same order email notification.

## Deployment to Vercel

Add these environment variables in Vercel too:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_ADMIN_EMAIL=deesscentry@gmail.com
ORDER_EMAIL=deesscentry@gmail.com
ORDER_FROM_EMAIL=Dee's Scentry <onboarding@resend.dev>
RESEND_API_KEY=
NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY=+233 24 904 3836
NEXT_PUBLIC_BUSINESS_PHONE_TEL=+233249043836
NEXT_PUBLIC_BUSINESS_WHATSAPP_NUMBER=233249043836
```

Then deploy with:

```bash
vercel --prod
```

or push to GitHub and let Vercel redeploy automatically.


## Admin access

The public website does not show an Admin link. To access the private dashboard, go directly to:

```txt
/admin
```

The `/admin` route redirects to `/admin/login`. After login, the admin can use:

```txt
/admin/dashboard
/admin/products
/admin/featured
/admin/orders
/admin/inventory
```

Create the admin user in Supabase under Authentication → Users using:

```txt
deesscentry@gmail.com
```

Supabase Auth is the login system. It stores and verifies the admin email/password so the password does not need to be hardcoded in the website.

## Product Autofill Assistant update

The `/admin/products` page now includes a **Find product details** button.

Admin workflow:

1. Type the perfume name, for example `Versace Bright Crystal`.
2. Click **Find product details**.
3. Review the suggested brand, category, description, and fragrance composition.
4. Click **Apply suggested details**.
5. Add Dee's Scentry price and stock quantity.
6. Upload a product picture manually, or use an online image suggestion if live search is enabled.
7. Click **Save product**.

Live image suggestions are optional. To enable them, add this to `.env.local`:

```env
SERPAPI_KEY=your_serpapi_key_here
```

Then stop and restart the local server:

```bash
CTRL + C
npm run dev
```

If `SERPAPI_KEY` is not added, the admin can still use the built-in perfume detail suggestions and upload product pictures directly.

The automatic image importer saves selected online images into the Supabase `product-images` bucket before using them on the product card.


## Product autofill route fix

This package fixes the Product Autofill Assistant server routes so `/admin/products` can call `Find product details` without the previous `supabaseAdmin doesn't exist in target module` build error.


## Resend email notifications

This update uses Resend for order emails instead of FormSubmit or Gmail SMTP.

Create a Resend account, create an API key, then add it to `.env.local`:

```env
RESEND_API_KEY=re_your_key_here
ORDER_EMAIL=deesscentry@gmail.com
ORDER_FROM_EMAIL=Dee's Scentry <onboarding@resend.dev>
```

For testing, `onboarding@resend.dev` is the easiest sender. For the final live business site, verify a domain in Resend and change `ORDER_FROM_EMAIL` to something like:

```env
ORDER_FROM_EMAIL=Dee's Scentry <orders@yourdomain.com>
```

After editing `.env.local`, restart the app:

```bash
CTRL + C
npm run dev
```

Submit a new test order. The order should appear in `/admin/orders`, and Resend should show the email attempt in its dashboard logs. If the order appears but email does not arrive, check the Resend dashboard for the exact delivery error.

Important: never put `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or `SERPAPI_KEY` in public screenshots or GitHub. Keep `.env.local` private.


## Latest UI update

This package includes the improved public homepage hero:

- The old flat perfume bottle illustration has been replaced with a more premium realistic glass-bottle hero design built directly into the website.
- The public top navigation now auto-hides while scrolling through the page and reappears when the customer scrolls back toward the top, so it no longer blocks content on mobile.
- A `vercel.json` file is included to force Vercel to deploy this as a Next.js app instead of the old static-site configuration.
