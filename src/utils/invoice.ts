import PDFDocument from 'pdfkit';
import type { Customer, Invoice, User } from '../types/index.js';
import { generateUPIQRCode } from './qrcode.js';

interface InvoiceRenderData {
  invoice: Invoice;
  seller: User;
  customer?: Customer;
  includeQR?: boolean;
}

/**
 * Generate invoice PDF as base64
 */
/**
 * Generate invoice PDF as base64
 */
export async function generateInvoicePDF(data: InvoiceRenderData): Promise<string> {
  console.log(`[PDF] Starting generation for Invoice #${data.invoice.invoice_number}`);
  return new Promise<string>(async (resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      console.log('[PDF] Generation finished, converting to base64...');
      const pdfBuffer = Buffer.concat(chunks);
      const base64 = pdfBuffer.toString('base64');
      console.log(`[PDF] Success! Base64 length: ${base64.length}`);
      resolve(base64);
    });
    doc.on('error', (err) => {
      console.error('PDFKit Error:', err);
      reject(err);
    });

    try {
      const { invoice, seller, customer, includeQR = true } = data;

      // Header
      doc.fontSize(24).font('Helvetica-Bold').text(getInvoiceTitle(invoice.invoice_type), { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica').text(`#${invoice.invoice_number}`, { align: 'center' });
      doc.moveDown(1);

      // Seller Info (Left)
      doc.fontSize(14).font('Helvetica-Bold').text('From:', 50);
      doc.fontSize(11).font('Helvetica');
      doc.text(seller.shop_name || seller.name);
      if (seller.address) doc.text(seller.address);
      if (seller.phone) doc.text(`Phone: ${seller.phone}`);
      if (seller.email) doc.text(`Email: ${seller.email}`);
      if (seller.gst_number) doc.text(`GSTIN: ${seller.gst_number}`);

      // Customer Info (Right)
      const rightColumnX = 350;
      let currentY = doc.y - 80; // Go back up to align with seller info

      if (customer) {
        doc.fontSize(14).font('Helvetica-Bold').text('To:', rightColumnX, currentY);
        currentY += 18;
        doc.fontSize(11).font('Helvetica');
        doc.text(customer.name, rightColumnX, currentY);
        currentY += 15;
        if (customer.address) {
          doc.text(customer.address, rightColumnX, currentY);
          currentY += 15;
        }
        if (customer.phone) {
          doc.text(`Phone: ${customer.phone}`, rightColumnX, currentY);
          currentY += 15;
        }
        if (customer.gst_number) {
          doc.text(`GSTIN: ${customer.gst_number}`, rightColumnX, currentY);
        }
      }

      doc.moveDown(4);

      // Invoice Details
      const detailsY = doc.y;
      doc.fontSize(10).font('Helvetica');
      doc.text(`Date: ${formatDate(invoice.created_at)}`, 50, detailsY);
      if (invoice.due_date) {
        doc.text(`Due Date: ${formatDate(invoice.due_date)}`, 200, detailsY);
      }
      doc.text(`Status: ${invoice.status.toUpperCase()}`, 400, detailsY);

      doc.moveDown(2);

      // Items Table Header
      const tableTop = doc.y;
      const tableLeft = 50;
      const colWidths = [200, 60, 80, 60, 95];

      doc.fontSize(10).font('Helvetica-Bold');
      doc.rect(tableLeft, tableTop, 495, 25).fill('#f0f0f0');
      doc.fillColor('#000000');

      let xPos = tableLeft + 5;
      doc.text('Item', xPos, tableTop + 7);
      xPos += colWidths[0];
      doc.text('Qty', xPos, tableTop + 7);
      xPos += colWidths[1];
      doc.text('Rate', xPos, tableTop + 7);
      xPos += colWidths[2];
      doc.text('GST %', xPos, tableTop + 7);
      xPos += colWidths[3];
      doc.text('Amount', xPos, tableTop + 7, { align: 'right', width: colWidths[4] - 10 });

      // Items
      let itemY = tableTop + 30;
      doc.font('Helvetica').fontSize(10);

      for (const item of invoice.items) {
        xPos = tableLeft + 5;
        doc.text(item.name, xPos, itemY, { width: colWidths[0] - 10 });
        xPos += colWidths[0];
        doc.text(`${item.quantity} ${item.unit}`, xPos, itemY);
        xPos += colWidths[1];
        doc.text(`₹${item.unit_price.toFixed(2)}`, xPos, itemY);
        xPos += colWidths[2];
        doc.text(`${item.gst_rate}%`, xPos, itemY);
        xPos += colWidths[3];
        doc.text(`₹${item.total.toFixed(2)}`, xPos, itemY, { align: 'right', width: colWidths[4] - 10 });

        itemY += 20;
      }

      // Totals
      doc.moveDown(1);
      const totalsX = 380;
      let totalsY = itemY + 20;

      doc.font('Helvetica');
      doc.text('Subtotal:', totalsX, totalsY);
      doc.text(`₹${invoice.subtotal.toFixed(2)}`, totalsX + 100, totalsY, { align: 'right', width: 60 });
      totalsY += 18;

      if (invoice.discount_amount > 0) {
        const discountLabel = invoice.discount_type === 'percentage'
          ? `Discount (${((invoice.discount_amount / invoice.subtotal) * 100).toFixed(1)}%):`
          : 'Discount:';
        doc.text(discountLabel, totalsX, totalsY);
        doc.text(`-₹${invoice.discount_amount.toFixed(2)}`, totalsX + 100, totalsY, { align: 'right', width: 60 });
        totalsY += 18;
      }

      if (invoice.tax_amount > 0) {
        doc.text('Tax (GST):', totalsX, totalsY);
        doc.text(`₹${invoice.tax_amount.toFixed(2)}`, totalsX + 100, totalsY, { align: 'right', width: 60 });
        totalsY += 18;
      }

      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('Total:', totalsX, totalsY);
      doc.text(`₹${invoice.total.toFixed(2)}`, totalsX + 100, totalsY, { align: 'right', width: 60 });

      // UPI QR Code (if enabled and seller has UPI ID)
      if (includeQR && seller.upi_id && invoice.status !== 'paid') {
        const qrData = await generateUPIQRCode({
          payee_upi_id: seller.upi_id,
          payee_name: seller.shop_name || seller.name,
          amount: invoice.total,
          transaction_note: `Payment for ${invoice.invoice_number}`,
          transaction_ref: invoice.invoice_number,
        });

        // Add QR code to PDF
        const qrImageData = qrData.qr_image_base64.replace(/^data:image\/png;base64,/, '');
        const qrBuffer = Buffer.from(qrImageData, 'base64');

        doc.moveDown(3);
        doc.fontSize(10).font('Helvetica-Bold').text('Scan to Pay:', 50);
        doc.image(qrBuffer, 50, doc.y, { width: 100 });
        doc.moveDown(8);
        doc.fontSize(8).font('Helvetica').text(`UPI: ${seller.upi_id}`, 50);
      }

      // Notes and Terms
      if (invoice.notes) {
        doc.moveDown(2);
        doc.fontSize(10).font('Helvetica-Bold').text('Notes:');
        doc.font('Helvetica').text(invoice.notes);
      }

      if (invoice.terms) {
        doc.moveDown(1);
        doc.fontSize(10).font('Helvetica-Bold').text('Terms & Conditions:');
        doc.font('Helvetica').text(invoice.terms);
      }

      // Footer
      doc.fontSize(8).font('Helvetica')
        .text('Generated by Vyapar', 50, doc.page.height - 50, { align: 'center' });

      console.log('[PDF] Finalizing document structure...');
      doc.end();
    } catch (error) {
      console.error('Invoice Generation Error:', error);
      reject(error);
    }
  });
}

