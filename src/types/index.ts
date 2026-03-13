export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  category: string;
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
