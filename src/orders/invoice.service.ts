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
        Author: this.config.get<string>('STORE_NAME', 'Zainab Traders'),
      },
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${order.invoiceNumber}.pdf"`,
    );
    doc.pipe(res);
    renderInvoice(doc, order, {
      storeName: this.config.get<string>('STORE_NAME', 'Zainab Traders'),
      currency: this.config.get<string>('CURRENCY', 'PKR'),
      timezone: this.config.get<string>('TIMEZONE', 'Asia/Karachi'),
    });
    doc.end();
  }
}
