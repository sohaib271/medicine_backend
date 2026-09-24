import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { OrdersService } from './orders.service';
import { renderInvoice } from './invoice-layout';

@Injectable()
export class InvoiceService {
  constructor(
    private orders: OrdersService,
    private config: ConfigService,
  ) {}
  async download(id: string, res: Response) {
    const order = await this.orders.get(id);
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
      info: {
        Title: order.invoiceNumber,
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
      `attachment; filename="${order.invoiceNumber}.pdf"`,
    );
    res.end(pdf);
  }
}
