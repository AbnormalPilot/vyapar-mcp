import { z } from 'zod';

// ============ INVENTORY TOOLS ============

export const getProductsSchema = z.object({
  user_id: z.string().describe('The user ID to get products for'),
  category: z.string().optional().describe('Filter by category'),
  search: z.string().optional().describe('Search term for product name'),
  low_stock_only: z.boolean().optional().describe('Only return low stock items'),
  limit: z.number().optional().default(50).describe('Maximum number of products to return'),
});

export const getProductSchema = z.object({
  user_id: z.string().describe('The user ID'),
  product_id: z.string().describe('The product ID to retrieve'),
});

export const createProductSchema = z.object({
  user_id: z.string().describe('The user ID'),
  name: z.string().describe('Product name'),
  hindi_name: z.string().optional().describe('Product name in Hindi'),
  category: z.string().describe('Product category'),
  price: z.number().describe('Selling price'),
  cost_price: z.number().optional().describe('Cost/purchase price'),
  quantity: z.number().describe('Current stock quantity'),
  unit: z.string().default('pcs').describe('Unit of measurement (pcs, kg, L, etc.)'),
  low_stock_threshold: z.number().default(10).describe('Alert when stock falls below this'),
  barcode: z.string().optional().describe('Barcode/SKU'),
  hsn_code: z.string().optional().describe('HSN code for GST'),
  gst_rate: z.number().default(18).describe('GST rate percentage'),
});

export const updateStockSchema = z.object({
  user_id: z.string().describe('The user ID'),
  product_id: z.string().describe('The product ID'),
  quantity: z.number().describe('Quantity to add/subtract/set'),
  operation: z.enum(['add', 'subtract', 'set']).describe('Operation type'),
});

export const getInventoryAlertsSchema = z.object({
  user_id: z.string().describe('The user ID'),
});

// ============ CUSTOMER TOOLS ============

export const getCustomersSchema = z.object({
  user_id: z.string().describe('The user ID'),
  search: z.string().optional().describe('Search by name or phone'),
  limit: z.number().optional().default(50).describe('Maximum number of customers'),
});

export const getCustomerSchema = z.object({
  user_id: z.string().describe('The user ID'),
  customer_id: z.string().describe('The customer ID'),
});

export const createCustomerSchema = z.object({
  user_id: z.string().describe('The user ID'),
  name: z.string().describe('Customer name'),
  phone: z.string().describe('Phone number'),
  email: z.string().optional().describe('Email address'),
  address: z.string().optional().describe('Address'),
  gst_number: z.string().optional().describe('GST number if registered'),
  credit_limit: z.number().optional().describe('Credit limit for the customer'),
});

export const updateCustomerBalanceSchema = z.object({
  user_id: z.string().describe('The user ID'),
  customer_id: z.string().describe('The customer ID'),
  amount: z.number().describe('Amount to add or subtract'),
  operation: z.enum(['add', 'subtract']).describe('Add or subtract from balance'),
});

// ============ TRANSACTION TOOLS ============

export const getTransactionsSchema = z.object({
  user_id: z.string().describe('The user ID'),
  start_date: z.string().optional().describe('Start date (ISO format)'),
  end_date: z.string().optional().describe('End date (ISO format)'),
  payment_type: z.enum(['cash', 'upi', 'credit', 'bank_transfer', 'cheque']).optional(),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  customer_id: z.string().optional().describe('Filter by customer'),
  limit: z.number().optional().default(50),
});

export const createTransactionSchema = z.object({
  user_id: z.string().describe('The user ID'),
  customer_id: z.string().optional().describe('Customer ID if applicable'),
  invoice_id: z.string().optional().describe('Related invoice ID'),
  amount: z.number().describe('Transaction amount'),
  payment_type: z.enum(['cash', 'upi', 'credit', 'bank_transfer', 'cheque']),
  payment_status: z.enum(['pending', 'completed', 'failed']).default('completed'),
  upi_transaction_id: z.string().optional().describe('UPI reference ID'),
  notes: z.string().optional().describe('Transaction notes'),
});

// ============ INVOICE TOOLS ============

export const getInvoicesSchema = z.object({
  user_id: z.string().describe('The user ID'),
  status: z.enum(['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled']).optional(),
  type: z.enum(['invoice', 'quotation', 'proforma', 'delivery_challan']).optional(),
  customer_id: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  limit: z.number().optional().default(50),
});

export const getInvoiceSchema = z.object({
  user_id: z.string().describe('The user ID'),
  invoice_id: z.string().describe('The invoice ID'),
});

export const createInvoiceSchema = z.object({
  user_id: z.string().describe('The user ID'),
  customer_id: z.string().optional().describe('Customer ID'),
  invoice_type: z.enum(['invoice', 'quotation', 'proforma', 'delivery_challan']).default('invoice'),
  items: z.array(z.object({
    product_id: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    quantity: z.number(),
    unit: z.string().default('pcs'),
    unit_price: z.number(),
    discount: z.number().default(0).describe('Discount percentage'),
    gst_rate: z.number().default(18),
  })),
  discount_amount: z.number().optional().default(0),
  discount_type: z.enum(['percentage', 'fixed']).default('fixed'),
  due_date: z.string().optional().describe('Due date (ISO format)'),
  notes: z.string().optional(),
  terms: z.string().optional(),
});

export const updateInvoiceStatusSchema = z.object({
  user_id: z.string().describe('The user ID'),
  invoice_id: z.string().describe('The invoice ID'),
  status: z.enum(['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled']),
});

export const generateInvoicePDFSchema = z.object({
  user_id: z.string().describe('The user ID'),
  invoice_id: z.string().describe('The invoice ID'),
  include_qr: z.boolean().optional().default(true).describe('Include UPI QR code'),
});

