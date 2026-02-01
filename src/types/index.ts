// Core business types for Vyapar MCP

export interface User {
  id: string;
  name: string;
  shop_name: string;
  upi_id: string;
  phone: string;
  email?: string;
  address?: string;
  gst_number?: string;
  avatar_url?: string;
  language: 'en' | 'hi' | 'hinglish';
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  user_id: string;
  name: string;
  hindi_name?: string;
  category: string;
  price: number;
  cost_price?: number;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
  barcode?: string;
  hsn_code?: string;
  gst_rate: number;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  customer_id?: string;
  invoice_id?: string;
  amount: number;
  payment_type: 'cash' | 'upi' | 'credit' | 'bank_transfer' | 'cheque';
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  upi_transaction_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gst_number?: string;
  credit_limit?: number;
  outstanding_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  customer_id?: string;
  invoice_number: string;
  invoice_type: 'invoice' | 'quotation' | 'proforma' | 'delivery_challan';
  items: InvoiceItem[];
  subtotal: number;
  discount_amount: number;
  discount_type: 'percentage' | 'fixed';
  tax_amount: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';
  due_date?: string;
  notes?: string;
  terms?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  product_id?: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount: number;
  gst_rate: number;
  total: number;
}

export interface Supplier {
  id: string;
  user_id: string;
  name: string;
  company_name?: string;
  phone: string;
  email?: string;
  address?: string;
  gst_number?: string;
  payment_terms?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: string;
  user_id: string;
  supplier_id: string;
  order_number: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  tax_amount: number;
  total: number;
  status: 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled';
  expected_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  product_id?: string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

export interface Expense {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  description: string;
  payment_type: 'cash' | 'upi' | 'bank_transfer' | 'cheque';
  receipt_url?: string;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface DailyReport {
  date: string;
  total_sales: number;
  total_transactions: number;
  cash_sales: number;
  upi_sales: number;
  credit_sales: number;
  total_expenses: number;
  net_profit: number;
  top_products: { name: string; quantity: number; revenue: number }[];
}

export interface InventoryAlert {
  product_id: string;
  product_name: string;
  current_quantity: number;
  low_stock_threshold: number;
  alert_type: 'low_stock' | 'out_of_stock';
}

export interface UPIPaymentRequest {
  payee_upi_id: string;
  payee_name: string;
  amount: number;
  transaction_note?: string;
  transaction_ref?: string;
}

export interface WhatsAppMessage {
  phone: string;
  message: string;
  image_base64?: string;
}
