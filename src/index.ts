import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';

import { ConversationalOrdersService } from './services/conversational-orders-service.js';
import { ForecastingService } from './services/forecasting-service.js';
import { MSMEProductivityService } from './services/msme-productivity-service.js';
import { OCRService } from './services/ocr-service.js';
import { SupabaseService } from './services/supabase-service.js';
import * as tools from './tools/index.js';
import * as msmeTools from './tools/msme-productivity.js';
import {
  calculateBaseFromGSTInclusive,
  calculateGST,
  formatGSTBreakdown,
  getStateFromGSTIN,
  isValidGSTIN,
  suggestGSTRate,
} from './utils/gst.js';
import {
  calculateInvoiceTotals,
  formatInvoiceForWhatsApp,
  generateInvoicePDF,
} from './utils/invoice.js';
import { generateMarkdownPDF } from './utils/markdown-pdf.js';
import { generateUPIQRCode, isValidUPIId, parseUPIString } from './utils/qrcode.js';
import { generateReportPDF } from './utils/report.js';
import {
  formatLowStockAlert,
  formatOrderConfirmation,
  formatPaymentReminder,
  prepareWhatsAppShare
} from './utils/whatsapp.js';


// Initialize services
let dbService: SupabaseService | null = null;
let conversationalOrdersService: ConversationalOrdersService | null = null;
let forecastingService: ForecastingService | null = null;
let msmeProductivityService: MSMEProductivityService | null = null;
let ocrService: OCRService | null = null;

function getDbService(): SupabaseService {
  if (!dbService) {
    dbService = new SupabaseService();
  }
  return dbService;
}

function getConversationalOrdersService(): ConversationalOrdersService {
  if (!conversationalOrdersService) {
    conversationalOrdersService = new ConversationalOrdersService(getDbService().supabase);
  }
  return conversationalOrdersService;
}

function getForecastingService(): ForecastingService {
  if (!forecastingService) {
    forecastingService = new ForecastingService(getDbService().supabase);
  }
  return forecastingService;
}

function getMSMEProductivityService(): MSMEProductivityService {
  if (!msmeProductivityService) {
    msmeProductivityService = new MSMEProductivityService(getDbService().supabase);
  }
  return msmeProductivityService;
}

function getOCRService(): OCRService {
  if (!ocrService) {
    ocrService = new OCRService();
  }
  return ocrService;
}

