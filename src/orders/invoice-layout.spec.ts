import PDFDocument from 'pdfkit';
import { Types } from 'mongoose';
import { renderInvoice } from './invoice-layout';

function pageCount(count: number) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  doc.resume();
  const total = count * 32400;
  renderInvoice(
    doc,
    {
      invoiceNumber: '5486',
      customerName: 'Sample Customer',
      customerAddress: 'Garden Town\nLahore',
      customerPhone: '0300 1234567',
      createdAt: new Date(),
      updatedAt: new Date(),
      statusUpdatedAt: new Date(),
      status: 'partial',
      items: Array.from({ length: count }, () => ({
        productId: new Types.ObjectId(),
        name: 'Vitamin C Effervescent Tablets',
        type: 'Tablet',
        strength: '500 mg',
        quantity: 2,
        unitPriceCents: 18000,
        discountType: 'percent',
        discountValue: 10,
        netUnitPriceCents: 16200,
        totalCents: 32400,
      })),
      subtotalCents: count * 36000,
      discountCents: count * 3600,
      totalCents: total,
      previousPendingCents: 25000,
      grandTotalCents: total + 25000,
      receivedCents: 50000,
      remainingCents: total - 50000,
    },
    { currency: 'PKR', timezone: 'Asia/Karachi' },
  );
  const pages = doc.bufferedPageRange().count;
  doc.end();
  return pages;
}
describe('Invoice pagination', () => {
  it('keeps a typical four-item bill on one page without extra footer pages', () => {
    expect(pageCount(4)).toBe(1);
  });
  it('paginates longer tables without generating blank footer pages', () => {
    expect(pageCount(45)).toBeGreaterThan(1);
    expect(pageCount(45)).toBeLessThanOrEqual(3);
  });
  it('fits ten medicines with wrapped names and the totals on a single page', () => {
    expect(pageCount(10)).toBe(1);
  });
});