/**
 * Generate invoice image (PNG) as base64
 * This is a simplified version for WhatsApp sharing
 */
export async function generateInvoiceImage(data: InvoiceRenderData): Promise<string> {
  // For image generation, we'll create a simplified text-based invoice
  // In production, you might use canvas or puppeteer for better results
  const { invoice, seller, customer } = data;

  const lines: string[] = [];
  lines.push('═'.repeat(40));
  lines.push(getInvoiceTitle(invoice.invoice_type).toUpperCase().padStart(25));
  lines.push(`#${invoice.invoice_number}`.padStart(25));
  lines.push('═'.repeat(40));
  lines.push('');
  lines.push(`From: ${seller.shop_name || seller.name}`);
  if (seller.phone) lines.push(`Phone: ${seller.phone}`);
  if (seller.gst_number) lines.push(`GSTIN: ${seller.gst_number}`);
  lines.push('');

  if (customer) {
    lines.push(`To: ${customer.name}`);
    if (customer.phone) lines.push(`Phone: ${customer.phone}`);
    if (customer.gst_number) lines.push(`GSTIN: ${customer.gst_number}`);
    lines.push('');
  }

  lines.push(`Date: ${formatDate(invoice.created_at)}`);
  if (invoice.due_date) lines.push(`Due: ${formatDate(invoice.due_date)}`);
  lines.push('─'.repeat(40));
  lines.push('');
  lines.push('ITEMS:');

  for (const item of invoice.items) {
    lines.push(`• ${item.name}`);
    lines.push(`  ${item.quantity} ${item.unit} × ₹${item.unit_price} = ₹${item.total.toFixed(2)}`);
  }

  lines.push('');
  lines.push('─'.repeat(40));
  lines.push(`Subtotal: ₹${invoice.subtotal.toFixed(2)}`.padStart(35));

  if (invoice.discount_amount > 0) {
    lines.push(`Discount: -₹${invoice.discount_amount.toFixed(2)}`.padStart(35));
  }

  if (invoice.tax_amount > 0) {
    lines.push(`Tax (GST): ₹${invoice.tax_amount.toFixed(2)}`.padStart(35));
  }

  lines.push('═'.repeat(40));
  lines.push(`TOTAL: ₹${invoice.total.toFixed(2)}`.padStart(35));
  lines.push('═'.repeat(40));

  if (seller.upi_id) {
    lines.push('');
    lines.push(`Pay via UPI: ${seller.upi_id}`);
  }

  lines.push('');
  lines.push('Thank you for your business!');

  // Return the text content (in production, convert to image)
  return Buffer.from(lines.join('\n')).toString('base64');
}