// Define all available tools
const TOOLS: Tool[] = [
  // ============ INVENTORY TOOLS ============
  {
    name: 'get_products',
    description: 'Get list of products/inventory items. Can filter by category, search term, or low stock status.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'The user ID' },
        category: { type: 'string', description: 'Filter by category' },
        search: { type: 'string', description: 'Search term' },
        low_stock_only: { type: 'boolean', description: 'Only show low stock items' },
        limit: { type: 'number', description: 'Max results', default: 50 },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'get_product',
    description: 'Get details of a specific product by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'The user ID' },
        product_id: { type: 'string', description: 'The product ID' },
      },
      required: ['user_id', 'product_id'],
    },
  },
  {
    name: 'create_product',
    description: 'Add a new product to inventory.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        name: { type: 'string', description: 'Product name' },
        hindi_name: { type: 'string', description: 'Name in Hindi' },
        category: { type: 'string' },
        price: { type: 'number', description: 'Selling price' },
        cost_price: { type: 'number', description: 'Cost price' },
        quantity: { type: 'number', description: 'Current stock' },
        unit: { type: 'string', default: 'pcs' },
        low_stock_threshold: { type: 'number', default: 10 },
        barcode: { type: 'string' },
        hsn_code: { type: 'string' },
        gst_rate: { type: 'number', default: 18 },
      },
      required: ['user_id', 'name', 'category', 'price', 'quantity'],
    },
  },
  {
    name: 'update_stock',
    description: 'Update stock quantity for a product. Can add, subtract, or set absolute value.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        product_id: { type: 'string' },
        quantity: { type: 'number', description: 'Amount to add/subtract/set' },
        operation: { type: 'string', enum: ['add', 'subtract', 'set'] },
      },
      required: ['user_id', 'product_id', 'quantity', 'operation'],
    },
  },
  {
    name: 'get_inventory_alerts',
    description: 'Get list of products that are low in stock or out of stock.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
      },
      required: ['user_id'],
    },
  },

  // ============ CUSTOMER TOOLS ============
  {
    name: 'get_customers',
    description: 'Get list of customers. Can search by name or phone.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        search: { type: 'string' },
        limit: { type: 'number', default: 50 },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'get_customer',
    description: 'Get details of a specific customer.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        customer_id: { type: 'string' },
      },
      required: ['user_id', 'customer_id'],
    },
  },
  {
    name: 'create_customer',
    description: 'Add a new customer.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        address: { type: 'string' },
        gst_number: { type: 'string' },
        credit_limit: { type: 'number' },
      },
      required: ['user_id', 'name', 'phone'],
    },
  },
  {
    name: 'update_customer_balance',
    description: 'Update outstanding balance for a customer.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        customer_id: { type: 'string' },
        amount: { type: 'number' },
        operation: { type: 'string', enum: ['add', 'subtract'] },
      },
      required: ['user_id', 'customer_id', 'amount', 'operation'],
    },
  },

  // ============ TRANSACTION TOOLS ============
  {
    name: 'get_transactions',
    description: 'Get list of transactions/payments. Can filter by date range, payment type, status, or customer.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        start_date: { type: 'string', description: 'ISO date' },
        end_date: { type: 'string', description: 'ISO date' },
        payment_type: { type: 'string', enum: ['cash', 'upi', 'credit', 'bank_transfer', 'cheque'] },
        status: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded'] },
        customer_id: { type: 'string' },
        limit: { type: 'number', default: 50 },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'create_transaction',
    description: 'Record a new payment/transaction.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        customer_id: { type: 'string' },
        invoice_id: { type: 'string' },
        amount: { type: 'number' },
        payment_type: { type: 'string', enum: ['cash', 'upi', 'credit', 'bank_transfer', 'cheque'] },
        payment_status: { type: 'string', enum: ['pending', 'completed', 'failed'], default: 'completed' },
        upi_transaction_id: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['user_id', 'amount', 'payment_type'],
    },
  },

  // ============ INVOICE TOOLS ============
  {
    name: 'get_invoices',
    description: 'Get list of invoices/quotations. Can filter by status, type, customer, or date range.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'] },
        type: { type: 'string', enum: ['invoice', 'quotation', 'proforma', 'delivery_challan'] },
        customer_id: { type: 'string' },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        limit: { type: 'number', default: 50 },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'get_invoice',
    description: 'Get details of a specific invoice.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        invoice_id: { type: 'string' },
      },
      required: ['user_id', 'invoice_id'],
    },
  },
  {
    name: 'create_invoice',
    description: 'Create a new invoice or quotation with line items. Automatically calculates totals and GST.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        customer_id: { type: 'string' },
        invoice_type: { type: 'string', enum: ['invoice', 'quotation', 'proforma', 'delivery_challan'], default: 'invoice' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              quantity: { type: 'number' },
              unit: { type: 'string', default: 'pcs' },
              unit_price: { type: 'number' },
              discount: { type: 'number', default: 0 },
              gst_rate: { type: 'number', default: 18 },
            },
            required: ['name', 'quantity', 'unit_price'],
          },
        },
        discount_amount: { type: 'number', default: 0 },
        discount_type: { type: 'string', enum: ['percentage', 'fixed'], default: 'fixed' },
        due_date: { type: 'string' },
        notes: { type: 'string' },
        terms: { type: 'string' },
      },
      required: ['user_id', 'items'],
    },
  },
  {
    name: 'update_invoice_status',
    description: 'Update the status of an invoice.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        invoice_id: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'] },
      },
      required: ['user_id', 'invoice_id', 'status'],
    },
  },
  {
    name: 'generate_invoice_pdf',
    description: 'Generate a PDF for an invoice. Returns base64 encoded PDF that can be downloaded or shared.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        invoice_id: { type: 'string' },
        include_qr: { type: 'boolean', default: true, description: 'Include UPI payment QR code' },
      },
      required: ['user_id', 'invoice_id'],
    },
  },

  // ============ UPI/PAYMENT TOOLS ============
  {
    name: 'generate_upi_qr',
    description: 'Generate a UPI payment QR code for receiving payments. Returns QR image as base64 and UPI deep link.',
    inputSchema: {
      type: 'object',
      properties: {
        payee_upi_id: { type: 'string', description: 'UPI ID (e.g., shop@upi)' },
        payee_name: { type: 'string', description: 'Payee/shop name' },
        amount: { type: 'number', description: 'Amount to receive' },
        transaction_note: { type: 'string', description: 'Payment description' },
        transaction_ref: { type: 'string', description: 'Reference (invoice number)' },
      },
      required: ['payee_upi_id', 'payee_name', 'amount'],
    },
  },
  {
    name: 'parse_upi_qr',
    description: 'Parse a UPI QR code string and extract payment details.',
    inputSchema: {
      type: 'object',
      properties: {
        qr_string: { type: 'string', description: 'UPI QR string starting with upi://pay?' },
      },
      required: ['qr_string'],
    },
  },
  {
    name: 'validate_upi_id',
    description: 'Validate if a UPI ID is in correct format.',
    inputSchema: {
      type: 'object',
      properties: {
        upi_id: { type: 'string' },
      },
      required: ['upi_id'],
    },
  },

  // ============ WHATSAPP TOOLS ============
  {
    name: 'share_invoice_whatsapp',
    description: 'Prepare invoice for sharing via WhatsApp. Returns formatted message and WhatsApp deep link.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        invoice_id: { type: 'string' },
        phone: { type: 'string', description: 'Customer phone number' },
        include_image: { type: 'boolean', default: true },
      },
      required: ['user_id', 'invoice_id', 'phone'],
    },
  },
  {
    name: 'send_payment_reminder',
    description: 'Prepare a payment reminder message for WhatsApp.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_name: { type: 'string' },
        invoice_number: { type: 'string' },
        amount: { type: 'number' },
        phone: { type: 'string' },
        due_date: { type: 'string' },
        upi_id: { type: 'string' },
      },
      required: ['customer_name', 'invoice_number', 'amount', 'phone'],
    },
  },
  {
    name: 'send_order_confirmation',
    description: 'Prepare an order confirmation message for WhatsApp.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_name: { type: 'string' },
        order_number: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              quantity: { type: 'number' },
              unit: { type: 'string' },
            },
            required: ['name', 'quantity', 'unit'],
          },
        },
        total: { type: 'number' },
        phone: { type: 'string' },
        delivery_date: { type: 'string' },
      },
      required: ['customer_name', 'order_number', 'items', 'total', 'phone'],
    },
  },
  {
    name: 'send_low_stock_alert',
    description: 'Prepare a low stock reorder message for supplier via WhatsApp.',
    inputSchema: {
      type: 'object',
      properties: {
        supplier_name: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              current_stock: { type: 'number' },
              unit: { type: 'string' },
              required_quantity: { type: 'number' },
            },
            required: ['name', 'current_stock', 'unit', 'required_quantity'],
          },
        },
        phone: { type: 'string' },
      },
      required: ['supplier_name', 'items', 'phone'],
    },
  },

  // ============ GST TOOLS ============
  {
    name: 'calculate_gst',
    description: 'Calculate GST (CGST/SGST or IGST) for a given amount. Returns detailed breakdown.',
    inputSchema: {
      type: 'object',
      properties: {
        base_amount: { type: 'number', description: 'Amount before GST' },
        gst_rate: { type: 'number', description: 'GST rate (e.g., 18 for 18%)' },
        is_interstate: { type: 'boolean', default: false, description: 'Is transaction interstate?' },
      },
      required: ['base_amount', 'gst_rate'],
    },
  },
  {
    name: 'calculate_gst_inclusive',
    description: 'Calculate base amount from a GST-inclusive total.',
    inputSchema: {
      type: 'object',
      properties: {
        total_amount: { type: 'number', description: 'Total including GST' },
        gst_rate: { type: 'number' },
      },
      required: ['total_amount', 'gst_rate'],
    },
  },
  {
    name: 'suggest_gst_rate',
    description: 'Suggest appropriate GST rate for a product category.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string' },
      },
      required: ['category'],
    },
  },
  {
    name: 'validate_gstin',
    description: 'Validate GSTIN format and extract state information.',
    inputSchema: {
      type: 'object',
      properties: {
        gstin: { type: 'string' },
      },
      required: ['gstin'],
    },
  },

  // ============ ANALYTICS TOOLS ============
  {
    name: 'get_daily_report',
    description: 'Get daily business report including sales, transactions, expenses, and top products.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
      },
      required: ['user_id', 'date'],
    },
  },
  {
    name: 'get_sales_analytics',
    description: 'Get sales analytics for a time period including revenue trends, payment breakdown, and growth.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        period: { type: 'string', enum: ['week', 'month', 'year'] },
      },
      required: ['user_id', 'period'],
    },
  },
  {
    name: 'get_business_summary',
    description: 'Get overall business summary including total revenue, customers, products, and outstanding payments.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'get_outstanding_payments',
    description: 'Get list of customers with outstanding payments.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
      },
      required: ['user_id'],
    },
  },

  // ============ EXPENSE TOOLS ============
  {
    name: 'get_expenses',
    description: 'Get list of business expenses.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        category: { type: 'string' },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        limit: { type: 'number', default: 50 },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'create_expense',
    description: 'Record a new business expense.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        category: { type: 'string' },
        amount: { type: 'number' },
        description: { type: 'string' },
        payment_type: { type: 'string', enum: ['cash', 'upi', 'bank_transfer', 'cheque'] },
        date: { type: 'string', description: 'Date in YYYY-MM-DD' },
      },
      required: ['user_id', 'category', 'amount', 'description', 'payment_type', 'date'],
    },
  },

  // ============ SUPPLIER TOOLS ============
  {
    name: 'get_suppliers',
    description: 'Get list of suppliers.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        search: { type: 'string' },
        limit: { type: 'number', default: 50 },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'create_supplier',
    description: 'Add a new supplier.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        name: { type: 'string' },
        company_name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        address: { type: 'string' },
        gst_number: { type: 'string' },
        payment_terms: { type: 'string' },
      },
      required: ['user_id', 'name', 'phone'],
    },
  },

  // ============ USER TOOLS ============
  {
    name: 'get_user',
    description: 'Get user/shop profile details.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'update_user',
    description: 'Update user/shop profile.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        name: { type: 'string' },
        shop_name: { type: 'string' },
        upi_id: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        address: { type: 'string' },
        gst_number: { type: 'string' },
        language: { type: 'string', enum: ['en', 'hi', 'hinglish'] },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'generate_report_pdf',
    description: 'Generate a PDF report for business performance. Returns base64 encoded PDF.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        type: { type: 'string', enum: ['daily', 'analytics', 'summary'], description: 'Type of report' },
        date: { type: 'string', description: 'Date for daily report (YYYY-MM-DD)' },
        period: { type: 'string', enum: ['week', 'month', 'year'], description: 'Period for analytics' },
      },
      required: ['user_id', 'type'],
    },
  },
  {
    name: 'generate_custom_pdf',
    description: 'Generate a custom PDF based on Markdown content. Use this to fulfill specific user document requests.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        title: { type: 'string', description: 'Title of the document' },
        content_md: { type: 'string', description: 'Document content in high-quality Markdown' },
      },
      required: ['user_id', 'title', 'content_md'],
    },
  },

  // ============ CONVERSATIONAL ORDER TOOLS ============
  {
    name: 'init_draft_invoice',
    description: 'Initialize a new draft invoice session for conversational order creation. Use at the start of multi-turn invoice building.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        customer_id: { type: 'string', description: 'Optional customer ID if known' },
        customer_name: { type: 'string', description: 'Optional customer name' },
        session_id: { type: 'string', description: 'Session ID (auto-generated if not provided)' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'add_invoice_item',
    description: 'Add an item to the draft invoice. Supports natural language like "add 5 bags of rice". Uses fuzzy search to find products.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        session_id: { type: 'string' },
        product_id: { type: 'string', description: 'Product ID if known' },
        product_name: { type: 'string', description: 'Product name for fuzzy search' },
        quantity: { type: 'number' },
        unit_price: { type: 'number', description: 'Override price (uses product price if not provided)' },
        gst_rate: { type: 'number', default: 18 },
      },
      required: ['user_id', 'session_id', 'product_name', 'quantity'],
    },
  },
  {
    name: 'update_invoice_item',
    description: 'Update an existing item in the draft invoice. Used when user says "change rice to 3 bags".',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        session_id: { type: 'string' },
        product_name: { type: 'string' },
        quantity: { type: 'number' },
        unit_price: { type: 'number' },
      },
      required: ['user_id', 'session_id', 'product_name'],
    },
  },
  {
    name: 'remove_invoice_item',
    description: 'Remove an item from the draft invoice. Used when user says "remove sugar from the invoice".',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        session_id: { type: 'string' },
        product_name: { type: 'string' },
      },
      required: ['user_id', 'session_id', 'product_name'],
    },
  },
  {
    name: 'get_draft_invoice',
    description: 'Get the current state of the draft invoice with all items.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        session_id: { type: 'string' },
      },
      required: ['user_id', 'session_id'],
    },
  },
  {
    name: 'finalize_draft_invoice',
    description: 'Finalize the draft and create an actual invoice. Used when user says "create invoice" or "done".',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        session_id: { type: 'string' },
        customer_id: { type: 'string' },
        customer_name: { type: 'string' },
        customer_phone: { type: 'string' },
        payment_method: { type: 'string', enum: ['Cash', 'UPI', 'Credit', 'Card'], default: 'Cash' },
        notes: { type: 'string' },
      },
      required: ['user_id', 'session_id'],
    },
  },
  {
    name: 'cancel_draft_invoice',
    description: 'Cancel and delete a draft invoice session.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        session_id: { type: 'string' },
      },
      required: ['user_id', 'session_id'],
    },
  },

  // ============ OCR & RECEIPT TOOLS ============
  {
    name: 'extract_receipt_data',
    description: 'Extract structured data from a receipt image using OCR. Returns vendor name, date, total amount, items, and GST number.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        image_url: { type: 'string', description: 'Supabase Storage URL or public URL of receipt image' },
        image_base64: { type: 'string', description: 'Base64 encoded image data' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'create_expense_from_receipt',
    description: 'Create an expense entry from extracted receipt data. Automatically creates expense record after OCR.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        image_url: { type: 'string' },
        image_base64: { type: 'string' },
        vendor_name: { type: 'string', description: 'Override extracted vendor name' },
        amount: { type: 'number', description: 'Override extracted amount' },
        category: { type: 'string', default: 'Other' },
        notes: { type: 'string' },
      },
      required: ['user_id'],
    },
  },

  // ============ STOCK FORECASTING TOOLS ============
  {
    name: 'predict_stock_needs',
    description: 'Predict stock requirements based on sales history. Returns when to reorder and how much for each product.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        product_id: { type: 'string', description: 'Specific product ID (omit for all products)' },
        time_period: { type: 'string', enum: ['week', 'month'], default: 'week' },
        only_low_stock: { type: 'boolean', default: true },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'get_restock_recommendations',
    description: 'Get restock recommendations for this week. Returns urgent items that need reordering.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        urgency_filter: { type: 'string', enum: ['critical', 'high', 'medium', 'all'], default: 'high' },
        limit: { type: 'number', default: 20 },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'set_reorder_rule',
    description: 'Set automatic reorder rule for a product. AI can configure this based on user preferences.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        product_id: { type: 'string' },
        auto_reorder: { type: 'boolean', default: false },
        reorder_point: { type: 'number' },
        reorder_quantity: { type: 'number' },
        preferred_supplier_id: { type: 'string' },
        lead_time_days: { type: 'number', default: 7 },
        safety_stock: { type: 'number', default: 0 },
      },
      required: ['user_id', 'product_id', 'reorder_point', 'reorder_quantity'],
    },
  },
  {
    name: 'get_product_forecast',
    description: 'Get forecast for a specific product showing predicted runout date and reorder quantity.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        product_id: { type: 'string' },
        days_ahead: { type: 'number', default: 30 },
      },
      required: ['user_id', 'product_id'],
    },
  },
  {
    name: 'analyze_sales_trend',
    description: 'Analyze sales trends for a product. Returns trend analysis (increasing, stable, decreasing).',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        product_id: { type: 'string' },
        period_days: { type: 'number', default: 30 },
      },
      required: ['user_id', 'product_id'],
    },
  },

  // ============ MSME PRODUCTIVITY & BUSINESS INTELLIGENCE TOOLS ============
  {
    name: 'forecast_inventory',
    description: 'Forecast inventory needs based on sales history with seasonal trends. Helps MSME owners plan restocking and avoid stockouts.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'The user ID' },
        product_id: { type: 'string', description: 'Product ID to forecast (optional - if not provided, forecasts all products)' },
        days_ahead: { type: 'number', default: 30, description: 'Number of days to forecast' },
        include_seasonal: { type: 'boolean', default: true, description: 'Include seasonal trends in forecast' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'get_inventory_alerts_new',
    description: 'Get critical inventory alerts with actionable insights: low stock, out of stock, overstock, reorder suggestions',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        alert_type: { type: 'string', enum: ['low_stock', 'out_of_stock', 'overstock', 'reorder_now', 'all'], default: 'all' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'analyze_profit_margins',
    description: 'Analyze profit margins by product, category, or overall business. Helps identify most profitable items.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        group_by: { type: 'string', enum: ['product', 'category', 'overall'], default: 'overall' },
        time_period: { type: 'string', enum: ['today', 'week', 'month', 'year'], default: 'month' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'get_pending_payments',
    description: 'Get pending and overdue payments for cash flow management. Critical for MSME cash flow tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        status: { type: 'string', enum: ['pending', 'overdue', 'all'], default: 'all' },
        sort_by: { type: 'string', enum: ['amount', 'date', 'customer'], default: 'date' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'get_customer_insights',
    description: 'Get customer behavior insights: top customers, purchase frequency, average order value',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        metric: { type: 'string', enum: ['top_customers', 'purchase_frequency', 'average_order_value', 'all'], default: 'all' },
        limit: { type: 'number', default: 10 },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'quick_business_snapshot',
    description: 'Quick business health snapshot for busy MSME owners. Returns: today vs yesterday, week trend, critical alerts, quick wins.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'suggest_reorder',
    description: 'Smart reorder suggestions based on sales velocity and lead time. Prioritized by urgency (critical/soon/plan_ahead).',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        urgency: { type: 'string', enum: ['critical', 'soon', 'plan_ahead', 'all'], default: 'all' },
      },
      required: ['user_id'],
    },
  },
];

// Tool handler implementation
async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  const db = getDbService();

  switch (name) {
    case 'generate_custom_pdf': {
      const user = await db.getUser(args.user_id as string);
      if (!user) throw new Error('User not found');

      const pdfBase64 = await generateMarkdownPDF({
        title: args.title as string,
        content_md: args.content_md as string,
        user,
      });

      return {
        isDocument: true,
        docType: 'markdown',
        title: args.title,
        content: args.content_md,
        user,
        pdf_base64: pdfBase64,
        filename: `${(args.title as string).toLowerCase().replace(/\s+/g, '_')}.pdf`,
      };
    }
    // ============ INVENTORY ============
    case 'get_products':
      return await db.getProducts(args.user_id as string, {
        category: args.category as string | undefined,
        search: args.search as string | undefined,
        lowStockOnly: args.low_stock_only as boolean | undefined,
        limit: args.limit as number | undefined,
      });

    case 'get_product':
      return await db.getProduct(args.user_id as string, args.product_id as string);

    case 'create_product': {
      const parsed = tools.createProductSchema.parse(args);
      return await db.createProduct(parsed.user_id, {
        name: parsed.name,
        hindi_name: parsed.hindi_name,
        category: parsed.category,
        price: parsed.price,
        cost_price: parsed.cost_price,
        quantity: parsed.quantity,
        unit: parsed.unit,
        low_stock_threshold: parsed.low_stock_threshold,
        barcode: parsed.barcode,
        hsn_code: parsed.hsn_code,
        gst_rate: parsed.gst_rate,
      });
    }

    case 'update_stock': {
      const parsed = tools.updateStockSchema.parse(args);
      return await db.updateStock(
        parsed.user_id,
        parsed.product_id,
        parsed.quantity,
        parsed.operation
      );
    }

    case 'get_inventory_alerts':
      return await db.getInventoryAlerts(args.user_id as string);

    // ============ CUSTOMERS ============
    case 'get_customers':
      return await db.getCustomers(args.user_id as string, {
        search: args.search as string | undefined,
        limit: args.limit as number | undefined,
      });

    case 'get_customer':
      return await db.getCustomer(args.user_id as string, args.customer_id as string);

    case 'create_customer': {
      const parsed = tools.createCustomerSchema.parse(args);
      return await db.createCustomer(parsed.user_id, {
        name: parsed.name,
        phone: parsed.phone,
        email: parsed.email,
        address: parsed.address,
        gst_number: parsed.gst_number,
        credit_limit: parsed.credit_limit,
        outstanding_balance: 0,
      });
    }

    case 'update_customer_balance': {
      const parsed = tools.updateCustomerBalanceSchema.parse(args);
      return await db.updateCustomerBalance(
        parsed.user_id,
        parsed.customer_id,
        parsed.amount,
        parsed.operation
      );
    }

    // ============ TRANSACTIONS ============
    case 'get_transactions':
      return await db.getTransactions(args.user_id as string, {
        startDate: args.start_date as string | undefined,
        endDate: args.end_date as string | undefined,
        paymentType: args.payment_type as string | undefined,
        status: args.status as string | undefined,
        customerId: args.customer_id as string | undefined,
        limit: args.limit as number | undefined,
      });

    case 'create_transaction': {
      const parsed = tools.createTransactionSchema.parse(args);
      return await db.createTransaction(parsed.user_id, {
        customer_id: parsed.customer_id,
        invoice_id: parsed.invoice_id,
        amount: parsed.amount,
        payment_type: parsed.payment_type,
        payment_status: parsed.payment_status,
        upi_transaction_id: parsed.upi_transaction_id,
        notes: parsed.notes,
      });
    }

    // ============ INVOICES ============
    case 'get_invoices':
      return await db.getInvoices(args.user_id as string, {
        status: args.status as string | undefined,
        type: args.type as string | undefined,
        customerId: args.customer_id as string | undefined,
        startDate: args.start_date as string | undefined,
        endDate: args.end_date as string | undefined,
        limit: args.limit as number | undefined,
      });

    case 'get_invoice': {
      const invoice = await db.getInvoice(args.user_id as string, args.invoice_id as string);
      if (!invoice) return null;
      const user = await db.getUser(args.user_id as string);
      let customer;
      if (invoice.customer_id) {
        customer = await db.getCustomer(args.user_id as string, invoice.customer_id) || undefined;
      }
      return {
        invoice: {
          ...invoice,
          total_amount: invoice.total,
        },
        user,
        customer,
        isDocument: true,
        docType: 'invoice',
      };
    }

    case 'create_invoice': {
      const parsed = tools.createInvoiceSchema.parse(args);

      // Calculate totals
      const itemsWithTotals = parsed.items.map(item => ({
        ...item,
        total: item.quantity * item.unit_price * (1 - (item.discount || 0) / 100) * (1 + item.gst_rate / 100),
      }));

      const totals = calculateInvoiceTotals(
        parsed.items.map(i => ({
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount: i.discount,
          gst_rate: i.gst_rate,
        })),
        parsed.discount_amount,
        parsed.discount_type
      );

      // Get next invoice number
      const invoiceNumber = await db.getNextInvoiceNumber(parsed.user_id, parsed.invoice_type);

      const invoice = await db.createInvoice(parsed.user_id, {
        customer_id: parsed.customer_id,
        invoice_number: invoiceNumber,
        invoice_type: parsed.invoice_type,
        items: itemsWithTotals,
        subtotal: totals.subtotal,
        discount_amount: totals.discount_amount,
        discount_type: parsed.discount_type,
        tax_amount: totals.tax_amount,
        total: totals.total,
        status: 'draft',
        due_date: parsed.due_date,
        notes: parsed.notes,
        terms: parsed.terms,
      });

      const user = await db.getUser(parsed.user_id);
      let customer;
      if (invoice.customer_id) {
        customer = await db.getCustomer(parsed.user_id, invoice.customer_id) || undefined;
      }

      return {
        invoice: {
          ...invoice,
          total_amount: invoice.total,
        },
        user,
        customer,
        isDocument: true,
        docType: 'invoice',
      };
    }

    case 'update_invoice_status': {
      const parsed = tools.updateInvoiceStatusSchema.parse(args);
      return await db.updateInvoiceStatus(parsed.user_id, parsed.invoice_id, parsed.status);
    }

    case 'generate_invoice_pdf': {
      const parsed = tools.generateInvoicePDFSchema.parse(args);
      const invoice = await db.getInvoice(parsed.user_id, parsed.invoice_id);
      if (!invoice) throw new Error('Invoice not found');

      const user = await db.getUser(parsed.user_id);
      if (!user) throw new Error('User not found');

      let customer;
      if (invoice.customer_id) {
        customer = await db.getCustomer(parsed.user_id, invoice.customer_id) || undefined;
      }

      const pdfBase64 = await generateInvoicePDF({
        invoice,
        seller: user,
        customer,
        includeQR: parsed.include_qr,
      });

      return {
        isDocument: true,
        docType: 'invoice',
        invoice,
        user,
        customer,
        pdf_base64: pdfBase64, // Keep as legacy fallback
        filename: `${invoice.invoice_number}.pdf`,
      };
    }

    case 'generate_report_pdf': {
      const parsed = tools.generateReportPDFSchema.parse(args);
      const user = await db.getUser(parsed.user_id);
      if (!user) throw new Error('User not found');

      let reportData;
      if (parsed.type === 'daily') {
        reportData = await db.getDailyReport(parsed.user_id, parsed.date || new Date().toISOString().split('T')[0]);
      } else if (parsed.type === 'analytics') {
        reportData = await db.getSalesAnalytics(parsed.user_id, parsed.period || 'week');
      } else {
        reportData = await db.getBusinessSummary(parsed.user_id);
      }

      const pdfBase64 = await generateReportPDF({
        user,
        type: parsed.type,
        data: reportData,
      });

      const fileName = `${parsed.type}_report_${new Date().toISOString().split('T')[0]}.pdf`;

      return {
        isDocument: true,
        docType: 'report',
        reportType: parsed.type,
        user,
        data: reportData,
        pdf_base64: pdfBase64, // Keep as legacy fallback
        filename: fileName,
      };
    }

    // ============ UPI/PAYMENTS ============
    case 'generate_upi_qr': {
      const parsed = tools.generateUPIQRSchema.parse(args);
      return await generateUPIQRCode(parsed);
    }

    case 'parse_upi_qr': {
      const parsed = tools.parseUPIQRSchema.parse(args);
      const result = parseUPIString(parsed.qr_string);
      if (!result) throw new Error('Invalid UPI QR string');
      return result;
    }

    case 'validate_upi_id': {
      const parsed = tools.validateUPIIdSchema.parse(args);
      return {
        upi_id: parsed.upi_id,
        is_valid: isValidUPIId(parsed.upi_id),
      };
    }

    // ============ WHATSAPP ============
    case 'share_invoice_whatsapp': {
      const parsed = tools.shareInvoiceWhatsAppSchema.parse(args);
      const invoice = await db.getInvoice(parsed.user_id, parsed.invoice_id);
      if (!invoice) throw new Error('Invoice not found');

      const user = await db.getUser(parsed.user_id);
      if (!user) throw new Error('User not found');

      let customer;
      if (invoice.customer_id) {
        customer = await db.getCustomer(parsed.user_id, invoice.customer_id) || undefined;
      }

      const message = formatInvoiceForWhatsApp({ invoice, seller: user, customer });
      return prepareWhatsAppShare(parsed.phone, message);
    }

    case 'send_payment_reminder': {
      const parsed = tools.sendPaymentReminderSchema.parse(args);
      const message = formatPaymentReminder(
        parsed.customer_name,
        parsed.invoice_number,
        parsed.amount,
        parsed.due_date,
        parsed.upi_id
      );
      return prepareWhatsAppShare(parsed.phone, message);
    }

    case 'send_order_confirmation': {
      const parsed = tools.sendOrderConfirmationSchema.parse(args);
      const message = formatOrderConfirmation(
        parsed.customer_name,
        parsed.order_number,
        parsed.items,
        parsed.total,
        parsed.delivery_date
      );
      return prepareWhatsAppShare(parsed.phone, message);
    }

    case 'send_low_stock_alert': {
      const parsed = tools.sendLowStockAlertSchema.parse(args);
      const message = formatLowStockAlert(parsed.supplier_name, parsed.items);
      return prepareWhatsAppShare(parsed.phone, message);
    }

    // ============ GST ============
    case 'calculate_gst': {
      const parsed = tools.calculateGSTSchema.parse(args);
      const result = calculateGST(parsed.base_amount, parsed.gst_rate, parsed.is_interstate);
      return {
        ...result,
        formatted: formatGSTBreakdown(result),
      };
    }

    case 'calculate_gst_inclusive': {
      const parsed = tools.calculateGSTInclusiveSchema.parse(args);
      return calculateBaseFromGSTInclusive(parsed.total_amount, parsed.gst_rate);
    }

    case 'suggest_gst_rate': {
      const parsed = tools.suggestGSTRateSchema.parse(args);
      return {
        category: parsed.category,
        suggested_rate: suggestGSTRate(parsed.category),
      };
    }

    case 'validate_gstin': {
      const parsed = tools.validateGSTINSchema.parse(args);
      const isValid = isValidGSTIN(parsed.gstin);
      return {
        gstin: parsed.gstin,
        is_valid: isValid,
        state: isValid ? getStateFromGSTIN(parsed.gstin) : null,
      };
    }

    // ============ ANALYTICS ============
    case 'get_daily_report': {
      const parsed = tools.getDailyReportSchema.parse(args);
      const reportData = await db.getDailyReport(parsed.user_id, parsed.date);
      const user = await db.getUser(parsed.user_id);
      return {
        data: reportData,
        user,
        isDocument: true,
        docType: 'report',
        reportType: 'daily',
      };
    }

    case 'get_sales_analytics': {
      const parsed = tools.getSalesAnalyticsSchema.parse(args);
      const reportData = await db.getSalesAnalytics(parsed.user_id, parsed.period);
      const user = await db.getUser(parsed.user_id);
      return {
        data: reportData,
        user,
        isDocument: true,
        docType: 'report',
        reportType: 'analytics',
        period: parsed.period,
      };
    }

    case 'get_business_summary': {
      const userId = args.user_id as string;
      const [products, customers, transactions, invoices] = await Promise.all([
        db.getProducts(userId, { limit: 1000 }),
        db.getCustomers(userId, { limit: 1000 }),
        db.getTransactions(userId, { limit: 1000, status: 'completed' }),
        db.getInvoices(userId, { limit: 1000 }),
      ]);

      const totalRevenue = transactions.reduce((sum: number, t: any) => sum + t.amount, 0);
      const outstandingCustomers = customers.filter(c => c.outstanding_balance > 0);
      const totalOutstanding = outstandingCustomers.reduce((sum: number, c: any) => sum + c.outstanding_balance, 0);
      const lowStockProducts = products.filter(p => p.quantity <= p.low_stock_threshold);

      const user = await db.getUser(userId);

      const result = {
        total_products: products.length,
        total_customers: customers.length,
        total_revenue: totalRevenue,
        total_transactions: transactions.length,
        total_invoices: invoices.length,
        outstanding_amount: totalOutstanding,
        customers_with_outstanding: outstandingCustomers.length,
        low_stock_products: lowStockProducts.length,
        inventory_value: products.reduce((sum: number, p: any) => sum + (p.cost_price || p.price) * p.quantity, 0),
      };

      return {
        data: result,
        user,
        isDocument: true,
        docType: 'report',
        reportType: 'summary',
      };
    }

    case 'get_outstanding_payments': {
      const userId = args.user_id as string;
      const [customers, user] = await Promise.all([
        db.getCustomers(userId, { limit: 1000 }),
        db.getUser(userId),
      ]);
      const data = customers
        .filter(c => c.outstanding_balance > 0)
        .map(c => ({
          customer_id: c.id,
          customer_name: c.name,
          phone: c.phone,
          outstanding_balance: c.outstanding_balance,
        }))
        .sort((a, b) => b.outstanding_balance - a.outstanding_balance);

      return {
        data,
        user,
        isDocument: true,
        docType: 'report',
        reportType: 'outstanding',
      };
    }

    // ============ EXPENSES ============
    case 'get_expenses':
      return await db.getExpenses(args.user_id as string, {
        category: args.category as string | undefined,
        startDate: args.start_date as string | undefined,
        endDate: args.end_date as string | undefined,
        limit: args.limit as number | undefined,
      });

    case 'create_expense': {
      const parsed = tools.createExpenseSchema.parse(args);
      return await db.createExpense(parsed.user_id, {
        category: parsed.category,
        amount: parsed.amount,
        description: parsed.description,
        payment_type: parsed.payment_type,
        date: parsed.date,
      });
    }

    // ============ SUPPLIERS ============
    case 'get_suppliers':
      return await db.getSuppliers(args.user_id as string, {
        search: args.search as string | undefined,
        limit: args.limit as number | undefined,
      });

    case 'create_supplier': {
      const parsed = tools.createSupplierSchema.parse(args);
      return await db.createSupplier(parsed.user_id, {
        name: parsed.name,
        company_name: parsed.company_name,
        phone: parsed.phone,
        email: parsed.email,
        address: parsed.address,
        gst_number: parsed.gst_number,
        payment_terms: parsed.payment_terms,
      });
    }

    // ============ USER ============
    case 'get_user':
      return await db.getUser(args.user_id as string);

    case 'update_user': {
      const parsed = tools.updateUserSchema.parse(args);
      const { user_id, ...updates } = parsed;
      return await db.updateUser(user_id, updates);
    }

    // ============ CONVERSATIONAL ORDERS ============
    case 'init_draft_invoice': {
      const service = getConversationalOrdersService();
      return await service.initDraftInvoice({
        user_id: args.user_id as string,
        customer_id: args.customer_id as string | undefined,
        customer_name: args.customer_name as string | undefined,
        session_id: args.session_id as string | undefined,
      });
    }

    case 'add_invoice_item': {
      const service = getConversationalOrdersService();
      return await service.addInvoiceItem({
        user_id: args.user_id as string,
        session_id: args.session_id as string,
        product_id: args.product_id as string | undefined,
        product_name: args.product_name as string,
        quantity: args.quantity as number,
        unit_price: args.unit_price as number | undefined,
        gst_rate: (args.gst_rate as number) || 18,
      });
    }

    case 'update_invoice_item': {
      const service = getConversationalOrdersService();
      return await service.updateInvoiceItem({
        user_id: args.user_id as string,
        session_id: args.session_id as string,
        product_name: args.product_name as string,
        quantity: args.quantity as number | undefined,
        unit_price: args.unit_price as number | undefined,
      });
    }

    case 'remove_invoice_item': {
      const service = getConversationalOrdersService();
      return await service.removeInvoiceItem({
        user_id: args.user_id as string,
        session_id: args.session_id as string,
        product_name: args.product_name as string,
      });
    }

    case 'get_draft_invoice': {
      const service = getConversationalOrdersService();
      return await service.getDraftInvoice({
        user_id: args.user_id as string,
        session_id: args.session_id as string,
      });
    }

    case 'finalize_draft_invoice': {
      const service = getConversationalOrdersService();
      return await service.finalizeDraftInvoice({
        user_id: args.user_id as string,
        session_id: args.session_id as string,
        customer_id: args.customer_id as string | undefined,
        customer_name: args.customer_name as string | undefined,
        customer_phone: args.customer_phone as string | undefined,
        payment_method: (args.payment_method as any) || 'Cash',
        notes: args.notes as string | undefined,
      });
    }

    case 'cancel_draft_invoice': {
      const service = getConversationalOrdersService();
      return await service.cancelDraftInvoice({
        user_id: args.user_id as string,
        session_id: args.session_id as string,
      });
    }

    // ============ OCR & RECEIPTS ============
    case 'extract_receipt_data': {
      const service = getOCRService();
      const imageUrl = args.image_url as string | undefined;
      const imageBase64 = args.image_base64 as string | undefined;

      if (!imageUrl && !imageBase64) {
        throw new Error('Either image_url or image_base64 must be provided');
      }

      if (imageUrl) {
        return await service.extractReceiptData(imageUrl);
      } else {
        // For base64, we'd need to save to temporary location first
        throw new Error('Base64 image support not yet implemented');
      }
    }

    case 'create_expense_from_receipt': {
      const ocrService = getOCRService();
      const imageUrl = args.image_url as string | undefined;

      if (!imageUrl) {
        throw new Error('image_url is required');
      }

      // Extract receipt data
      const receiptData = await ocrService.extractReceiptData(imageUrl);

      // Create expense
      const db = getDbService();
      return await db.createExpense(args.user_id as string, {
        category: (args.category as string) || 'Other',
        amount: (args.amount as number) || receiptData.total_amount || 0,
        description: (args.vendor_name as string) || receiptData.vendor_name || 'Receipt expense',
        payment_type: receiptData.payment_method?.toLowerCase() as any || 'cash',
        date: receiptData.date || new Date().toISOString().split('T')[0],
      });
    }

    // ============ STOCK FORECASTING ============
    case 'predict_stock_needs': {
      const service = getForecastingService();
      const productId = args.product_id as string | undefined;

      if (productId) {
        // Single product forecast
        return await service.predictSingleProduct(
          args.user_id as string,
          productId,
          (args.time_period as string) === 'month' ? 30 : 7
        );
      } else {
        // All products forecast
        return await service.getRestockRecommendations(args.user_id as string, {
          onlyLowStock: (args.only_low_stock as boolean) !== false,
          timePeriod: (args.time_period as 'week' | 'month') || 'week',
        });
      }
    }

    case 'get_restock_recommendations': {
      const service = getForecastingService();
      const recommendations = await service.getRestockRecommendations(
        args.user_id as string,
        {
          onlyLowStock: true,
          timePeriod: 'week',
        }
      );

      // Filter by urgency
      const urgencyFilter = (args.urgency_filter as string) || 'high';
      const filteredRecs = urgencyFilter === 'all'
        ? recommendations
        : recommendations.filter(r => {
            if (urgencyFilter === 'critical') return r.urgency === 'critical';
            if (urgencyFilter === 'high') return ['critical', 'high'].includes(r.urgency);
            if (urgencyFilter === 'medium') return ['critical', 'high', 'medium'].includes(r.urgency);
            return true;
          });

      return filteredRecs.slice(0, (args.limit as number) || 20);
    }

    case 'set_reorder_rule': {
      const service = getForecastingService();
      return await service.setReorderRule(
        args.user_id as string,
        args.product_id as string,
        {
          auto_reorder: args.auto_reorder as boolean | undefined,
          reorder_point: args.reorder_point as number,
          reorder_quantity: args.reorder_quantity as number,
          preferred_supplier_id: args.preferred_supplier_id as string | undefined,
          lead_time_days: (args.lead_time_days as number) || 7,
          safety_stock: (args.safety_stock as number) || 0,
        }
      );
    }

    case 'get_product_forecast': {
      const service = getForecastingService();
      return await service.predictSingleProduct(
        args.user_id as string,
        args.product_id as string,
        (args.days_ahead as number) || 30
      );
    }

    case 'analyze_sales_trend': {
      const service = getForecastingService();
      const forecast = await service.predictSingleProduct(
        args.user_id as string,
        args.product_id as string,
        (args.period_days as number) || 30
      );

      // The forecast already includes trend analysis in the prediction algorithm
      return {
        product_id: args.product_id,
        period_days: (args.period_days as number) || 30,
        daily_average_sales: forecast.suggested_reorder_quantity / 7, // Rough estimate
        confidence: forecast.confidence,
        urgency: forecast.urgency,
        trend: forecast.days_until_runout < 7 ? 'increasing' : 'stable',
      };
    }

    // ============ MSME PRODUCTIVITY & BUSINESS INTELLIGENCE ============
    case 'forecast_inventory': {
      const service = getMSMEProductivityService();
      const parsed = msmeTools.forecastInventorySchema.parse(args);
      return await service.forecastInventory(parsed);
    }

    case 'get_inventory_alerts_new': {
      const service = getMSMEProductivityService();
      const parsed = msmeTools.getInventoryAlertsNewSchema.parse(args);
      return await service.getInventoryAlerts(parsed);
    }

    case 'analyze_profit_margins': {
      const service = getMSMEProductivityService();
      const parsed = msmeTools.analyzeProfitMarginsSchema.parse(args);
      return await service.analyzeProfitMargins(parsed);
    }

    case 'get_pending_payments': {
      const service = getMSMEProductivityService();
      const parsed = msmeTools.getPendingPaymentsSchema.parse(args);
      return await service.getPendingPayments(parsed);
    }

    case 'get_customer_insights': {
      const service = getMSMEProductivityService();
      const parsed = msmeTools.getCustomerInsightsSchema.parse(args);
      return await service.getCustomerInsights(parsed);
    }

    case 'quick_business_snapshot': {
      const service = getMSMEProductivityService();
      const parsed = msmeTools.quickBusinessSnapshotSchema.parse(args);
      return await service.quickBusinessSnapshot(parsed);
    }

    case 'suggest_reorder': {
      const service = getMSMEProductivityService();
      const parsed = msmeTools.suggestReorderSchema.parse(args);
      return await service.suggestReorder(parsed);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Create and configure the MCP server
const server = new Server(
  {
    name: 'vyapar-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool listing handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await handleToolCall(name, args || {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: errorMessage }),
        },
      ],
      isError: true,
    };
  }
});

