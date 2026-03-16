export interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
  image_url?: string;
  description?: string | null;
  category?: string;
  stock?: number;
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
