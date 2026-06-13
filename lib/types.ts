export type ProductCategory = 'Men' | 'Women' | 'Unisex';

export type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: ProductCategory;
  size_ml: number | null;
  price: number;
  description: string | null;
  fragrance_notes: string | null;
  image_url: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};


export type FeaturedPost = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_href: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CartItem = {
  product_id: string;
  quantity: number;
};

export type CustomerDetails = {
  customerName: string;
  phone: string;
  deliveryLocation: string;
  deliveryTime?: string;
  notes?: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  phone: string;
  delivery_location: string;
  delivery_time: string | null;
  notes: string | null;
  channel: 'website' | 'whatsapp';
  status: 'New' | 'Confirmed' | 'Delivered' | 'Cancelled';
  total_amount: number;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
};

export type InventoryMovement = {
  id: string;
  product_id: string;
  movement_type: 'restock' | 'sale' | 'adjustment' | 'return';
  quantity: number;
  reason: string | null;
  order_id: string | null;
  created_at: string;
};