// Determine transport mode
const isHTTPMode = process.env.MCP_HTTP_MODE === 'true' || process.argv.includes('--http');

if (isHTTPMode) {
  // Import auth middleware
  import('./middleware/auth.js').then(({
    authMiddleware,
    rateLimitMiddleware,
    corsMiddleware,
  }) => {
    // HTTP/SSE mode for remote hosting
    const app = express();
    const port = parseInt(process.env.PORT || '3000', 10);

    // Apply global middleware
    app.use(express.json());
    app.use(corsMiddleware);
    app.use(rateLimitMiddleware);

    // Root landing page
    app.get('/', (req, res) => {
      res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vyapar MCP Server</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    .logo {
      font-size: 48px;
      margin-bottom: 10px;
    }
    h1 {
      color: #1a1a2e;
      font-size: 28px;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #666;
      font-size: 16px;
      margin-bottom: 30px;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #e8f5e9;
      padding: 12px 20px;
      border-radius: 10px;
      margin-bottom: 30px;
    }
    .status-dot {
      width: 12px;
      height: 12px;
      background: #4caf50;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .status-text {
      color: #2e7d32;
      font-weight: 600;
    }
    .endpoints {
      background: #f5f5f5;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .endpoints h3 {
      color: #333;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 15px;
    }
    .endpoint {
      display: flex;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .endpoint:last-child { border-bottom: none; }
    .method {
      font-size: 12px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 4px;
      margin-right: 12px;
      min-width: 50px;
      text-align: center;
    }
    .method.get { background: #e3f2fd; color: #1976d2; }
    .method.post { background: #fff3e0; color: #f57c00; }
    .path { color: #333; font-family: monospace; font-size: 14px; }
    .tools-count {
      text-align: center;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 10px;
      color: white;
    }
    .tools-count .number {
      font-size: 48px;
      font-weight: 700;
    }
    .tools-count .label {
      font-size: 14px;
      opacity: 0.9;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      color: #999;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🏪</div>
    <h1>Vyapar MCP Server</h1>
    <p class="subtitle">AI-powered business tools for Indian MSMEs</p>

    <div class="status">
      <div class="status-dot"></div>
      <span class="status-text">Server is running</span>
    </div>

    <div class="endpoints">
      <h3>API Endpoints</h3>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/health</span>
      </div>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/mcp/tools</span>
      </div>
      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/mcp/tools/call</span>
      </div>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/mcp/me</span>
      </div>
    </div>

    <div class="tools-count">
      <div class="number">${TOOLS.length}</div>
      <div class="label">AI Tools Available</div>
    </div>

    <div class="footer">
      Powered by Model Context Protocol (MCP) • v1.0.0
    </div>
  </div>
</body>
</html>
      `);
    });

    // Health check endpoint (no auth required)
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', service: 'vyapar-mcp', version: '1.0.0', tools_count: TOOLS.length });
    });

    // MCP endpoint (SSE) - requires auth
    app.get('/mcp', authMiddleware, async (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send capabilities
      res.write(`data: ${JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'vyapar-mcp', version: '1.0.0' },
        },
      })}\n\n`);
    });

    // Tool call endpoint - requires auth
    app.post('/mcp/tools/call', authMiddleware, async (req: any, res) => {
      try {
        const { name, arguments: args } = req.body;
        const authenticatedUserId = req.userId;

        // Inject authenticated user_id if not provided
        const finalArgs = {
          ...args,
          user_id: args?.user_id || authenticatedUserId,
        };

        // Security: Ensure user can only access their own data
        if (args?.user_id && args.user_id !== authenticatedUserId) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'You can only access your own data',
          });
        }

        const result = await handleToolCall(name, finalArgs);
        res.json({ result });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(400).json({ error: errorMessage });
      }
    });

    // List tools endpoint (no auth required, read-only)
    app.get('/mcp/tools', (req, res) => {
      res.json({ tools: TOOLS });
    });

    // Get current user info
    app.get('/mcp/me', authMiddleware, async (req: any, res) => {
      try {
        const user = await getDbService().getUser(req.userId);
        res.json({ user });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(400).json({ error: errorMessage });
      }
    });

    app.listen(port, () => {
      console.log(`Vyapar MCP server running on port ${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`Tools: http://localhost:${port}/mcp/tools`);
      console.log(`Auth: Supabase JWT token required for tool calls`);
    });
  });
} else {
  // STDIO mode for local development
  async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Vyapar MCP server running on stdio');
  }

  main().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}
