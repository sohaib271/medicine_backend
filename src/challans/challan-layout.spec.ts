import PDFDocument from 'pdfkit';
import { renderChallan } from './challan-layout';

describe('Delivery challan PDF', () => {
  it.each([4, 45])(
    'renders %i products with no billing fields and repeated table headers',
    (count) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
      });
      doc.resume();
      const spy = jest.spyOn(doc, 'text');
      renderChallan(
        doc,
        {
          challanNumber: '1234',
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
          statusUpdatedAt: new Date(),
          items: Array.from({ length: count }, () => ({
            name: 'Vitamin C',
            company: 'Sample Pharma',
            type: 'Tablet',
            quantity: 20,
          })),
        },
        'Asia/Karachi',
      );
      const labels = spy.mock.calls.map((call) => call[0]);
      expect(labels.join(' ')).not.toMatch(/Zainab Traders/i);
      expect(labels).toContain('CUSTOMER');
      expect(labels).toContain('AREA');
      expect(labels).toContain('Remarks : -');
      expect(labels.join(' ')).not.toMatch(
        /discount|price|amount|PKR|payment/i,
      );
      expect(labels).toContain('Sample Pharma');
      const pages = doc.bufferedPageRange().count;
      if (count === 4) expect(pages).toBe(1);
      else {
        expect(pages).toBeGreaterThan(1);
        expect(pages).toBeLessThanOrEqual(3);
      }
      const tablePages = labels.filter((label) => label === 'Product').length;
      expect(tablePages).toBeGreaterThanOrEqual(pages - 1);
      expect(tablePages).toBeLessThanOrEqual(pages);
      doc.end();
    },
  );
});
