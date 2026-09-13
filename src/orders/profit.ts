export interface CostItem {
  quantity: number;
  purchasePriceCents?: number | null;
}
/** Received payment less the full purchase cost; negative until costs are recovered. */
export function receivedProfit(
  receivedCents: number,
  items: CostItem[],
): number | null {
  if (items.some((item) => item.purchasePriceCents == null)) return null;
  return (
    receivedCents -
    items.reduce(
      (sum, item) => sum + item.purchasePriceCents! * item.quantity,
      0,
    )
  );
}
