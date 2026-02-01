/**
 * Time-Series Forecasting Utilities
 * Simple algorithms for stock prediction
 */

export interface SalesDataPoint {
  date: Date;
  quantity: number;
}

export interface ForecastResult {
  predictedRunoutDate: Date;
  suggestedReorderQuantity: number;
  confidence: number;
  dailyAverageSales: number;
  seasonalFactor: number;
}

/**
 * Calculate moving average of sales
 */
function calculateMovingAverage(data: SalesDataPoint[], windowSize: number = 7): number {
  if (data.length === 0) return 0;

  const recentData = data.slice(-windowSize);
  const sum = recentData.reduce((acc, point) => acc + point.quantity, 0);
  return sum / recentData.length;
}

/**
 * Calculate seasonal factor based on day of week
 * Returns multiplier (e.g., 1.2 = 20% higher on weekends)
 */
function calculateSeasonalFactor(data: SalesDataPoint[]): number {
  if (data.length < 14) return 1.0; // Need at least 2 weeks of data

  // Group by day of week
  const dayTotals: number[] = [0, 0, 0, 0, 0, 0, 0];
  const dayCounts: number[] = [0, 0, 0, 0, 0, 0, 0];

  data.forEach((point) => {
    const dayOfWeek = point.date.getDay();
    dayTotals[dayOfWeek] += point.quantity;
    dayCounts[dayOfWeek]++;
  });

  // Calculate average per day
  const dayAverages = dayTotals.map((total, i) =>
    dayCounts[i] > 0 ? total / dayCounts[i] : 0
  );

  // Overall average
  const overallAvg = dayAverages.reduce((sum, avg) => sum + avg, 0) / 7;

  // Today's day
  const today = new Date().getDay();
  const todayAvg = dayAverages[today];

  // Seasonal factor = today's average / overall average
  return overallAvg > 0 ? todayAvg / overallAvg : 1.0;
}

/**
 * Calculate confidence score based on data quality
 */
function calculateConfidence(data: SalesDataPoint[]): number {
  if (data.length === 0) return 0.1;
  if (data.length < 7) return 0.4;
  if (data.length < 30) return 0.6;

  // Calculate variance
  const avg = data.reduce((sum, p) => sum + p.quantity, 0) / data.length;
  const variance = data.reduce((sum, p) => sum + Math.pow(p.quantity - avg, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);

  // Lower variance = higher confidence
  const coefficientOfVariation = avg > 0 ? stdDev / avg : 1;

  // Map CV to confidence (0.0-1.0 CV maps to 0.95-0.6 confidence)
  const confidence = Math.max(0.6, Math.min(0.95, 0.95 - coefficientOfVariation * 0.35));

  return confidence;
}

/**
 * Detect trend (increasing, decreasing, stable)
 */
function detectTrend(data: SalesDataPoint[]): 'increasing' | 'decreasing' | 'stable' {
  if (data.length < 7) return 'stable';

  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));

  const firstAvg = firstHalf.reduce((sum, p) => sum + p.quantity, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, p) => sum + p.quantity, 0) / secondHalf.length;

  const change = (secondAvg - firstAvg) / firstAvg;

  if (change > 0.15) return 'increasing';
  if (change < -0.15) return 'decreasing';
  return 'stable';
}

/**
 * Main forecasting function
 * Predicts when stock will run out and suggests reorder quantity
 */
export function predictStockNeeds(
  salesHistory: SalesDataPoint[],
  currentStock: number,
  leadTimeDays: number = 7,
  safetyStockDays: number = 3
): ForecastResult {
  // Calculate base metrics
  const movingAvg = calculateMovingAverage(salesHistory, 7);
  const seasonalFactor = calculateSeasonalFactor(salesHistory);
  const confidence = calculateConfidence(salesHistory);
  const trend = detectTrend(salesHistory);

  // Adjust for trend
  let trendFactor = 1.0;
  if (trend === 'increasing') {
    trendFactor = 1.15; // Expect 15% increase
  } else if (trend === 'decreasing') {
    trendFactor = 0.85; // Expect 15% decrease
  }

  // Adjusted daily sales
  const adjustedDailySales = movingAvg * seasonalFactor * trendFactor;

  // Predict runout date
  const daysUntilStockout = adjustedDailySales > 0
    ? currentStock / adjustedDailySales
    : 9999; // Infinite if no sales

  const runoutDate = new Date();
  runoutDate.setDate(runoutDate.getDate() + Math.floor(daysUntilStockout));

  // Calculate reorder quantity
  // Formula: (lead time + safety stock) * daily sales
  const reorderDays = leadTimeDays + safetyStockDays;
  const suggestedReorderQuantity = Math.ceil(adjustedDailySales * reorderDays);

  return {
    predictedRunoutDate: runoutDate,
    suggestedReorderQuantity: Math.max(suggestedReorderQuantity, 10), // Minimum 10 units
    confidence,
    dailyAverageSales: adjustedDailySales,
    seasonalFactor,
  };
}

/**
 * Generate restock recommendations for multiple products
 */
export function generateRestockRecommendations(
  products: Array<{
    id: string;
    name: string;
    quantity: number;
    salesHistory: SalesDataPoint[];
    leadTimeDays?: number;
  }>
): Array<{
  productId: string;
  productName: string;
  currentStock: number;
  forecast: ForecastResult;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  shouldReorder: boolean;
}> {
  return products.map((product) => {
    const forecast = predictStockNeeds(
      product.salesHistory,
      product.quantity,
      product.leadTimeDays || 7
    );

    // Calculate urgency
    const daysUntilRunout = Math.floor(
      (forecast.predictedRunoutDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    let urgency: 'critical' | 'high' | 'medium' | 'low';
    if (daysUntilRunout <= 3) urgency = 'critical';
    else if (daysUntilRunout <= 7) urgency = 'high';
    else if (daysUntilRunout <= 14) urgency = 'medium';
    else urgency = 'low';

    const shouldReorder = daysUntilRunout <= (product.leadTimeDays || 7);

    return {
      productId: product.id,
      productName: product.name,
      currentStock: product.quantity,
      forecast,
      urgency,
      shouldReorder,
    };
  });
}

/**
 * Calculate Economic Order Quantity (EOQ)
 * Optimal order quantity to minimize total inventory costs
 */
export function calculateEOQ(
  annualDemand: number,
  orderCost: number,
  holdingCostPerUnit: number
): number {
  if (holdingCostPerUnit === 0) return annualDemand / 12; // Default to monthly

  // EOQ = sqrt((2 * D * S) / H)
  // D = annual demand, S = order cost, H = holding cost
  const eoq = Math.sqrt((2 * annualDemand * orderCost) / holdingCostPerUnit);

  return Math.ceil(eoq);
}
