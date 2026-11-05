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
      overallDiscountCents: 0,
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
  it('renders the healthcare distributor and legal warranty sections', () => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    doc.resume();
    const spy = jest.spyOn(doc, 'text');
    const items = [{
      productId: new Types.ObjectId(), name: 'Panadol', type: 'Tablet',
      strength: '500 mg', company: 'Sample', quantity: 1,
      quantityPerPacking: 10, unitPriceCents: 10000,
      discountType: 'percent' as const, discountValue: 0,
      netUnitPriceCents: 10000, totalCents: 10000,
    }];
    renderInvoice(doc, {
      invoiceNumber: '1', customerName: 'Licensed Customer',
      customerAddress: 'Gujranwala', customerPhone: '03000000000',
      customerLicenseNumber: 'LIC-12345', createdAt: new Date(),
      updatedAt: new Date(), statusUpdatedAt: new Date(), status: 'paid',
      items, subtotalCents: 10000, discountCents: 0,
      overallDiscountCents: 0, totalCents: 10000,
      previousPendingCents: 0, grandTotalCents: 10000,
      receivedCents: 10000, remainingCents: 0,
    }, { currency: 'PKR', timezone: 'Asia/Karachi', warranty: true });
    const text = spy.mock.calls.map((call) => call[0]).join(' ');
    expect(text).toContain('HEALTHCARE DISTRIBUTORS');
    expect(text).toContain('Lic # : 09-341-0132-90395D');
    expect(text).toContain('License No: LIC-12345');
    expect(text).toContain('Warranty Form 2A (See Rule 19 & 30)');
    expect(text).toContain('Warranty under section 23(1)(i) of Drug Act, 1976');
    expect(text).toContain('Warranty Form 11 for alternative medicines and');
    expect(text).toContain('[see rule 10(3) & (5)]');
    expect(text).not.toContain('SALES INVOICE');
    expect(text).not.toContain('Previous Balance');
    expect(text).not.toContain('Payment Received');
    expect(text).not.toContain('Total Amount');
    expect(text).toContain('Net Total');
    expect(text).toContain('This software is developed & maintained  by Sohaib Imran. Call or Whatsapp 03060624288 to get yours');
    doc.end();
  });

  it('adds the developer attribution to ordinary invoices', () => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    doc.resume();
    const spy = jest.spyOn(doc, 'text');
    renderInvoice(doc, {
      invoiceNumber: '2', customerName: 'Customer', customerAddress: '',
      customerPhone: '', createdAt: new Date(), updatedAt: new Date(),
      statusUpdatedAt: new Date(), status: 'paid', items: [],
      subtotalCents: 0, discountCents: 0, overallDiscountCents: 0,
      totalCents: 0, previousPendingCents: 0, grandTotalCents: 0,
      receivedCents: 0, remainingCents: 0,
    }, { currency: 'PKR', timezone: 'Asia/Karachi' });
    const renderedText = spy.mock.calls.map((call) => call[0]).join(' ');
    expect(renderedText).toContain('SALES INVOICE');
    expect(renderedText).toContain('This software is developed & maintained  by Sohaib Imran. Call or Whatsapp 03060624288 to get yours');
    doc.end();
  });
});