/**
 * Format invoice for WhatsApp message
 */
export function formatInvoiceForWhatsApp(data: InvoiceRenderData): string {
  const { invoice, seller, customer } = data;

  const lines: string[] = [];
  lines.push(`📄 *${getInvoiceTitle(invoice.invoice_type)}*`);
  lines.push(`#${invoice.invoice_number}`);
  lines.push('');
  lines.push(`📅 Date: ${formatDate(invoice.created_at)}`);
  if (invoice.due_date) {
    lines.push(`⏰ Due: ${formatDate(invoice.due_date)}`);
  }
  lines.push('');
  lines.push(`*From:* ${seller.shop_name || seller.name}`);
  if (seller.phone) lines.push(`📞 ${seller.phone}`);
  lines.push('');

  if (customer) {
    lines.push(`*To:* ${customer.name}`);
    if (customer.phone) lines.push(`📞 ${customer.phone}`);
    lines.push('');
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('*Items:*');

  for (const item of invoice.items) {
    lines.push(`▪️ ${item.name}`);
    lines.push(`   ${item.quantity} ${item.unit} × ₹${item.unit_price} = *₹${item.total.toFixed(2)}*`);
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push(`Subtotal: ₹${invoice.subtotal.toFixed(2)}`);

  if (invoice.discount_amount > 0) {
    lines.push(`Discount: -₹${invoice.discount_amount.toFixed(2)}`);
  }

  if (invoice.tax_amount > 0) {
    lines.push(`Tax (GST): ₹${invoice.tax_amount.toFixed(2)}`);
  }

  lines.push('');
  lines.push(`*💰 Total: ₹${invoice.total.toFixed(2)}*`);
  lines.push('');

  if (seller.upi_id && invoice.status !== 'paid') {
    lines.push(`💳 Pay via UPI: \`${seller.upi_id}\``);
  }

  lines.push('');
  lines.push('_Generated by Vyapar_');

  return lines.join('\n');
}

function getInvoiceTitle(type: Invoice['invoice_type']): string {
  switch (type) {
    case 'invoice':
      return 'Tax Invoice';
    case 'quotation':
      return 'Quotation';
    case 'proforma':
      return 'Proforma Invoice';
    case 'delivery_challan':
      return 'Delivery Challan';
    default:
      return 'Invoice';
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Calculate invoice totals from items
 */
export function calculateInvoiceTotals(
  items: Array<{
    quantity: number;
    unit_price: number;
    discount: number;
    gst_rate: number;
  }>,
  discountAmount: number = 0,
  discountType: 'percentage' | 'fixed' = 'fixed'
): {
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
} {
  // Calculate item totals
  const itemTotals = items.map(item => {
    const baseAmount = item.quantity * item.unit_price;
    const itemDiscount = (baseAmount * item.discount) / 100;
    const afterDiscount = baseAmount - itemDiscount;
    const gstAmount = (afterDiscount * item.gst_rate) / 100;
    return {
      base: baseAmount,
      discount: itemDiscount,
      gst: gstAmount,
      total: afterDiscount + gstAmount,
    };
  });

  const subtotal = itemTotals.reduce((sum, item) => sum + item.base - item.discount, 0);

  let finalDiscount = discountAmount;
  if (discountType === 'percentage') {
    finalDiscount = (subtotal * discountAmount) / 100;
  }

  const afterDiscount = subtotal - finalDiscount;
  const taxAmount = itemTotals.reduce((sum, item) => sum + item.gst, 0);

  return {
    subtotal,
    discount_amount: finalDiscount,
    tax_amount: taxAmount,
    total: afterDiscount + taxAmount,
  };
}
