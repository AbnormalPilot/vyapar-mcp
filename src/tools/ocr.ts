import { z } from 'zod';

// ============================================
// OCR TOOLS FOR RECEIPT SCANNING
// ============================================

/**
 * Extract structured data from receipt image
 * Supports URL (Supabase Storage) or base64 images
 */
export const extractReceiptDataSchema = z.object({
  user_id: z.string().describe('The user ID'),
  image_url: z.string().optional().describe('Supabase Storage URL or public URL of receipt image'),
  image_base64: z.string().optional().describe('Base64 encoded image data'),
}).refine(
  (data) => data.image_url || data.image_base64,
  { message: 'Either image_url or image_base64 must be provided' }
);

/**
 * Create expense entry from extracted receipt data
 * Automatically creates expense record after OCR
 */
export const createExpenseFromReceiptSchema = z.object({
  user_id: z.string().describe('The user ID'),
  image_url: z.string().optional().describe('Receipt image URL'),
  image_base64: z.string().optional().describe('Base64 encoded receipt'),
  vendor_name: z.string().optional().describe('Override extracted vendor name'),
  amount: z.number().optional().describe('Override extracted amount'),
  category: z.string().optional().default('Other').describe('Expense category'),
  notes: z.string().optional().describe('Additional notes'),
});

// Type exports
export type ExtractReceiptDataInput = z.infer<typeof extractReceiptDataSchema>;
export type CreateExpenseFromReceiptInput = z.infer<typeof createExpenseFromReceiptSchema>;
