const fs = require('node:fs');
const path = require('node:path');
const PDFDocument = require('pdfkit');
const { renderInvoice } = require('../dist/orders/invoice-layout');
const out = path.resolve(__dirname, '../.data/invoice-preview');
fs.mkdirSync(out, { recursive: true });
for (const count of [4, 45]) {
  const items = Array.from({ length: count }, (_, i) => ({ name: ['Panadol', 'Augmentin', 'Calpol', 'Vitamin C Effervescent Tablets'][i % 4], type: i % 4 === 2 ? 'Syrup' : 'Tablet', strength: i % 4 === 2 ? '120 mg / 5 ml' : '500 mg', quantity: 2, unitPriceCents: 18000, discountType: 'percent', discountValue: 10, netUnitPriceCents: 16200, totalCents: 32400 }));
  const total = count * 32400;
  const order = { invoiceNumber: '5486', customerName: 'Ayesha Khan', customerAddress: '24 Garden Avenue, Garden Town\nLahore, Punjab', customerPhone: '0300 1234567', createdAt: new Date('2026-09-13T10:00:00Z'), updatedAt: new Date('2026-09-13T11:00:00Z'), statusUpdatedAt: new Date('2026-09-13T11:00:00Z'), status: 'partial', items, subtotalCents: count * 36000, discountCents: count * 3600, totalCents: total, previousPendingCents: 25000, grandTotalCents: total + 25000, receivedCents: 50000, remainingCents: total - 50000 };
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  doc.pipe(fs.createWriteStream(path.join(out, `invoice-${count}.pdf`)));
  renderInvoice(doc, order, { currency: 'PKR', timezone: 'Asia/Karachi' });
  console.log(`${count} lines: ${doc.bufferedPageRange().count} pages`); doc.end();
}
