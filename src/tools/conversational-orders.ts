import { z } from 'zod';

// ============================================
// CONVERSATIONAL ORDER CREATION TOOLS
// For multi-turn AI conversations to build invoices
// ============================================

/**
 * Initialize a new draft invoice session
 * Used at the start of a conversational order flow
 */
export const initDraftInvoiceSchema = z.object({
  user_id: z.string().describe('The user ID'),
  customer_id: z.string().optional().describe('Optional customer ID if known'),
  customer_name: z.string().optional().describe('Optional customer name'),
  session_id: z.string().optional().describe('Session ID (auto-generated if not provided)'),
});

/**
 * Add or update an item in the draft invoice
 * Supports natural language like "add 5 bags of rice"
 */
export const addInvoiceItemSchema = z.object({
  user_id: z.string().describe('The user ID'),
  session_id: z.string().describe('Draft invoice session ID'),
  product_id: z.string().optional().describe('Product ID if known'),
  product_name: z.string().describe('Product name (for fuzzy search if product_id not provided)'),
  quantity: z.number().describe('Quantity to add'),
  unit_price: z.number().optional().describe('Override price (uses product price if not provided)'),
  gst_rate: z.number().optional().default(18).describe('GST rate percentage'),
});

/**
 * Update an existing item in the draft
 * Used when user says "change rice to 3 bags"
 */
export const updateInvoiceItemSchema = z.object({
  user_id: z.string().describe('The user ID'),
  session_id: z.string().describe('Draft invoice session ID'),
  product_name: z.string().describe('Product name to update'),
  quantity: z.number().optional().describe('New quantity'),
  unit_price: z.number().optional().describe('New price'),
});

/**
 * Remove an item from the draft
 * Used when user says "remove sugar from the invoice"
 */
export const removeInvoiceItemSchema = z.object({
  user_id: z.string().describe('The user ID'),
  session_id: z.string().describe('Draft invoice session ID'),
  product_name: z.string().describe('Product name to remove'),
});

/**
 * Get the current state of the draft invoice
 * Used to show what's in the invoice so far
 */
export const getDraftInvoiceSchema = z.object({
  user_id: z.string().describe('The user ID'),
  session_id: z.string().describe('Draft invoice session ID'),
});

/**
 * Finalize the draft and create an actual invoice
 * Used when user says "create invoice" or "done"
 */
export const finalizeDraftInvoiceSchema = z.object({
  user_id: z.string().describe('The user ID'),
  session_id: z.string().describe('Draft invoice session ID'),
  customer_id: z.string().optional().describe('Final customer ID'),
  customer_name: z.string().optional().describe('Final customer name'),
  customer_phone: z.string().optional().describe('Customer phone number'),
  payment_method: z.enum(['Cash', 'UPI', 'Credit', 'Card']).default('Cash'),
  notes: z.string().optional().describe('Invoice notes'),
});

/**
 * Cancel and delete a draft invoice
 * Used when user abandons the conversation
 */
export const cancelDraftInvoiceSchema = z.object({
  user_id: z.string().describe('The user ID'),
  session_id: z.string().describe('Draft invoice session ID'),
});

// Type exports for use in implementation
export type InitDraftInvoiceInput = z.infer<typeof initDraftInvoiceSchema>;
export type AddInvoiceItemInput = z.infer<typeof addInvoiceItemSchema>;
export type UpdateInvoiceItemInput = z.infer<typeof updateInvoiceItemSchema>;
export type RemoveInvoiceItemInput = z.infer<typeof removeInvoiceItemSchema>;
export type GetDraftInvoiceInput = z.infer<typeof getDraftInvoiceSchema>;
export type FinalizeDraftInvoiceInput = z.infer<typeof finalizeDraftInvoiceSchema>;
export type CancelDraftInvoiceInput = z.infer<typeof cancelDraftInvoiceSchema>;
