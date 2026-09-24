import { displayInvoiceNumber } from './invoice-number';

describe('displayInvoiceNumber', () => {
  it('removes a legacy prefix and preserves plain numbers', () => {
    expect(displayInvoiceNumber('ZT-41')).toBe('41');
    expect(displayInvoiceNumber('41')).toBe('41');
  });
});
