import type { WhatsAppMessage } from '../types/index.js';

/**
 * Generate WhatsApp deep link for sending a message
 * This creates a link that will open WhatsApp with the pre-filled message
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  // Clean phone number - remove spaces, dashes, and ensure country code
  let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

  // Add India country code if not present
  if (!cleanPhone.startsWith('+')) {
    if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1);
    }
    if (!cleanPhone.startsWith('91') && cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
  } else {
    cleanPhone = cleanPhone.substring(1); // Remove the + for WhatsApp API
  }

  // URL encode the message
  const encodedMessage = encodeURIComponent(message);

  // Return WhatsApp deep link
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

/**
 * Generate WhatsApp API URL for sharing (mobile app intent)
 * This format is better for mobile apps
 */
export function generateWhatsAppIntent(phone: string, message: string): string {
  let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

  if (!cleanPhone.startsWith('+')) {
    if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1);
    }
    if (!cleanPhone.startsWith('91') && cleanPhone.length === 10) {
      cleanPhone = '+91' + cleanPhone;
    } else {
      cleanPhone = '+' + cleanPhone;
    }
  }

  const encodedMessage = encodeURIComponent(message);

  // Intent URL for mobile apps
  return `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`;
}

/**
 * Prepare WhatsApp share data for invoice
 * Returns all the information needed for the mobile app to share via WhatsApp
 */
export interface WhatsAppShareData {
  phone: string;
  formatted_phone: string;
  message: string;
  web_link: string;
  app_intent: string;
  has_image: boolean;
  image_base64?: string;
}

export function prepareWhatsAppShare(
  phone: string,
  message: string,
  imageBase64?: string
): WhatsAppShareData {
  let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

  if (!cleanPhone.startsWith('+')) {
    if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1);
    }
    if (!cleanPhone.startsWith('91') && cleanPhone.length === 10) {
      cleanPhone = '+91' + cleanPhone;
    }
  }

  return {
    phone: phone,
    formatted_phone: cleanPhone,
    message: message,
    web_link: generateWhatsAppLink(phone, message),
    app_intent: generateWhatsAppIntent(phone, message),
    has_image: !!imageBase64,
    image_base64: imageBase64,
  };
}

/**
 * Format payment reminder message for WhatsApp
 */
export function formatPaymentReminder(
  customerName: string,
  invoiceNumber: string,
  amount: number,
  dueDate?: string,
  upiId?: string
): string {
  const lines: string[] = [];
  lines.push(`🙏 Namaste ${customerName} ji,`);
  lines.push('');
  lines.push(`This is a friendly reminder for pending payment:`);
  lines.push('');
  lines.push(`📄 Invoice: #${invoiceNumber}`);
  lines.push(`💰 Amount: ₹${amount.toFixed(2)}`);

  if (dueDate) {
    lines.push(`📅 Due Date: ${dueDate}`);
  }

  lines.push('');

  if (upiId) {
    lines.push(`💳 Pay via UPI: ${upiId}`);
    lines.push('');
  }

  lines.push('Please let us know if you have any questions.');
  lines.push('');
  lines.push('Thank you for your business! 🙏');

  return lines.join('\n');
}

/**
 * Format order confirmation message for WhatsApp
 */
export function formatOrderConfirmation(
  customerName: string,
  orderNumber: string,
  items: Array<{ name: string; quantity: number; unit: string }>,
  total: number,
  deliveryDate?: string
): string {
  const lines: string[] = [];
  lines.push(`✅ *Order Confirmed!*`);
  lines.push('');
  lines.push(`Dear ${customerName},`);
  lines.push('');
  lines.push(`Your order #${orderNumber} has been confirmed.`);
  lines.push('');
  lines.push('*Items:*');

  for (const item of items) {
    lines.push(`▪️ ${item.name} - ${item.quantity} ${item.unit}`);
  }

  lines.push('');
  lines.push(`*Total: ₹${total.toFixed(2)}*`);

  if (deliveryDate) {
    lines.push('');
    lines.push(`📦 Expected Delivery: ${deliveryDate}`);
  }

  lines.push('');
  lines.push('Thank you for your order! 🙏');

  return lines.join('\n');
}

/**
 * Format low stock alert message (for supplier)
 */
export function formatLowStockAlert(
  supplierName: string,
  items: Array<{ name: string; current_stock: number; unit: string; required_quantity: number }>
): string {
  const lines: string[] = [];
  lines.push(`📦 *Stock Replenishment Request*`);
  lines.push('');
  lines.push(`Dear ${supplierName},`);
  lines.push('');
  lines.push('We need to reorder the following items:');
  lines.push('');

  for (const item of items) {
    lines.push(`▪️ *${item.name}*`);
    lines.push(`   Current Stock: ${item.current_stock} ${item.unit}`);
    lines.push(`   Required: ${item.required_quantity} ${item.unit}`);
  }

  lines.push('');
  lines.push('Please share availability and rates.');
  lines.push('');
  lines.push('Thanks! 🙏');

  return lines.join('\n');
}

/**
 * Validate Indian phone number
 */
export function isValidIndianPhone(phone: string): boolean {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Check for valid Indian mobile number
  // Can be 10 digits or 12 digits (with 91)
  if (digits.length === 10) {
    return /^[6-9]\d{9}$/.test(digits);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    return /^91[6-9]\d{9}$/.test(digits);
  }

  return false;
}
