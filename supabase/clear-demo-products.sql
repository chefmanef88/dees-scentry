-- Optional cleanup for early test/demo products.
-- Run this only if your shop currently shows the demo perfumes.
delete from public.products
where name in ('Amber Noir', 'Velvet Oud', 'Rose Lumière');
