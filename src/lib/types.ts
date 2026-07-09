export interface Part {
  id: string;
  code: string;
  name: string;
  manufacturer: string;
  car_brand: string;
  car_model: string;
  price: number;
  cost: number;
  quantity: number;
  min_quantity: number;
  category: string;
  origin: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  buyer_name: string;
  car_brand: string;
  car_model: string;
  total_amount: number;
  total_cost: number;
  original_total: number;
  discount: number;
  is_paid: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  part_id: string | null;
  part_code: string;
  part_name: string;
  manufacturer: string;
  car_brand: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  subtotal: number;
  is_returned: boolean;
  returned_at: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  note: string;
  created_at: string;
}

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
  payments: Payment[];
}

export interface Settings {
  id: number;
  financial_password: string | null;
  updated_at: string;
}
