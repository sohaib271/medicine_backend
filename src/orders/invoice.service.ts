import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
// PDFKit resolves standard fonts dynamically. Explicit imports ensure Vercel's
// serverless dependency tracer includes the modules in the function bundle.
import 'pdfkit/standard-fonts/Helvetica';
import 'pdfkit/standard-fonts/HelveticaBold';
import type { Response } from 'express';
import { OrdersService } from './orders.service';
import { renderInvoice } from './invoice-layout';
import { displayInvoiceNumber } from './invoice-number';

@Injectable()
export class InvoiceService {
  constructor(
    private orders: OrdersService,
    private config: ConfigService,
  ) {}
  async download(id: string, res: Response) {
    const order = await this.orders.get(id);
    const invoiceNumber = displayInvoiceNumber(order.invoiceNumber);
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
      info: {
        Title: invoiceNumber,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const completed = new Promise<Buffer>((resolve, reject) => {
      doc.once('end', () => resolve(Buffer.concat(chunks)));
      doc.once('error', reject);
    });
    renderInvoice(doc, order, {
      currency: this.config.get<string>('CURRENCY', 'PKR'),
      timezone: this.config.get<string>('TIMEZONE', 'Asia/Karachi'),
    });
    doc.end();
    const pdf = await completed;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${invoiceNumber}.pdf"`,
    );
    res.end(pdf);
  }
}
