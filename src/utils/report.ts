import PDFDocument from 'pdfkit';
import type { User } from '../types/index.js';

interface ReportRenderData {
    user: User;
    type: 'daily' | 'analytics' | 'summary';
    data: any;
}

/**
 * Generate report PDF as base64
 */
export async function generateReportPDF(data: ReportRenderData): Promise<string> {
    const { user, type, data: reportData } = data;
    console.log(`[PDF] Starting generation for ${type} report`);

    return new Promise<string>((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            resolve(pdfBuffer.toString('base64'));
        });
        doc.on('error', reject);

        // Title
        const title = type === 'daily' ? 'Daily Business Report' :
            type === 'analytics' ? 'Sales Analytics Report' :
                'Business Summary Report';

        doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica').text(new Date().toLocaleDateString('en-IN'), { align: 'center' });
        doc.moveDown(1.5);

        // Header Info
        doc.fontSize(14).font('Helvetica-Bold').text(user.shop_name || user.name);
        if (user.address) doc.fontSize(10).font('Helvetica').text(user.address);
        if (user.phone) doc.text(`Phone: ${user.phone}`);
        doc.moveDown(2);

        if (type === 'daily') {
            renderDailyReport(doc, reportData);
        } else if (type === 'analytics') {
            renderAnalyticsReport(doc, reportData);
        } else {
            renderSummaryReport(doc, reportData);
        }

        doc.end();
    });
}

function renderDailyReport(doc: PDFKit.PDFDocument, data: any) {
    doc.fontSize(16).font('Helvetica-Bold').text('Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica');
    doc.text(`Total Sales: ₹${(data.sales_total || 0).toFixed(2)}`);
    doc.text(`Total Expenses: ₹${(data.expenses_total || 0).toFixed(2)}`);
    doc.font('Helvetica-Bold').text(`Net Profit: ₹${((data.sales_total || 0) - (data.expenses_total || 0)).toFixed(2)}`);
    doc.moveDown(1.5);

    if (data.recent_invoices && data.recent_invoices.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').text('Recent Invoices');
        doc.moveDown(0.5);
        for (const inv of data.recent_invoices) {
            doc.fontSize(10).font('Helvetica').text(`${inv.invoice_number} - ${inv.customer_name || 'Walk-in'}: ₹${inv.total.toFixed(2)} (${inv.status})`);
        }
    }
}

function renderAnalyticsReport(doc: PDFKit.PDFDocument, data: any) {
    doc.fontSize(16).font('Helvetica-Bold').text('Sales Performance', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica');
    doc.text(`Total Revenue: ₹${(data.total_revenue || 0).toFixed(2)}`);
    doc.text(`Total Orders: ${data.total_orders || 0}`);
    doc.text(`Average Order Value: ₹${(data.average_order_value || 0).toFixed(2)}`);
    doc.moveDown(1.5);

    if (data.top_products && data.top_products.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').text('Top Selling Products');
        doc.moveDown(0.5);
        for (const prod of data.top_products) {
            doc.fontSize(10).font('Helvetica').text(`${prod.name}: ${prod.quantity_sold} ${prod.unit} - ₹${prod.revenue.toFixed(2)}`);
        }
    }
}

function renderSummaryReport(doc: PDFKit.PDFDocument, data: any) {
    doc.fontSize(16).font('Helvetica-Bold').text('Business Overview', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica');
    doc.text(`Total Customers: ${data.total_customers || 0}`);
    doc.text(`Total Products: ${data.total_products || 0}`);
    doc.text(`Total Sales Revenue: ₹${(data.total_sales_revenue || 0).toFixed(2)}`);
    doc.text(`Total Expenses: ₹${(data.total_expenses || 0).toFixed(2)}`);
    doc.moveDown(1.5);

    if (data.low_stock_items && data.low_stock_items.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#FF0000').text('Low Stock Alerts');
        doc.fillColor('#000000'); // Reset color
        doc.moveDown(0.5);
        for (const item of data.low_stock_items) {
            doc.fontSize(10).font('Helvetica').text(`${item.name}: ${item.quantity} ${item.unit} (Threshold: ${item.low_stock_threshold})`);
        }
    }
}
