import { z } from 'zod';

// ============================================
// MSME PRODUCTIVITY & BUSINESS INTELLIGENCE TOOLS
// ============================================

/**
 * Forecast inventory needs based on sales history with seasonal trends
 * Helps MSME owners plan restocking and avoid stockouts
 */
export const forecastInventorySchema = z.object({
  user_id: z.string().describe('The user ID'),
  product_id: z.string().optional().describe('Product ID to forecast (optional - if not provided, forecasts all products)'),
  days_ahead: z.number().default(30).describe('Number of days to forecast (default: 30)'),
  include_seasonal: z.boolean().default(true).describe('Include seasonal trends in forecast'),
});

/**
 * Get critical inventory alerts with actionable insights
 * Returns: low stock, out of stock, overstock, reorder suggestions
 */
export const getInventoryAlertsNewSchema = z.object({
  user_id: z.string().describe('The user ID'),
  alert_type: z.enum(['low_stock', 'out_of_stock', 'overstock', 'reorder_now', 'all']).default('all').describe('Type of alerts to retrieve'),
});

/**
 * Analyze profit margins to identify most profitable items
 * Helps MSME owners focus on high-margin products
 */
export const analyzeProfitMarginsSchema = z.object({
  user_id: z.string().describe('The user ID'),
  group_by: z.enum(['product', 'category', 'overall']).default('overall').describe('How to group the analysis'),
  time_period: z.enum(['today', 'week', 'month', 'year']).default('month').describe('Time period for analysis'),
});

/**
 * Get pending and overdue payments for cash flow management
 * Critical for MSME cash flow tracking
 */
export const getPendingPaymentsSchema = z.object({
  user_id: z.string().describe('The user ID'),
  status: z.enum(['pending', 'overdue', 'all']).default('all').describe('Payment status to filter'),
  sort_by: z.enum(['amount', 'date', 'customer']).default('date').describe('Sort results by'),
});

/**
 * Get customer behavior insights
 * Returns: top customers, purchase frequency, average order value
 */
export const getCustomerInsightsSchema = z.object({
  user_id: z.string().describe('The user ID'),
  metric: z.enum(['top_customers', 'purchase_frequency', 'average_order_value', 'all']).default('all').describe('Which customer metric to analyze'),
  limit: z.number().default(10).describe('Number of results to return'),
});

/**
 * Quick business health snapshot for busy MSME owners
 * Returns: today vs yesterday, week trend, critical alerts, quick wins
 */
export const quickBusinessSnapshotSchema = z.object({
  user_id: z.string().describe('The user ID'),
});

/**
 * Smart reorder suggestions based on sales velocity and lead time
 * Prioritized by urgency (critical/soon/plan_ahead)
 */
export const suggestReorderSchema = z.object({
  user_id: z.string().describe('The user ID'),
  urgency: z.enum(['critical', 'soon', 'plan_ahead', 'all']).default('all').describe('Urgency level for reorder suggestions'),
});

// Type exports
export type ForecastInventoryInput = z.infer<typeof forecastInventorySchema>;
export type GetInventoryAlertsNewInput = z.infer<typeof getInventoryAlertsNewSchema>;
export type AnalyzeProfitMarginsInput = z.infer<typeof analyzeProfitMarginsSchema>;
export type GetPendingPaymentsInput = z.infer<typeof getPendingPaymentsSchema>;
export type GetCustomerInsightsInput = z.infer<typeof getCustomerInsightsSchema>;
export type QuickBusinessSnapshotInput = z.infer<typeof quickBusinessSnapshotSchema>;
export type SuggestReorderInput = z.infer<typeof suggestReorderSchema>;
