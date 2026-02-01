# Vyapar MCP Server

A Model Context Protocol (MCP) server for the Vyapar MSME business management app. This server provides 36 AI-powered tools for managing inventory, invoices, payments, customers, and more.

## Live Server

**Production URL:** `https://mcp.felon.in`

## Features

### Inventory Management
- Get, create, and update products
- Stock management (add, subtract, set)
- Low stock alerts with threshold configuration
- Barcode/HSN code support
- Hindi name support for products

### Invoice Generation
- Create invoices, quotations, proforma invoices, delivery challans
- Automatic GST calculation (CGST/SGST/IGST)
- PDF generation with UPI QR codes
- Invoice number auto-generation
- Multiple payment status tracking

### UPI Payments
- Generate UPI payment QR codes (NPCI-compliant)
- Parse UPI QR strings
- Validate UPI IDs
- Support for all major UPI apps

### WhatsApp Integration
- Share invoices via WhatsApp
- Payment reminders with UPI deep links
- Order confirmations
- Low stock alerts to suppliers

### Analytics & Reports
- Daily business reports
- Sales analytics (week/month/year)
- Payment breakdown by type
- Top products analysis
- Outstanding payments tracking

### GST Calculations
- Calculate CGST/SGST/IGST
- Reverse GST calculation (from inclusive total)
- GST rate suggestions by category
- GSTIN validation with state extraction

### Customer & Supplier Management
- Customer CRUD operations
- Outstanding balance tracking
- Credit limit management
- Supplier management with payment terms

## Installation

```bash
npm install
npm run build
```

## Configuration