// ============ UPI/PAYMENT TOOLS ============

export const generateUPIQRSchema = z.object({
  payee_upi_id: z.string().describe('UPI ID of the payee (e.g., shop@upi)'),
  payee_name: z.string().describe('Name of the payee/shop'),
  amount: z.number().describe('Amount to receive'),
  transaction_note: z.string().optional().describe('Payment description'),
  transaction_ref: z.string().optional().describe('Reference ID (invoice number, etc.)'),
});

export const parseUPIQRSchema = z.object({
  qr_string: z.string().describe('The UPI QR string to parse'),
});

export const validateUPIIdSchema = z.object({
  upi_id: z.string().describe('UPI ID to validate'),
});

// ============ WHATSAPP TOOLS ============

export const shareInvoiceWhatsAppSchema = z.object({
  user_id: z.string().describe('The user ID'),
  invoice_id: z.string().describe('The invoice ID to share'),
  phone: z.string().describe('Phone number to send to'),
  include_image: z.boolean().optional().default(true).describe('Include invoice image'),
});

export const sendPaymentReminderSchema = z.object({
  customer_name: z.string().describe('Customer name'),
  invoice_number: z.string().describe('Invoice number'),
  amount: z.number().describe('Amount due'),
  phone: z.string().describe('Customer phone number'),
  due_date: z.string().optional().describe('Due date'),
  upi_id: z.string().optional().describe('UPI ID for payment'),
});

export const sendOrderConfirmationSchema = z.object({
  customer_name: z.string().describe('Customer name'),
  order_number: z.string().describe('Order/Invoice number'),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    unit: z.string(),
  })),
  total: z.number().describe('Order total'),
  phone: z.string().describe('Customer phone number'),
  delivery_date: z.string().optional(),
});

export const sendLowStockAlertSchema = z.object({
  supplier_name: z.string().describe('Supplier name'),
  items: z.array(z.object({
    name: z.string(),
    current_stock: z.number(),
    unit: z.string(),
    required_quantity: z.number(),
  })),
  phone: z.string().describe('Supplier phone number'),
});

// ============ GST TOOLS ============

export const calculateGSTSchema = z.object({
  base_amount: z.number().describe('Amount before GST'),
  gst_rate: z.number().describe('GST rate (e.g., 18 for 18%)'),
  is_interstate: z.boolean().optional().default(false).describe('Is the transaction interstate?'),
});

export const calculateGSTInclusiveSchema = z.object({
  total_amount: z.number().describe('Total amount including GST'),
  gst_rate: z.number().describe('GST rate'),
});

export const suggestGSTRateSchema = z.object({
  category: z.string().describe('Product category'),
});

export const validateGSTINSchema = z.object({
  gstin: z.string().describe('GSTIN to validate'),
});

// ============ ANALYTICS TOOLS ============

export const getDailyReportSchema = z.object({
  user_id: z.string().describe('The user ID'),
  date: z.string().describe('Date in YYYY-MM-DD format'),
});

export const getSalesAnalyticsSchema = z.object({
  user_id: z.string().describe('The user ID'),
  period: z.enum(['week', 'month', 'year']).describe('Time period for analytics'),
});

// ============ EXPENSE TOOLS ============

export const getExpensesSchema = z.object({
  user_id: z.string().describe('The user ID'),
  category: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  limit: z.number().optional().default(50),
});

export const createExpenseSchema = z.object({
  user_id: z.string().describe('The user ID'),
  category: z.string().describe('Expense category'),
  amount: z.number().describe('Expense amount'),
  description: z.string().describe('Expense description'),
  payment_type: z.enum(['cash', 'upi', 'bank_transfer', 'cheque']),
  date: z.string().describe('Expense date (YYYY-MM-DD)'),
});

// ============ SUPPLIER TOOLS ============

export const getSuppliersSchema = z.object({
  user_id: z.string().describe('The user ID'),
  search: z.string().optional(),
  limit: z.number().optional().default(50),
});

export const createSupplierSchema = z.object({
  user_id: z.string().describe('The user ID'),
  name: z.string().describe('Supplier name'),
  company_name: z.string().optional(),
  phone: z.string().describe('Phone number'),
  email: z.string().optional(),
  address: z.string().optional(),
  gst_number: z.string().optional(),
  payment_terms: z.string().optional(),
});

// ============ USER TOOLS ============

export const getUserSchema = z.object({
  user_id: z.string().describe('The user ID'),
});

export const updateUserSchema = z.object({
  user_id: z.string().describe('The user ID'),
  name: z.string().optional(),
  shop_name: z.string().optional(),
  upi_id: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  gst_number: z.string().optional(),
  language: z.enum(['en', 'hi', 'hinglish']).optional(),
});

// ============ BUSINESS INSIGHTS TOOLS ============

export const getBusinessSummarySchema = z.object({
  user_id: z.string().describe('The user ID'),
});

export const getProfitLossReportSchema = z.object({
  user_id: z.string().describe('The user ID'),
  start_date: z.string().describe('Start date (YYYY-MM-DD)'),
  end_date: z.string().describe('End date (YYYY-MM-DD)'),
});

export const getTopProductsSchema = z.object({
  user_id: z.string().describe('The user ID'),
  period: z.enum(['week', 'month', 'year']),
  limit: z.number().optional().default(10),
});

export const getOutstandingPaymentsSchema = z.object({
  user_id: z.string().describe('The user ID'),
});

export const generateReportPDFSchema = z.object({
  user_id: z.string().describe('The user ID'),
  type: z.enum(['daily', 'analytics', 'summary']).describe('Type of report'),
  date: z.string().optional().describe('Date for daily report (YYYY-MM-DD)'),
  period: z.enum(['week', 'month', 'year']).optional().describe('Period for analytics'),
});
