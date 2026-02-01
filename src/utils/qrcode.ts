import QRCode from 'qrcode';
import type { UPIPaymentRequest } from '../types/index.js';

/**
 * Generate UPI payment QR code
 * Follows NPCI UPI QR code specification
 */
export async function generateUPIQRCode(request: UPIPaymentRequest): Promise<{
  qr_string: string;
  qr_image_base64: string;
  upi_deep_link: string;
}> {
  // Build UPI URI according to NPCI spec
  const params = new URLSearchParams();
  params.set('pa', request.payee_upi_id); // Payee VPA
  params.set('pn', request.payee_name); // Payee Name

  if (request.amount > 0) {
    params.set('am', request.amount.toFixed(2)); // Amount
  }

  if (request.transaction_note) {
    params.set('tn', request.transaction_note); // Transaction Note
  }

  if (request.transaction_ref) {
    params.set('tr', request.transaction_ref); // Transaction Reference ID
  }

  params.set('cu', 'INR'); // Currency

  const upiString = `upi://pay?${params.toString()}`;

  // Generate QR code as base64 PNG
  const qrImageBase64 = await QRCode.toDataURL(upiString, {
    type: 'image/png',
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  });

  return {
    qr_string: upiString,
    qr_image_base64: qrImageBase64,
    upi_deep_link: upiString,
  };
}

/**
 * Generate a generic QR code for any data
 */
export async function generateQRCode(data: string, options?: {
  size?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
}): Promise<string> {
  const qrImageBase64 = await QRCode.toDataURL(data, {
    type: 'image/png',
    width: options?.size || 200,
    margin: options?.margin || 2,
    color: {
      dark: options?.darkColor || '#000000',
      light: options?.lightColor || '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  });

  return qrImageBase64;
}

/**
 * Parse UPI QR code string
 */
export function parseUPIString(upiString: string): UPIPaymentRequest | null {
  try {
    if (!upiString.startsWith('upi://pay?')) {
      return null;
    }

    const url = new URL(upiString);
    const params = url.searchParams;

    const payeeUpiId = params.get('pa');
    const payeeName = params.get('pn');

    if (!payeeUpiId || !payeeName) {
      return null;
    }

    return {
      payee_upi_id: payeeUpiId,
      payee_name: payeeName,
      amount: parseFloat(params.get('am') || '0'),
      transaction_note: params.get('tn') || undefined,
      transaction_ref: params.get('tr') || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Validate UPI ID format
 */
export function isValidUPIId(upiId: string): boolean {
  // UPI ID format: username@bankhandle
  const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
  return upiRegex.test(upiId);
}
