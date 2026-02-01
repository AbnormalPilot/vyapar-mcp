import { SupabaseClient } from '@supabase/supabase-js';
import { predictStockNeeds, generateRestockRecommendations, SalesDataPoint } from '../utils/time-series.js';

export interface StockForecast {
  product_id: string;
  product_name: string;
  current_stock: number;
  predicted_runout_date: string;
  days_until_runout: number;
  suggested_reorder_quantity: number;
  confidence: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  should_reorder: boolean;
}

export class ForecastingService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get sales history for a product
   */
  private async getSalesHistory(userId: string, productId: string, days: number = 30): Promise<SalesDataPoint[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Try to use pre-aggregated daily sales first
    const { data: aggregated } = await this.supabase
      .from('sales_history_daily')
      .select('date, quantity_sold')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (aggregated && aggregated.length > 0) {
      return aggregated.map((row) => ({
        date: new Date(row.date),
        quantity: row.quantity_sold,
      }));
    }

    // Fallback: Calculate from invoices
    const { data: invoiceItems } = await this.supabase
      .from('invoice_items')
      .select(`
        quantity,
        invoices!inner(created_at, status, user_id)
      `)
      .eq('product_id', productId)
      .eq('invoices.user_id', userId)
      .eq('invoices.status', 'paid')
      .gte('invoices.created_at', startDate.toISOString());

    // Group by date
    const dailyMap = new Map<string, number>();

    (invoiceItems || []).forEach((item: any) => {
      const date = new Date(item.invoices.created_at).toISOString().split('T')[0];
      dailyMap.set(date, (dailyMap.get(date) || 0) + item.quantity);
    });

    return Array.from(dailyMap.entries()).map(([dateStr, quantity]) => ({
      date: new Date(dateStr),
      quantity,
    }));
  }

  /**
   * Predict stock needs for a single product
   */
  async predictSingleProduct(
    userId: string,
    productId: string,
    daysAhead: number = 30
  ): Promise<StockForecast> {
    // Get product info
    const { data: product, error: productError } = await this.supabase
      .from('products')
      .select('id, name, quantity')
      .eq('id', productId)
      .eq('user_id', userId)
      .single();

    if (productError || !product) {
      throw new Error('Product not found');
    }

    // Get sales history
    const salesHistory = await this.getSalesHistory(userId, productId, 30);

    // Get reorder rule if exists
    const { data: reorderRule } = await this.supabase
      .from('reorder_rules')
      .select('lead_time_days, safety_stock')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .single();

    const leadTimeDays = reorderRule?.lead_time_days || 7;
    const safetyStockDays = reorderRule?.safety_stock ? Math.ceil(reorderRule.safety_stock / 10) : 3;

    // Run prediction
    const forecast = predictStockNeeds(
      salesHistory,
      product.quantity,
      leadTimeDays,
      safetyStockDays
    );

    // Calculate days until runout
    const daysUntilRunout = Math.max(
      0,
      Math.floor((forecast.predictedRunoutDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );

    // Determine urgency
    let urgency: 'critical' | 'high' | 'medium' | 'low';
    if (daysUntilRunout <= 3) urgency = 'critical';
    else if (daysUntilRunout <= 7) urgency = 'high';
    else if (daysUntilRunout <= 14) urgency = 'medium';
    else urgency = 'low';

    return {
      product_id: product.id,
      product_name: product.name,
      current_stock: product.quantity,
      predicted_runout_date: forecast.predictedRunoutDate.toISOString(),
      days_until_runout: daysUntilRunout,
      suggested_reorder_quantity: forecast.suggestedReorderQuantity,
      confidence: forecast.confidence,
      urgency,
      should_reorder: daysUntilRunout <= leadTimeDays,
    };
  }

  /**
   * Get restock recommendations for all low stock items
   */
  async getRestockRecommendations(
    userId: string,
    options: {
      includeAllProducts?: boolean;
      onlyLowStock?: boolean;
      timePeriod?: 'week' | 'month';
    } = {}
  ): Promise<StockForecast[]> {
    const timePeriod = options.timePeriod || 'week';
    const daysAhead = timePeriod === 'week' ? 7 : 30;

    // Fetch products
    const query = this.supabase
      .from('products')
      .select('id, name, quantity, low_stock_threshold')
      .eq('user_id', userId);

    const { data: allProducts, error } = await query;

    if (error) throw new Error(`Failed to fetch products: ${error.message}`);

    // Filter for low stock if requested
    const products = options.onlyLowStock
      ? (allProducts || []).filter(p => p.quantity <= p.low_stock_threshold)
      : allProducts;

    if (!products || products.length === 0) {
      return [];
    }

    // Get forecasts for each product
    const forecasts: StockForecast[] = [];

    for (const product of products) {
      try {
        const forecast = await this.predictSingleProduct(userId, product.id, daysAhead);
        forecasts.push(forecast);
      } catch (error) {
        console.error(`Failed to forecast ${product.name}:`, error);
        // Continue with other products
      }
    }

    // Sort by urgency
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    forecasts.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return forecasts;
  }

  /**
   * Save forecast to database
   */
  async saveForecast(userId: string, forecast: StockForecast): Promise<void> {
    await this.supabase
      .from('stock_predictions')
      .insert({
        user_id: userId,
        product_id: forecast.product_id,
        predicted_date: forecast.predicted_runout_date,
        predicted_quantity: forecast.suggested_reorder_quantity,
        confidence_score: forecast.confidence,
        factors: {
          urgency: forecast.urgency,
          days_until_runout: forecast.days_until_runout,
        },
      });
  }

  /**
   * Create or update reorder rule
   */
  async setReorderRule(
    userId: string,
    productId: string,
    rule: {
      auto_reorder?: boolean;
      reorder_point?: number;
      reorder_quantity?: number;
      preferred_supplier_id?: string;
      lead_time_days?: number;
      safety_stock?: number;
    }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('reorder_rules')
      .upsert({
        user_id: userId,
        product_id: productId,
        ...rule,
      });

    if (error) throw new Error(`Failed to set reorder rule: ${error.message}`);
  }

  /**
   * Aggregate daily sales (should be run as a cron job)
   */
  async aggregateDailySales(): Promise<void> {
    const { error } = await this.supabase.rpc('aggregate_daily_sales');

    if (error) throw new Error(`Failed to aggregate sales: ${error.message}`);
  }
}
