export interface Product {
  id: string;
  slug?: string | null;
  name: string;
  price: number;
  image?: string;
  image_url?: string;
  description?: string | null;
  category?: string;
  stock?: number;
  active?: boolean | null;
  status?: string | null;
  /** Optional PDP fields (when present in DB) */
  brand?: string | null;
  /** Original / list price for strikethrough + discount badge */
  compare_at_price?: number | null;
  /** e.g. bag size label (admin “Size”) */
  size_label?: string | null;
  /** DB alias for the same value when the column is named `size` */
  size?: string | null;
  /** e.g. product color variant */
  color?: string | null;
  benefit?: string | null;
  ingredients?: string | null;
  analysis?: string | null;
  feeding_instructions?: string | null;
  /** Promo overlay on image; default handled in UI when unset */
  delivery_badge_text?: string | null;
  /** Extra images for PDP gallery (from product_images or fallback) */
  gallery_images?: string[];
}

export interface CartItem extends Product {
  quantity: number;
}

export interface GroomingSlot {
  id: string;
  date: string;
  time: string;
  available: boolean;
}
