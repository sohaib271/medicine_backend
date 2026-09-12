import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { OrdersService } from './orders.service';
@Injectable()
export class InvoiceService {
  constructor(
    private orders: OrdersService,
    private config: ConfigService,
  ) {}
  async download(id: string, res: Response) {
    const order = await this.orders.get(id);
    const money = (n: number) =>
      `${this.config.get<string>('CURRENCY', 'PKR')} ${(n / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const date = (value: Date) =>
      new Date(value).toLocaleString('en-GB', {
        timeZone: this.config.get<string>('TIMEZONE', 'Asia/Karachi'),
        hour12: true,
      });
    const doc = new PDFDocument({ size: 'A4', margin: 44, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${order.invoiceNumber}.pdf"`,
    );
    doc.pipe(res);
    const text = (value: string, size = 10) => {
      doc.fontSize(size).fillColor('#183633').text(value);
    };
    text(this.config.get<string>('STORE_NAME', 'Zainab Traders'), 23);
    text('MEDICINE STORE  /  SALES INVOICE');
    doc.moveDown();
    text(order.invoiceNumber, 15);
    text(`Created: ${date(order.createdAt)}`);
    text(`Last updated: ${date(order.updatedAt)}`);
    text(
      `Status: ${order.status.toUpperCase()} | Status changed: ${date(order.statusUpdatedAt)}`,
    );
    doc.moveDown();
    text(`Bill to: ${order.customerName}`, 12);
    if (order.customerAddress) text(order.customerAddress);
    if (order.customerPhone) text(order.customerPhone);
    doc.moveDown();
    for (const item of order.items) {
      if (doc.y > 650) doc.addPage();
      text(`${item.name} ${item.strength} (${item.type})`, 11);
      text(
        `${item.quantity} x ${money(item.unitPriceCents)}  |  Discount/unit: ${item.discountType === 'percent' ? `${item.discountValue}%` : money(Math.round(item.discountValue * 100))}`,
      );
      text(
        `Net/unit: ${money(item.netUnitPriceCents)}  |  Line total: ${money(item.totalCents)}`,
      );
      doc.moveDown(0.7);
    }
    if (doc.y > 520) doc.addPage();
    doc.moveDown();
    for (const [label, value] of [
      ['Subtotal', order.subtotalCents],
      ['Discount', order.discountCents],
      ['Current order amount', order.totalCents],
      ['Previous pending (at creation)', order.previousPendingCents],
      ['Grand total', order.grandTotalCents],
      ['Received for this order', order.receivedCents],
      ['Remaining on this order', order.remainingCents],
    ] as const)
      text(`${label}: ${money(value)}`, label === 'Grand total' ? 14 : 11);
    doc.moveDown();
    text(
      'Previous pending is a snapshot when this bill was created. Payments on other bills do not change this order status.',
      9,
    );
    const range = doc.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page++) {
      doc.switchToPage(page);
      doc
        .fontSize(8)
        .fillColor('#647773')
        .text(
          `${order.invoiceNumber} | Page ${page + 1} of ${range.count}`,
          44,
          790,
          { lineBreak: false },
        );
    }
    doc.end();
  }
}
