import { SupabaseClient } from '@supabase/supabase-js';
import type {
  AnalyzeProfitMarginsInput,
  ForecastInventoryInput,
  GetCustomerInsightsInput,
  GetInventoryAlertsNewInput,
  GetPendingPaymentsInput,
  QuickBusinessSnapshotInput,
  SuggestReorderInput,
} from '../tools/msme-productivity.js';

/**
 * MSME Productivity Service
 * Provides business intelligence and productivity tools for MSME owners
 */
export class MSMEProductivityService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Forecast inventory needs based on sales velocity
   */
  async forecastInventory(input: ForecastInventoryInput) {
    const { user_id, product_id, days_ahead = 30, include_seasonal = true } = input;

    // Get sales data for the last 90 days to calculate trends
    const lookbackDays = 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);

    // Query sales data from invoice_items joined with invoices
    const { data: salesData, error: salesError } = await this.supabase
      .from('invoice_items')
      .select(`
        product_id,
        quantity,
        products!inner(name, hindi_name, unit, quantity as current_stock, low_stock_threshold),
        invoices!inner(created_at, status)
      `)
      .eq('invoices.user_id', user_id)
      .gte('invoices.created_at', startDate.toISOString())
      .in('invoices.status', ['paid', 'partial'])
      .order('invoices.created_at', { ascending: true });

    if (salesError) throw salesError;

    // Group by product and calculate daily average sales
    const productSales = new Map<string, {
      name: string;
      hindi_name: string;
      unit: string;
      current_stock: number;
      low_stock_threshold: number;
      total_quantity: number;
      days_with_sales: number;
    }>();

    salesData?.forEach((item: any) => {
      const pid = item.product_id;
      if (product_id && pid !== product_id) return;

      if (!productSales.has(pid)) {
        productSales.set(pid, {
          name: item.products.name,
          hindi_name: item.products.hindi_name,
          unit: item.products.unit,
          current_stock: item.products.quantity || 0,
          low_stock_threshold: item.products.low_stock_threshold || 10,
          total_quantity: 0,
          days_with_sales: 0,
        });
      }

      const product = productSales.get(pid)!;
      product.total_quantity += item.quantity;
      product.days_with_sales += 1;
    });

    // Calculate forecast for each product
    const forecasts = Array.from(productSales.entries()).map(([product_id, data]) => {
      const avgDailySales = data.total_quantity / lookbackDays;
      const projected_usage = avgDailySales * days_ahead;
      const days_until_stockout = data.current_stock / (avgDailySales || 1);
      const recommended_reorder = Math.max(0, projected_usage - data.current_stock + data.low_stock_threshold);

      // Seasonal factor (simple: increase by 20% if including seasonal)
      const seasonal_factor = include_seasonal ? 1.2 : 1.0;
      const seasonal_projected_usage = projected_usage * seasonal_factor;
      const seasonal_recommended_reorder = recommended_reorder * seasonal_factor;

      return {
        product_id,
        name: data.name,
        hindi_name: data.hindi_name,
        unit: data.unit,
        current_stock: data.current_stock,
        avg_daily_sales: Math.round(avgDailySales * 100) / 100,
        projected_usage_next_period: Math.ceil(include_seasonal ? seasonal_projected_usage : projected_usage),
        days_until_stockout: Math.round(days_until_stockout),
        recommended_reorder_quantity: Math.ceil(include_seasonal ? seasonal_recommended_reorder : recommended_reorder),
        urgency: days_until_stockout < 7 ? 'critical' : days_until_stockout < 14 ? 'high' : 'medium',
        trend: data.days_with_sales > 10 ? 'active' : 'slow',
      };
    });

    // Sort by urgency
    forecasts.sort((a, b) => a.days_until_stockout - b.days_until_stockout);

    return {
      forecast_period_days: days_ahead,
      include_seasonal,
      total_products: forecasts.length,
      forecasts,
      summary: {
        critical_items: forecasts.filter(f => f.urgency === 'critical').length,
        high_priority_items: forecasts.filter(f => f.urgency === 'high').length,
      },
    };
  }

  /**
   * Get inventory alerts with actionable insights
   */
  async getInventoryAlerts(input: GetInventoryAlertsNewInput) {
    const { user_id, alert_type = 'all' } = input;

    // Get all products with current stock
    const { data: products, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('user_id', user_id)
      .order('quantity', { ascending: true });

    if (error) throw error;

    const alerts: any[] = [];

    products?.forEach((product: any) => {
      const threshold = product.low_stock_threshold || 10;
      const stock = product.quantity || 0;

      // Out of stock
      if (stock === 0 && ['out_of_stock', 'all'].includes(alert_type)) {
        alerts.push({
          type: 'out_of_stock',
          severity: 'critical',
          product_id: product.id,
          name: product.name,
          hindi_name: product.hindi_name,
          unit: product.unit,
          current_stock: stock,
          threshold,
          message: `${product.name} is out of stock! Reorder immediately.`,
        });
      }
      // Low stock
      else if (stock > 0 && stock <= threshold && ['low_stock', 'all'].includes(alert_type)) {
        alerts.push({
          type: 'low_stock',
          severity: stock <= threshold / 2 ? 'high' : 'medium',
          product_id: product.id,
          name: product.name,
          hindi_name: product.hindi_name,
          unit: product.unit,
          current_stock: stock,
          threshold,
          message: `${product.name} is running low (${stock} ${product.unit} left). Consider reordering.`,
        });
      }
      // Overstock (assuming overstock is 10x threshold)
      else if (stock > threshold * 10 && ['overstock', 'all'].includes(alert_type)) {
        alerts.push({
          type: 'overstock',
          severity: 'low',
          product_id: product.id,
          name: product.name,
          hindi_name: product.hindi_name,
          unit: product.unit,
          current_stock: stock,
          threshold,
          message: `${product.name} has excess stock (${stock} ${product.unit}). Consider promotion or discount.`,
        });
      }
      // Reorder now (critical + high priority low stock)
      else if (stock <= threshold && stock > 0 && ['reorder_now', 'all'].includes(alert_type)) {
        if (stock <= threshold / 2) {
          alerts.push({
            type: 'reorder_now',
            severity: 'critical',
            product_id: product.id,
            name: product.name,
            hindi_name: product.hindi_name,
            unit: product.unit,
            current_stock: stock,
            threshold,
            recommended_order_quantity: threshold * 3,
            message: `Reorder ${product.name} NOW! Stock critically low.`,
          });
        }
      }
    });

    return {
      total_alerts: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      alerts,
    };
  }

  /**
   * Analyze profit margins by product/category/overall
   */
  async analyzeProfitMargins(input: AnalyzeProfitMarginsInput) {
    const { user_id, group_by = 'overall', time_period = 'month' } = input;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (time_period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    // Get invoice items with product details
    const { data: salesData, error } = await this.supabase
      .from('invoice_items')
      .select(`
        product_id,
        name,
        quantity,
        unit_price,
        discount,
        gst_rate,
        products!inner(cost_price, category, name as product_name, hindi_name),
        invoices!inner(created_at, status)
      `)
      .eq('invoices.user_id', user_id)
      .gte('invoices.created_at', startDate.toISOString())
      .in('invoices.status', ['paid', 'partial']);

    if (error) throw error;

    // Calculate margins
    const margins: any = { items: [] };
    const grouped = new Map<string, {
      total_revenue: number;
      total_cost: number;
      total_profit: number;
      quantity_sold: number;
      name: string;
      category?: string;
    }>();

    salesData?.forEach((item: any) => {
      const revenue = item.unit_price * item.quantity * (1 - item.discount / 100);
      const cost = (item.products?.cost_price || item.unit_price * 0.7) * item.quantity;
      const profit = revenue - cost;
      const margin_percent = revenue > 0 ? (profit / revenue) * 100 : 0;

      let groupKey: string;
      let groupName: string;
      let category: string | undefined;

      switch (group_by) {
        case 'product':
          groupKey = item.product_id || item.name;
          groupName = item.products?.product_name || item.name;
          category = item.products?.category;
          break;
        case 'category':
          groupKey = item.products?.category || 'Uncategorized';
          groupName = groupKey;
          category = groupKey;
          break;
        default: // overall
          groupKey = 'overall';
          groupName = 'Overall Business';
          break;
      }

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          name: groupName,
          category,
          total_revenue: 0,
          total_cost: 0,
          total_profit: 0,
          quantity_sold: 0,
        });
      }

      const group = grouped.get(groupKey)!;
      group.total_revenue += revenue;
      group.total_cost += cost;
      group.total_profit += profit;
      group.quantity_sold += item.quantity;
    });

    // Format results
    margins.items = Array.from(grouped.entries()).map(([key, data]) => ({
      id: key,
      name: data.name,
      category: data.category,
      total_revenue: Math.round(data.total_revenue),
      total_cost: Math.round(data.total_cost),
      total_profit: Math.round(data.total_profit),
      profit_margin_percent: data.total_revenue > 0
        ? Math.round((data.total_profit / data.total_revenue) * 100 * 100) / 100
        : 0,
      quantity_sold: data.quantity_sold,
    }));

    // Sort by profit margin descending
    margins.items.sort((a: any, b: any) => b.profit_margin_percent - a.profit_margin_percent);

    // Calculate overall summary
    const totalRevenue = margins.items.reduce((sum: number, item: any) => sum + item.total_revenue, 0);
    const totalCost = margins.items.reduce((sum: number, item: any) => sum + item.total_cost, 0);
    const totalProfit = totalRevenue - totalCost;

    margins.summary = {
      time_period,
      group_by,
      total_revenue: Math.round(totalRevenue),
      total_cost: Math.round(totalCost),
      total_profit: Math.round(totalProfit),
      overall_margin_percent: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100 * 100) / 100 : 0,
      best_performing: margins.items[0] || null,
      worst_performing: margins.items[margins.items.length - 1] || null,
    };

    return margins;
  }

  /**
   * Get pending and overdue payments
   */
  async getPendingPayments(input: GetPendingPaymentsInput) {
    const { user_id, status = 'all', sort_by = 'date' } = input;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get invoices that are not fully paid
    const { data: invoices, error } = await this.supabase
      .from('invoices')
      .select(`
        *,
        vyapar_customers!inner(name, phone, email)
      `)
      .eq('user_id', user_id)
      .in('status', ['sent', 'partial', 'overdue'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    const payments: any[] = [];

    invoices?.forEach((invoice: any) => {
      const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
      const isOverdue = dueDate && dueDate < today;
      const daysPastDue = dueDate ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

      const paymentStatus = isOverdue ? 'overdue' : 'pending';

      if (status === 'all' || status === paymentStatus) {
        payments.push({
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          customer_name: invoice.vyapar_customers?.name || 'Unknown',
          customer_phone: invoice.vyapar_customers?.phone,
          amount_due: invoice.total_amount - (invoice.amount_paid || 0),
          total_amount: invoice.total_amount,
          amount_paid: invoice.amount_paid || 0,
          due_date: invoice.due_date,
          invoice_date: invoice.created_at,
          status: paymentStatus,
          days_past_due: isOverdue ? daysPastDue : 0,
          urgency: isOverdue && daysPastDue > 30 ? 'critical' : isOverdue ? 'high' : 'medium',
        });
      }
    });

    // Sort results
    switch (sort_by) {
      case 'amount':
        payments.sort((a, b) => b.amount_due - a.amount_due);
        break;
      case 'customer':
        payments.sort((a, b) => a.customer_name.localeCompare(b.customer_name));
        break;
      default: // date
        payments.sort((a, b) => {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        });
    }

    const totalDue = payments.reduce((sum, p) => sum + p.amount_due, 0);

    return {
      total_pending_amount: Math.round(totalDue),
      total_invoices: payments.length,
      overdue_count: payments.filter(p => p.status === 'overdue').length,
      pending_count: payments.filter(p => p.status === 'pending').length,
      critical_count: payments.filter(p => p.urgency === 'critical').length,
      payments,
    };
  }

  /**
   * Get customer insights
   */
  async getCustomerInsights(input: GetCustomerInsightsInput) {
    const { user_id, metric = 'all', limit = 10 } = input;

    const insights: any = {};

    // Get customer sales data
    const { data: invoices, error } = await this.supabase
      .from('invoices')
      .select(`
        customer_id,
        total_amount,
        created_at,
        vyapar_customers!inner(name, phone)
      `)
      .eq('user_id', user_id)
      .in('status', ['paid', 'partial']);

    if (error) throw error;

    // Group by customer
    const customerData = new Map<string, {
      name: string;
      phone: string;
      total_spent: number;
      invoice_count: number;
      last_purchase_date: Date;
      first_purchase_date: Date;
    }>();

    invoices?.forEach((invoice: any) => {
      const customerId = invoice.customer_id || 'walk-in';
      const customerName = invoice.vyapar_customers?.name || 'Walk-in Customer';
      const phone = invoice.vyapar_customers?.phone || '';
      const purchaseDate = new Date(invoice.created_at);

      if (!customerData.has(customerId)) {
        customerData.set(customerId, {
          name: customerName,
          phone,
          total_spent: 0,
          invoice_count: 0,
          last_purchase_date: purchaseDate,
          first_purchase_date: purchaseDate,
        });
      }

      const customer = customerData.get(customerId)!;
      customer.total_spent += invoice.total_amount;
      customer.invoice_count += 1;
      if (purchaseDate > customer.last_purchase_date) {
        customer.last_purchase_date = purchaseDate;
      }
      if (purchaseDate < customer.first_purchase_date) {
        customer.first_purchase_date = purchaseDate;
      }
    });

    // Top customers
    if (metric === 'top_customers' || metric === 'all') {
      const topCustomers = Array.from(customerData.entries())
        .map(([id, data]) => ({
          customer_id: id,
          name: data.name,
          phone: data.phone,
          total_spent: Math.round(data.total_spent),
          invoice_count: data.invoice_count,
          last_purchase: data.last_purchase_date.toISOString().split('T')[0],
        }))
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, limit);

      insights.top_customers = topCustomers;
    }

    // Purchase frequency
    if (metric === 'purchase_frequency' || metric === 'all') {
      const frequency = Array.from(customerData.entries())
        .map(([id, data]) => {
          const daysSinceFirst = Math.floor(
            (Date.now() - data.first_purchase_date.getTime()) / (1000 * 60 * 60 * 24)
          );
          const avgDaysBetweenPurchases = daysSinceFirst / data.invoice_count;

          return {
            customer_id: id,
            name: data.name,
            phone: data.phone,
            total_purchases: data.invoice_count,
            days_since_first_purchase: daysSinceFirst,
            avg_days_between_purchases: Math.round(avgDaysBetweenPurchases),
            purchase_frequency: avgDaysBetweenPurchases < 30 ? 'high' : avgDaysBetweenPurchases < 90 ? 'medium' : 'low',
          };
        })
        .sort((a, b) => b.total_purchases - a.total_purchases)
        .slice(0, limit);

      insights.purchase_frequency = frequency;
    }

    // Average order value
    if (metric === 'average_order_value' || metric === 'all') {
      const aov = Array.from(customerData.entries())
        .map(([id, data]) => ({
          customer_id: id,
          name: data.name,
          phone: data.phone,
          total_spent: Math.round(data.total_spent),
          invoice_count: data.invoice_count,
          average_order_value: Math.round(data.total_spent / data.invoice_count),
        }))
        .sort((a, b) => b.average_order_value - a.average_order_value)
        .slice(0, limit);

      insights.average_order_value = aov;
    }

    return insights;
  }

  /**
   * Quick business snapshot for busy MSME owners
   */
  async quickBusinessSnapshot(input: QuickBusinessSnapshotInput) {
    const { user_id } = input;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Today's sales
    const { data: todaySales } = await this.supabase
      .from('invoices')
      .select('total_amount')
      .eq('user_id', user_id)
      .gte('created_at', today.toISOString())
      .in('status', ['paid', 'partial']);

    const todayRevenue = todaySales?.reduce((sum, inv: any) => sum + inv.total_amount, 0) || 0;

    // Yesterday's sales
    const { data: yesterdaySales } = await this.supabase
      .from('invoices')
      .select('total_amount')
      .eq('user_id', user_id)
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString())
      .in('status', ['paid', 'partial']);

    const yesterdayRevenue = yesterdaySales?.reduce((sum, inv: any) => sum + inv.total_amount, 0) || 0;

    // This week's sales
    const { data: weekSales } = await this.supabase
      .from('invoices')
      .select('total_amount')
      .eq('user_id', user_id)
      .gte('created_at', weekAgo.toISOString())
      .in('status', ['paid', 'partial']);

    const weekRevenue = weekSales?.reduce((sum, inv: any) => sum + inv.total_amount, 0) || 0;

    // Inventory alerts
    const alertsResult = await this.getInventoryAlerts({ user_id, alert_type: 'all' });

    // Pending payments
    const paymentsResult = await this.getPendingPayments({ user_id, status: 'all', sort_by: 'date' });

    // Calculate changes
    const todayVsYesterday = yesterdayRevenue > 0
      ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
      : 0;

    return {
      date: today.toISOString().split('T')[0],
      sales: {
        today: Math.round(todayRevenue),
        yesterday: Math.round(yesterdayRevenue),
        change_percent: todayVsYesterday,
        this_week: Math.round(weekRevenue),
        trend: todayVsYesterday > 0 ? 'up' : todayVsYesterday < 0 ? 'down' : 'stable',
      },
      inventory: {
        critical_alerts: alertsResult.critical,
        total_alerts: alertsResult.total_alerts,
        out_of_stock: alertsResult.alerts.filter((a: any) => a.type === 'out_of_stock').length,
      },
      payments: {
        total_pending: paymentsResult.total_pending_amount,
        overdue_count: paymentsResult.overdue_count,
        critical_count: paymentsResult.critical_count,
      },
      quick_actions: this.generateQuickActions(todayVsYesterday, alertsResult, paymentsResult),
    };
  }

  /**
   * Smart reorder suggestions
   */
  async suggestReorder(input: SuggestReorderInput) {
    const { user_id, urgency = 'all' } = input;

    // Get forecast data
    const forecast = await this.forecastInventory({ user_id, days_ahead: 14, include_seasonal: true });

    // Filter and enhance with reorder suggestions
    let suggestions = forecast.forecasts
      .filter((item: any) => {
        if (urgency === 'all') return item.recommended_reorder_quantity > 0;
        if (urgency === 'critical') return item.urgency === 'critical';
        if (urgency === 'soon') return item.urgency === 'high';
        if (urgency === 'plan_ahead') return item.urgency === 'medium';
        return false;
      })
      .map((item: any) => ({
        product_id: item.product_id,
        name: item.name,
        hindi_name: item.hindi_name,
        current_stock: item.current_stock,
        unit: item.unit,
        days_until_stockout: item.days_until_stockout,
        suggested_order_quantity: item.recommended_reorder_quantity,
        urgency: item.urgency,
        reason: this.getReorderReason(item),
        estimated_cost_if_cost_price_known: null, // Would need product cost_price
      }));

    return {
      total_suggestions: suggestions.length,
      critical: suggestions.filter((s: any) => s.urgency === 'critical').length,
      high: suggestions.filter((s: any) => s.urgency === 'high').length,
      medium: suggestions.filter((s: any) => s.urgency === 'medium').length,
      suggestions,
    };
  }

  private generateQuickActions(salesTrend: number, alerts: any, payments: any): string[] {
    const actions: string[] = [];

    if (salesTrend > 10) {
      actions.push('🎉 Great sales day! Keep the momentum going.');
    } else if (salesTrend < -10) {
      actions.push('📉 Sales down today. Consider running a promotion.');
    }

    if (alerts.critical > 0) {
      actions.push(`⚠️ ${alerts.critical} products critically low. Reorder now!`);
    }

    if (payments.critical_count > 0) {
      actions.push(`💰 ${payments.critical_count} overdue payments need immediate follow-up.`);
    }

    if (actions.length === 0) {
      actions.push('✅ Everything looks good! Focus on growing your business.');
    }

    return actions;
  }

  private getReorderReason(item: any): string {
    if (item.days_until_stockout < 3) {
      return `Critical! Stock will run out in ${item.days_until_stockout} days.`;
    } else if (item.days_until_stockout < 7) {
      return `Low stock. Reorder this week to avoid stockout.`;
    } else if (item.days_until_stockout < 14) {
      return `Plan ahead. Reorder in next 2 weeks.`;
    }
    return 'Maintain optimal stock levels.';
  }
}
