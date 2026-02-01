/**
 * GST (Goods and Services Tax) calculation utilities for India
 */

// Common GST rates in India
export const GST_RATES = {
  EXEMPT: 0,
  LOW: 5,
  STANDARD: 12,
  HIGHER: 18,
  LUXURY: 28,
} as const;

// GST rate slabs by category (simplified)
export const GST_CATEGORIES: Record<string, number> = {
  // Exempt items
  'fresh_vegetables': 0,
  'fresh_fruits': 0,
  'milk': 0,
  'eggs': 0,
  'bread': 0,
  'salt': 0,

  // 5% GST
  'rice': 5,
  'wheat': 5,
  'sugar': 5,
  'tea': 5,
  'coffee': 5,
  'spices': 5,
  'edible_oil': 5,
  'medicines': 5,
  'footwear_below_1000': 5,

  // 12% GST
  'processed_food': 12,
  'fruit_juice': 12,
  'butter': 12,
  'cheese': 12,
  'ghee': 12,
  'notebooks': 12,
  'apparel_1000_to_1000': 12,

  // 18% GST
  'packaged_food': 18,
  'biscuits': 18,
  'namkeen': 18,
  'beverages': 18,
  'electronics': 18,
  'stationery': 18,
  'soaps': 18,
  'detergent': 18,
  'cosmetics': 18,
  'services': 18,

  // 28% GST
  'aerated_drinks': 28,
  'tobacco': 28,
  'luxury_items': 28,
  'automobiles': 28,
  'ac': 28,
  'refrigerator': 28,
};

export interface GSTCalculation {
  base_amount: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_gst: number;
  total_with_gst: number;
  is_interstate: boolean;
}

/**
 * Calculate GST for a given amount
 * @param baseAmount - Amount before GST
 * @param gstRate - GST rate (e.g., 18 for 18%)
 * @param isInterstate - Whether the transaction is between different states
 */
export function calculateGST(
  baseAmount: number,
  gstRate: number,
  isInterstate: boolean = false
): GSTCalculation {
  const totalGst = (baseAmount * gstRate) / 100;

  if (isInterstate) {
    // Interstate: IGST applies
    return {
      base_amount: baseAmount,
      cgst_rate: 0,
      sgst_rate: 0,
      igst_rate: gstRate,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: totalGst,
      total_gst: totalGst,
      total_with_gst: baseAmount + totalGst,
      is_interstate: true,
    };
  } else {
    // Intrastate: CGST + SGST (split equally)
    const halfGst = totalGst / 2;
    const halfRate = gstRate / 2;
    return {
      base_amount: baseAmount,
      cgst_rate: halfRate,
      sgst_rate: halfRate,
      igst_rate: 0,
      cgst_amount: halfGst,
      sgst_amount: halfGst,
      igst_amount: 0,
      total_gst: totalGst,
      total_with_gst: baseAmount + totalGst,
      is_interstate: false,
    };
  }
}

/**
 * Reverse calculate base amount from total (inclusive of GST)
 */
export function calculateBaseFromGSTInclusive(
  totalAmount: number,
  gstRate: number
): { base_amount: number; gst_amount: number } {
  const baseAmount = (totalAmount * 100) / (100 + gstRate);
  const gstAmount = totalAmount - baseAmount;

  return {
    base_amount: Math.round(baseAmount * 100) / 100,
    gst_amount: Math.round(gstAmount * 100) / 100,
  };
}

/**
 * Get suggested GST rate for a product category
 */
export function suggestGSTRate(category: string): number {
  const normalizedCategory = category.toLowerCase().replace(/\s+/g, '_');

  // Check for exact match
  if (GST_CATEGORIES[normalizedCategory] !== undefined) {
    return GST_CATEGORIES[normalizedCategory];
  }

  // Check for partial match
  for (const [key, rate] of Object.entries(GST_CATEGORIES)) {
    if (normalizedCategory.includes(key) || key.includes(normalizedCategory)) {
      return rate;
    }
  }

  // Default to 18% for most goods
  return 18;
}

/**
 * Validate GSTIN (GST Identification Number) format
 * Format: 2 digit state code + 10 digit PAN + 1 digit entity code + Z + 1 check digit
 */
export function isValidGSTIN(gstin: string): boolean {
  if (!gstin || gstin.length !== 15) {
    return false;
  }

  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin.toUpperCase());
}

/**
 * Extract PAN from GSTIN
 */
export function extractPANFromGSTIN(gstin: string): string | null {
  if (!isValidGSTIN(gstin)) {
    return null;
  }
  return gstin.substring(2, 12);
}

/**
 * Get state name from GSTIN state code
 */
export function getStateFromGSTIN(gstin: string): string | null {
  if (!isValidGSTIN(gstin)) {
    return null;
  }

  const stateCode = gstin.substring(0, 2);
  return INDIAN_STATES[stateCode] || null;
}

// Indian state codes for GST
export const INDIAN_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh',
};

/**
 * Calculate GST for multiple items
 */
export function calculateMultipleItemsGST(
  items: Array<{
    amount: number;
    gst_rate: number;
    quantity: number;
  }>,
  isInterstate: boolean = false
): {
  items: Array<GSTCalculation & { quantity: number }>;
  summary: {
    total_base: number;
    total_cgst: number;
    total_sgst: number;
    total_igst: number;
    total_gst: number;
    grand_total: number;
  };
} {
  const calculatedItems = items.map(item => {
    const totalAmount = item.amount * item.quantity;
    const calc = calculateGST(totalAmount, item.gst_rate, isInterstate);
    return { ...calc, quantity: item.quantity };
  });

  const summary = {
    total_base: calculatedItems.reduce((sum, item) => sum + item.base_amount, 0),
    total_cgst: calculatedItems.reduce((sum, item) => sum + item.cgst_amount, 0),
    total_sgst: calculatedItems.reduce((sum, item) => sum + item.sgst_amount, 0),
    total_igst: calculatedItems.reduce((sum, item) => sum + item.igst_amount, 0),
    total_gst: calculatedItems.reduce((sum, item) => sum + item.total_gst, 0),
    grand_total: calculatedItems.reduce((sum, item) => sum + item.total_with_gst, 0),
  };

  return { items: calculatedItems, summary };
}

/**
 * Format GST breakdown for display
 */
export function formatGSTBreakdown(calculation: GSTCalculation): string {
  const lines: string[] = [];
  lines.push(`Base Amount: ₹${calculation.base_amount.toFixed(2)}`);

  if (calculation.is_interstate) {
    lines.push(`IGST (${calculation.igst_rate}%): ₹${calculation.igst_amount.toFixed(2)}`);
  } else {
    lines.push(`CGST (${calculation.cgst_rate}%): ₹${calculation.cgst_amount.toFixed(2)}`);
    lines.push(`SGST (${calculation.sgst_rate}%): ₹${calculation.sgst_amount.toFixed(2)}`);
  }

  lines.push(`Total GST: ₹${calculation.total_gst.toFixed(2)}`);
  lines.push(`Total Amount: ₹${calculation.total_with_gst.toFixed(2)}`);

  return lines.join('\n');
}
