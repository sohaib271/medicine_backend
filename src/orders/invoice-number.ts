export function displayInvoiceNumber(value: string): string {
  return value.match(/\d+$/)?.[0] ?? value;
}