Create a `.env` file based on `.env.example`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
PORT=3000
MCP_HTTP_MODE=true
```

## Running

### Development (STDIO mode)
```bash
npm run dev
```

### Production (HTTP mode)
```bash
npm start
```

Or with explicit HTTP mode:
```bash
MCP_HTTP_MODE=true npm start
```

## Deployment

This server is configured for deployment with Nixpacks. Simply push to your hosting provider (Railway, Render, etc.) and it will automatically build and deploy.

The `nixpacks.toml` file includes all necessary system dependencies for PDF generation and image processing.

## API Endpoints (HTTP Mode)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | No | Landing page with server status |
| GET | `/health` | No | Health check |
| GET | `/mcp/tools` | No | List all available tools |
| POST | `/mcp/tools/call` | Yes | Call a tool |
| GET | `/mcp/me` | Yes | Get current user info |

### Authentication

All authenticated endpoints require a valid Supabase JWT token in the Authorization header:

```
Authorization: Bearer <supabase_access_token>
```

## Complete Tools Reference (36 Tools)

### Inventory Tools (5)

#### `get_products`
Get list of products/inventory items with filtering options.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| category | string | No | Filter by category |
| search | string | No | Search term |
| low_stock_only | boolean | No | Only show low stock items |
| limit | number | No | Max results (default: 50) |

#### `get_product`
Get details of a specific product by ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| product_id | string | Yes | The product ID |

#### `create_product`
Add a new product to inventory.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| name | string | Yes | Product name |
| hindi_name | string | No | Name in Hindi |
| category | string | Yes | Product category |
| price | number | Yes | Selling price |
| cost_price | number | No | Cost price |
| quantity | number | Yes | Current stock |
| unit | string | No | Unit (default: pcs) |
| low_stock_threshold | number | No | Alert threshold (default: 10) |
| barcode | string | No | Barcode number |
| hsn_code | string | No | HSN/SAC code |
| gst_rate | number | No | GST rate (default: 18) |

#### `update_stock`
Update stock quantity for a product.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| product_id | string | Yes | The product ID |
| quantity | number | Yes | Amount to add/subtract/set |
| operation | string | Yes | "add", "subtract", or "set" |

#### `get_inventory_alerts`
Get list of products that are low in stock or out of stock.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |

---

### Customer Tools (4)

#### `get_customers`
Get list of customers with search capability.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| search | string | No | Search by name or phone |
| limit | number | No | Max results (default: 50) |

#### `get_customer`
Get details of a specific customer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| customer_id | string | Yes | The customer ID |

#### `create_customer`
Add a new customer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| name | string | Yes | Customer name |
| phone | string | Yes | Phone number |
| email | string | No | Email address |
| address | string | No | Address |
| gst_number | string | No | Customer GSTIN |
| credit_limit | number | No | Credit limit amount |

#### `update_customer_balance`
Update outstanding balance for a customer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| customer_id | string | Yes | The customer ID |
| amount | number | Yes | Amount to add/subtract |
| operation | string | Yes | "add" or "subtract" |

---

### Transaction Tools (2)

#### `get_transactions`
Get list of transactions with filters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| start_date | string | No | Start date (ISO format) |
| end_date | string | No | End date (ISO format) |
| payment_type | string | No | cash/upi/credit/bank_transfer/cheque |
| status | string | No | pending/completed/failed/refunded |
| customer_id | string | No | Filter by customer |
| limit | number | No | Max results (default: 50) |

#### `create_transaction`
Record a new payment/transaction.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| amount | number | Yes | Transaction amount |
| payment_type | string | Yes | cash/upi/credit/bank_transfer/cheque |
| customer_id | string | No | Customer ID |
| invoice_id | string | No | Related invoice ID |
| payment_status | string | No | pending/completed/failed (default: completed) |
| upi_transaction_id | string | No | UPI reference ID |
| notes | string | No | Transaction notes |

---

### Invoice Tools (5)

#### `get_invoices`
Get list of invoices/quotations with filters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| status | string | No | draft/sent/paid/partial/overdue/cancelled |
| type | string | No | invoice/quotation/proforma/delivery_challan |
| customer_id | string | No | Filter by customer |
| start_date | string | No | Start date |
| end_date | string | No | End date |
| limit | number | No | Max results (default: 50) |

#### `get_invoice`
Get details of a specific invoice.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| invoice_id | string | Yes | The invoice ID |

#### `create_invoice`
Create a new invoice or quotation with line items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| items | array | Yes | Array of line items (see below) |
| customer_id | string | No | Customer ID |
| invoice_type | string | No | invoice/quotation/proforma/delivery_challan |
| discount_amount | number | No | Discount amount |
| discount_type | string | No | percentage/fixed |
| due_date | string | No | Payment due date |
| notes | string | No | Invoice notes |
| terms | string | No | Terms and conditions |

**Line Item Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Item name |
| quantity | number | Yes | Quantity |
| unit_price | number | Yes | Price per unit |
| product_id | string | No | Link to product |
| description | string | No | Item description |
| unit | string | No | Unit (default: pcs) |
| discount | number | No | Item discount % |
| gst_rate | number | No | GST rate (default: 18) |

#### `update_invoice_status`
Update the status of an invoice.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| invoice_id | string | Yes | The invoice ID |
| status | string | Yes | draft/sent/paid/partial/overdue/cancelled |

#### `generate_invoice_pdf`
Generate a PDF for an invoice.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| invoice_id | string | Yes | The invoice ID |
| include_qr | boolean | No | Include UPI QR code (default: true) |

**Returns:** Base64 encoded PDF, filename, and content type.

---

### UPI/Payment Tools (3)

#### `generate_upi_qr`
Generate a UPI payment QR code for receiving payments.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| payee_upi_id | string | Yes | UPI ID (e.g., shop@upi) |
| payee_name | string | Yes | Payee/shop name |
| amount | number | Yes | Amount to receive |
| transaction_note | string | No | Payment description |
| transaction_ref | string | No | Reference (invoice number) |

**Returns:** QR image as base64, UPI deep link, and UPI string.

#### `parse_upi_qr`
Parse a UPI QR code string and extract payment details.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| qr_string | string | Yes | UPI QR string (upi://pay?...) |

**Returns:** Parsed details (payee UPI ID, name, amount, etc.)

#### `validate_upi_id`
Validate if a UPI ID is in correct format.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| upi_id | string | Yes | UPI ID to validate |

**Returns:** UPI ID and validation result.

---

### WhatsApp Tools (4)

#### `share_invoice_whatsapp`
Prepare invoice for sharing via WhatsApp.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| invoice_id | string | Yes | The invoice ID |
| phone | string | Yes | Customer phone number |
| include_image | boolean | No | Include invoice image (default: true) |

**Returns:** Formatted message and WhatsApp deep link.

#### `send_payment_reminder`
Prepare a payment reminder message for WhatsApp.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customer_name | string | Yes | Customer name |
| invoice_number | string | Yes | Invoice number |
| amount | number | Yes | Outstanding amount |
| phone | string | Yes | Customer phone |
| due_date | string | No | Payment due date |
| upi_id | string | No | Your UPI ID for payment |

#### `send_order_confirmation`
Prepare an order confirmation message for WhatsApp.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customer_name | string | Yes | Customer name |
| order_number | string | Yes | Order/Invoice number |
| items | array | Yes | Array of items |
| total | number | Yes | Order total |
| phone | string | Yes | Customer phone |
| delivery_date | string | No | Expected delivery date |

#### `send_low_stock_alert`
Prepare a low stock reorder message for supplier via WhatsApp.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| supplier_name | string | Yes | Supplier name |
| items | array | Yes | Array of items to reorder |
| phone | string | Yes | Supplier phone |

---

### GST Tools (4)

#### `calculate_gst`
Calculate GST (CGST/SGST or IGST) for a given amount.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| base_amount | number | Yes | Amount before GST |
| gst_rate | number | Yes | GST rate (e.g., 18) |
| is_interstate | boolean | No | Interstate transaction? (default: false) |

**Returns:** Base amount, GST breakdown (CGST/SGST or IGST), total, and formatted text.

#### `calculate_gst_inclusive`
Calculate base amount from a GST-inclusive total.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| total_amount | number | Yes | Total including GST |
| gst_rate | number | Yes | GST rate |

**Returns:** Base amount, GST amount, and total.

#### `suggest_gst_rate`
Suggest appropriate GST rate for a product category.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| category | string | Yes | Product category |

**Returns:** Category and suggested GST rate.

#### `validate_gstin`
Validate GSTIN format and extract state information.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| gstin | string | Yes | GSTIN to validate |

**Returns:** GSTIN, validity status, and state (if valid).

---

### Analytics Tools (4)

#### `get_daily_report`
Get daily business report including sales, transactions, expenses, and top products.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| date | string | Yes | Date (YYYY-MM-DD format) |

**Returns:** Revenue, orders count, expenses, top products, payment breakdown.

#### `get_sales_analytics`
Get sales analytics for a time period.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| period | string | Yes | "week", "month", or "year" |

**Returns:** Revenue trends, payment breakdown, growth percentage, top products.

#### `get_business_summary`
Get overall business summary.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |

**Returns:** Total products, customers, revenue, transactions, invoices, outstanding amount, inventory value.

#### `get_outstanding_payments`
Get list of customers with outstanding payments.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |

**Returns:** Array of customers sorted by outstanding balance.

---

### Expense Tools (2)

#### `get_expenses`
Get list of business expenses.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| category | string | No | Filter by category |
| start_date | string | No | Start date |
| end_date | string | No | End date |
| limit | number | No | Max results (default: 50) |

#### `create_expense`
Record a new business expense.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| category | string | Yes | Expense category |
| amount | number | Yes | Expense amount |
| description | string | Yes | Description |
| payment_type | string | Yes | cash/upi/bank_transfer/cheque |
| date | string | Yes | Date (YYYY-MM-DD) |

---

### Supplier Tools (2)

#### `get_suppliers`
Get list of suppliers.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| search | string | No | Search term |
| limit | number | No | Max results (default: 50) |

#### `create_supplier`
Add a new supplier.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| name | string | Yes | Supplier name |
| phone | string | Yes | Phone number |
| company_name | string | No | Company name |
| email | string | No | Email address |
| address | string | No | Address |
| gst_number | string | No | Supplier GSTIN |
| payment_terms | string | No | Payment terms |

---

### User Tools (2)

#### `get_user`
Get user/shop profile details.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |

#### `update_user`
Update user/shop profile.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | The user ID |
| name | string | No | Owner name |
| shop_name | string | No | Shop/business name |
| upi_id | string | No | UPI ID for payments |
| phone | string | No | Phone number |
| email | string | No | Email address |
| address | string | No | Business address |
| gst_number | string | No | GSTIN |
| language | string | No | "en", "hi", or "hinglish" |

---

## Supabase Schema

The server expects the following tables in Supabase:

| Table | Description |
|-------|-------------|
| `users` | User/shop profiles |
| `products` | Inventory items |
| `customers` | Customer records |
| `transactions` | Payment records |
| `invoices` | Invoice/quotation records |
| `expenses` | Business expenses |
| `suppliers` | Supplier records |

See the `types/index.ts` file for detailed schema definitions.

## Example Usage

### Generate UPI QR Code

```bash
curl -X POST https://mcp.felon.in/mcp/tools/call \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -d '{
    "name": "generate_upi_qr",
    "arguments": {
      "payee_upi_id": "myshop@upi",
      "payee_name": "My Shop",
      "amount": 500,
      "transaction_note": "Invoice #1234"
    }
  }'
```

### Create Invoice

```bash
curl -X POST https://mcp.felon.in/mcp/tools/call \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -d '{
    "name": "create_invoice",
    "arguments": {
      "user_id": "your-user-id",
      "items": [
        {
          "name": "Product A",
          "quantity": 2,
          "unit_price": 500,
          "gst_rate": 18
        }
      ],
      "customer_id": "customer-id"
    }
  }'
```

### Get Daily Report

```bash
curl -X POST https://mcp.felon.in/mcp/tools/call \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -d '{
    "name": "get_daily_report",
    "arguments": {
      "user_id": "your-user-id",
      "date": "2024-01-26"
    }
  }'
```

## Security

- All tool calls require Supabase JWT authentication
- Users can only access their own data (enforced server-side)
- Rate limiting is applied to prevent abuse
- CORS is configured for the mobile app origin

## License

MIT
