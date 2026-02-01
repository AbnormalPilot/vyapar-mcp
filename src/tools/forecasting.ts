import { z } from 'zod';

// ============================================
// STOCK FORECASTING TOOLS
// ============================================

/**
 * Predict stock requirements based on sales history
 * Returns when to reorder and how much
 */
export const predictStockNeedsSchema = z.object({
  user_id: z.string().describe('The user ID'),
  product_id: z.string().optional().describe('Specific product ID (omit for all products)'),
  time_period: z.enum(['week', 'month']).default('week').describe('Forecast time period'),
  only_low_stock: z.boolean().default(true).describe('Only show low stock items'),
});

/**
 * Get restock recommendations for this week
 * Returns urgent items that need reordering
 */
export const getRestockRecommendationsSchema = z.object({
  user_id: z.string().describe('The user ID'),
  urgency_filter: z.enum(['critical', 'high', 'medium', 'all']).default('high').describe('Filter by urgency level'),
  limit: z.number().optional().default(20).describe('Maximum number of recommendations'),
});

/**
 * Set automatic reorder rule for a product
 * AI can configure this based on user preferences
 */
export const setReorderRuleSchema = z.object({
  user_id: z.string().describe('The user ID'),
  product_id: z.string().describe('Product ID to set rule for'),
  auto_reorder: z.boolean().default(false).describe('Enable automatic reordering'),
  reorder_point: z.number().describe('Stock level to trigger reorder'),
  reorder_quantity: z.number().describe('Quantity to order'),
  preferred_supplier_id: z.string().optional().describe('Preferred supplier customer ID'),
  lead_time_days: z.number().default(7).describe('Supplier lead time in days'),
  safety_stock: z.number().default(0).describe('Safety stock buffer quantity'),
});

/**
 * Get forecast for a specific product
 */
export const getProductForecastSchema = z.object({
  user_id: z.string().describe('The user ID'),
  product_id: z.string().describe('Product ID'),
  days_ahead: z.number().default(30).describe('Number of days to forecast'),
});

/**
 * Analyze sales trends for a product
 * Returns trend analysis (increasing, stable, decreasing)
 */
export const analyzeSalesTrendSchema = z.object({
  user_id: z.string().describe('The user ID'),
  product_id: z.string().describe('Product ID'),
  period_days: z.number().default(30).describe('Period to analyze in days'),
});

// Type exports
export type PredictStockNeedsInput = z.infer<typeof predictStockNeedsSchema>;
export type GetRestockRecommendationsInput = z.infer<typeof getRestockRecommendationsSchema>;
export type SetReorderRuleInput = z.infer<typeof setReorderRuleSchema>;
export type GetProductForecastInput = z.infer<typeof getProductForecastSchema>;
export type AnalyzeSalesTrendInput = z.infer<typeof analyzeSalesTrendSchema>;
