import { BadRequestException } from '@nestjs/common';

export const cents = (amount: number) => Math.round(amount * 100);
export function discountedPrice(
  priceCents: number,
  type: string,
  value: number,
) {
  if (
    value < 0 ||
    (type === 'percent' && value > 100) ||
    (type === 'fixed' && cents(value) > priceCents)
  ) {
    throw new BadRequestException(
      'Discount cannot exceed the medicine price (or 100%).',
    );
  }
  return type === 'percent'
    ? Math.round(priceCents * (1 - value / 100))
    : priceCents - cents(value);
}
export function paymentStatus(
  totalCents: number,
  receivedCents: number,
): 'paid' | 'partial' | 'pending' {
  if (receivedCents < 0 || receivedCents > totalCents)
    throw new BadRequestException(
      'Received amount must be between zero and this order total. Pay earlier orders separately.',
    );
  return receivedCents === totalCents
    ? 'paid'
    : receivedCents === 0
      ? 'pending'
      : 'partial';
}
