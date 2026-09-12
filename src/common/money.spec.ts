import { cents, discountedPrice, paymentStatus } from './money';
describe('Invoice calculations', () => {
  it('rounds currency to integer minor units', () => {
    expect(cents(19.99)).toBe(1999);
  });
  it('rounds percentage discounts once per unit', () => {
    expect(discountedPrice(1999, 'percent', 15)).toBe(1699);
  });
  it('supports a fixed discount per unit', () => {
    expect(discountedPrice(50000, 'fixed', 50)).toBe(45000);
  });
  it('rejects discounts greater than the unit price', () => {
    expect(() => discountedPrice(1000, 'fixed', 11)).toThrow();
    expect(() => discountedPrice(1000, 'percent', 101)).toThrow();
  });
  it('derives payment status from only this order', () => {
    expect(paymentStatus(10000, 10000)).toBe('paid');
    expect(paymentStatus(10000, 100)).toBe('partial');
    expect(paymentStatus(10000, 0)).toBe('pending');
    expect(paymentStatus(0, 0)).toBe('paid');
  });
  it('rejects overpayment', () => {
    expect(() => paymentStatus(10000, 10001)).toThrow();
  });
});
