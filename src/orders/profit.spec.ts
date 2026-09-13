import { receivedProfit } from './profit';
describe('Order received profit', () => {
  it('counts only collected payment, including pending and partial orders', () => {
    const items = [{ quantity: 2, purchasePriceCents: 6000 }];
    expect(receivedProfit(0, items)).toBe(-12000);
    expect(receivedProfit(5000, items)).toBe(-7000);
    expect(receivedProfit(12000, items)).toBe(0);
    expect(receivedProfit(15000, items)).toBe(3000);
    expect(receivedProfit(18000, items)).toBe(6000);
  });
  it('deducts purchase costs for every unit from received payments', () => {
    expect(
      receivedProfit(18000, [{ quantity: 2, purchasePriceCents: 6000 }]),
    ).toBe(6000);
  });
  it('shows losses rather than clamping them to zero', () => {
    expect(
      receivedProfit(5000, [{ quantity: 1, purchasePriceCents: 6000 }]),
    ).toBe(-1000);
  });
  it('does not fabricate profit when historical purchase costs are missing', () => {
    expect(receivedProfit(18000, [{ quantity: 2 }])).toBeNull();
    expect(
      receivedProfit(18000, [{ quantity: 2, purchasePriceCents: 0 }]),
    ).toBe(18000);
  });
});
