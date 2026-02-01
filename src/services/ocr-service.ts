/**
 * OCR Service for Receipt Scanning
 * Extracts text and structured data from receipt images
 */

import vision from '@google-cloud/vision';
import axios from 'axios';

export interface ExtractedReceiptData {
  vendor_name?: string;
  date?: string;
  total_amount?: number;
  items?: { name: string; amount: number }[];
  gst_number?: string;
  payment_method?: string;
  confidence: number;
  raw_text: string;
}

export class OCRService {
  private client: vision.ImageAnnotatorClient;

  constructor() {
    // Initialize Google Cloud Vision client
    // Credentials should be set via environment variable GOOGLE_APPLICATION_CREDENTIALS
    this.client = new vision.ImageAnnotatorClient();
  }

  /**
   * Download image from URL (Supabase Storage or other)
   */
  private async downloadImage(imageUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to download image: ${error}`);
    }
  }

  /**
   * Extract text from image using Google Cloud Vision
   */
  private async performOCR(imageBuffer: Buffer): Promise<string> {
    try {
      const [result] = await this.client.textDetection({
        image: { content: imageBuffer },
      });

      const fullText = result.fullTextAnnotation?.text || '';

      if (!fullText) {
        throw new Error('No text detected in image');
      }

      return fullText;
    } catch (error) {
      throw new Error(`OCR failed: ${error}`);
    }
  }

  /**
   * Parse extracted text to identify receipt components
   */
  private parseReceiptText(text: string): ExtractedReceiptData {
    const lines = text.split('\n');

    const data: ExtractedReceiptData = {
      raw_text: text,
      confidence: 0.7, // Default confidence
    };

    // Patterns for extraction
    const patterns = {
      // Total amount patterns
      total: /(?:total|amount|grand\s*total|net\s*amount)[:\s]*₹?\s*([0-9,]+(?:\.[0-9]{2})?)/i,

      // Date patterns (DD/MM/YYYY, DD-MM-YYYY, etc.)
      date: /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,

      // GST number pattern
      gst: /(\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[A-Z]{1}\d{1})/,

      // Payment method patterns
      cash: /\b(cash|नकद)\b/i,
      upi: /\b(upi|phonepe|paytm|googlepay|gpay|bhim)\b/i,
      card: /\b(card|visa|mastercard|rupay)\b/i,
    };

    // Extract total amount
    for (const line of lines) {
      const totalMatch = line.match(patterns.total);
      if (totalMatch) {
        const amount = parseFloat(totalMatch[1].replace(/,/g, ''));
        if (!isNaN(amount) && amount > 0) {
          data.total_amount = amount;
          break;
        }
      }
    }

    // Extract date
    const dateMatch = text.match(patterns.date);
    if (dateMatch) {
      data.date = dateMatch[1];
    }

    // Extract GST number
    const gstMatch = text.match(patterns.gst);
    if (gstMatch) {
      data.gst_number = gstMatch[1];
    }

    // Determine payment method
    if (patterns.cash.test(text)) {
      data.payment_method = 'Cash';
    } else if (patterns.upi.test(text)) {
      data.payment_method = 'UPI';
    } else if (patterns.card.test(text)) {
      data.payment_method = 'Card';
    }

    // Extract vendor name (usually in first few lines)
    const topLines = lines.slice(0, 5);
    for (const line of topLines) {
      const cleaned = line.trim();
      if (cleaned.length > 3 && cleaned.length < 50 && /[a-zA-Z]/.test(cleaned)) {
        // Check if it's not a date, total, or GST number
        if (!patterns.date.test(cleaned) && !patterns.gst.test(cleaned) && !patterns.total.test(cleaned)) {
          data.vendor_name = cleaned;
          break;
        }
      }
    }

    // Try to extract line items (basic pattern)
    data.items = this.extractLineItems(lines);

    // Calculate confidence based on what we found
    let foundFields = 0;
    if (data.total_amount) foundFields++;
    if (data.date) foundFields++;
    if (data.vendor_name) foundFields++;
    if (data.gst_number) foundFields++;
    if (data.payment_method) foundFields++;

    data.confidence = Math.min(foundFields / 5, 0.95);

    return data;
  }

  /**
   * Extract individual line items from receipt
   */
  private extractLineItems(lines: string[]): { name: string; amount: number }[] {
    const items: { name: string; amount: number }[] = [];

    // Pattern: Item name followed by amount
    // Example: "Rice Bag ₹500" or "Sugar 1kg 50.00"
    const itemPattern = /^(.+?)\s+₹?\s*([0-9,]+(?:\.[0-9]{2})?)$/;

    for (const line of lines) {
      const match = line.trim().match(itemPattern);
      if (match) {
        const itemName = match[1].trim();
        const amount = parseFloat(match[2].replace(/,/g, ''));

        // Filter out likely non-items (too short, contains keywords)
        if (
          itemName.length > 2 &&
          amount > 0 &&
          amount < 100000 && // Sanity check
          !/^(total|subtotal|tax|gst|cgst|sgst|discount)/i.test(itemName)
        ) {
          items.push({ name: itemName, amount });
        }
      }
    }

    return items.slice(0, 20); // Limit to 20 items
  }

  /**
   * Main method: Extract receipt data from image URL
   */
  async extractReceiptData(imageUrl: string): Promise<ExtractedReceiptData> {
    try {
      // Download image
      const imageBuffer = await this.downloadImage(imageUrl);

      // Perform OCR
      const extractedText = await this.performOCR(imageBuffer);

      // Parse text
      const receiptData = this.parseReceiptText(extractedText);

      return receiptData;
    } catch (error) {
      throw new Error(`Receipt extraction failed: ${error}`);
    }
  }

  /**
   * Alternative: Extract from base64 image
   */
  async extractFromBase64(base64Image: string): Promise<ExtractedReceiptData> {
    try {
      const buffer = Buffer.from(base64Image, 'base64');
      const extractedText = await this.performOCR(buffer);
      return this.parseReceiptText(extractedText);
    } catch (error) {
      throw new Error(`Receipt extraction failed: ${error}`);
    }
  }
}
