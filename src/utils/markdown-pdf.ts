import { marked } from 'marked';
import PDFDocument from 'pdfkit';
import type { User } from '../types/index.js';

interface MarkdownPDFData {
    title: string;
    content_md: string;
    user: User;
}

/**
 * Generate PDF from Markdown content as base64
 */
export async function generateMarkdownPDF(data: MarkdownPDFData): Promise<string> {
    const { title, content_md, user } = data;
    console.log(`[PDF] Starting generation for Markdown doc: ${title}`);

    return new Promise<string>((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            resolve(pdfBuffer.toString('base64'));
        });
        doc.on('error', reject);

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(new Date().toLocaleDateString('en-IN'), { align: 'center' });
        doc.moveDown(1.5);

        // User/Shop Info
        doc.fontSize(12).font('Helvetica-Bold').text(user.shop_name || user.name);
        if (user.address) doc.fontSize(10).font('Helvetica').text(user.address);
        if (user.phone) doc.text(`Phone: ${user.phone}`);
        doc.moveDown(2);

        // Parse Markdown and render to PDF
        // Note: This is a basic implementation. For complex markdown, we might need a more robust parser.
        const tokens = marked.lexer(content_md);

        for (const token of tokens) {
            switch (token.type) {
                case 'heading':
                    doc.moveDown(0.5);
                    doc.fontSize(18 - token.depth * 2).font('Helvetica-Bold').text(token.text);
                    doc.moveDown(0.5);
                    break;
                case 'paragraph':
                    doc.fontSize(11).font('Helvetica').text(token.text);
                    doc.moveDown(0.5);
                    break;
                case 'list':
                    for (const item of token.items) {
                        doc.fontSize(11).font('Helvetica').text(`• ${item.text}`, { indent: 20 });
                        doc.moveDown(0.2);
                    }
                    doc.moveDown(0.3);
                    break;
                case 'table':
                    renderTable(doc, token);
                    break;
                case 'blockquote':
                    doc.fillColor('#666666').fontSize(11).font('Helvetica-Oblique').text(token.text, { indent: 20 });
                    doc.fillColor('#000000'); // Reset color
                    doc.moveDown(0.5);
                    break;
                case 'space':
                    doc.moveDown(0.5);
                    break;
            }
        }

        // Footer
        doc.fontSize(8).font('Helvetica').fillColor('#999999')
            .text('Generated via Vyapar AI', 50, doc.page.height - 50, { align: 'center' });

        doc.end();
    });
}

function renderTable(doc: PDFKit.PDFDocument, token: any) {
    const tableHeader = token.header.map((h: any) => h.text);
    const tableRows = token.rows.map((r: any) => r.map((c: any) => c.text));

    const startX = 50;
    const tableWidth = doc.page.width - 100;
    const colWidth = tableWidth / tableHeader.length;

    doc.fontSize(10).font('Helvetica-Bold');
    let currentY = doc.y;

    // Header background
    doc.rect(startX, currentY, tableWidth, 20).fill('#f0f0f0');
    doc.fillColor('#000000');

    // Header text
    tableHeader.forEach((header: string, i: number) => {
        doc.text(header, startX + i * colWidth + 5, currentY + 5, { width: colWidth - 10 });
    });

    currentY += 20;
    doc.font('Helvetica').fontSize(9);

    // Rows
    tableRows.forEach((row: string[]) => {
        const rowHeight = Math.max(...row.map(cell => doc.heightOfString(cell, { width: colWidth - 10 }))) + 10;

        // Check if we need a new page
        if (currentY + rowHeight > doc.page.height - 70) {
            doc.addPage();
            currentY = 50;
        }

        row.forEach((cell: string, i: number) => {
            doc.text(cell, startX + i * colWidth + 5, currentY + 5, { width: colWidth - 10 });
        });

        currentY += rowHeight;
        doc.moveTo(startX, currentY).lineTo(startX + tableWidth, currentY).stroke('#eeeeee');
    });

    doc.y = currentY + 10;
}
