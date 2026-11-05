import type PDFDocument from 'pdfkit';
import type { Order } from '../database/schemas';
import { displayInvoiceNumber } from './invoice-number';

type InvoiceData = Pick<
  Order,
  | 'invoiceNumber'
  | 'customerName'
  | 'customerAddress'
  | 'customerPhone'
  | 'createdAt'
  | 'updatedAt'
  | 'statusUpdatedAt'
  | 'status'
  | 'items'
  | 'subtotalCents'
  | 'discountCents'
  | 'overallDiscountCents'
  | 'totalCents'
  | 'previousPendingCents'
  | 'grandTotalCents'
  | 'receivedCents'
  | 'remainingCents'
> & { remarks?: string; customerLicenseNumber?: string };
interface InvoiceSettings {
  currency: string;
  timezone: string;
  warranty?: boolean;
}

/** Coordinate-based layout keeps wrapped rows and totals together across pages. */
export function renderInvoice(
  doc: InstanceType<typeof PDFDocument>,
  order: InvoiceData,
  settings: InvoiceSettings,
) {
  const invoiceNumber = displayInvoiceNumber(order.invoiceNumber);
  const color = {
    forest: settings.warranty ? '#000000' : '#173F35',
    cream: settings.warranty ? '#FFFFFF' : '#E9EFDE',
    lime: settings.warranty ? '#FFFFFF' : '#D7EBA5',
    ink: settings.warranty ? '#000000' : '#243B34',
    muted: settings.warranty ? '#000000' : '#687C70',
    line: settings.warranty ? '#000000' : '#E2E8DC',
    stripe: settings.warranty ? '#FFFFFF' : '#F7F9F3',
  };
  const left = 40;
  const width = doc.page.width - left * 2;
  const bottom = 758;
  const number = (value: number) =>
    (value / 100).toLocaleString('en-PK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const date = (value: Date) =>
    new Date(value).toLocaleString('en-GB', {
      timeZone: settings.timezone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  const text = (
    value: string,
    x: number,
    y: number,
    w: number,
    size = 9,
    bold = false,
    fill = color.ink,
    align: 'left' | 'right' | 'center' = 'left',
  ) => {
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(size)
      .fillColor(fill)
      .text(value, x, y, { width: w, align, lineGap: 2 });
  };
  const height = (value: string, w: number, size = 9, bold = false) =>
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(size)
      .heightOfString(value, { width: w, lineGap: 2 });
  const rule = (y: number) =>
    doc
      .moveTo(left, y)
      .lineTo(left + width, y)
      .lineWidth(0.5)
      .strokeColor(color.line)
      .stroke();
  const header = (continued = false) => {
    if (settings.warranty) {
      if (!continued) {
        const distributorX = left + width - 220;
        text('HEALTHCARE DISTRIBUTORS', distributorX, 20, 220, 12, true, color.ink);
        text('St# 1, Opposite sui gas office, Near underpass', distributorX, 35, 220, 6.4);
        text('Chowk, Gujranwala, Phone : 0306-6665606', distributorX, 44, 220, 6.4);
        text('Lic # : 09-341-0132-90395D', distributorX, 53, 220, 6.4);
      } else {
        text('WARRANTY - CONTINUED', left, 29, 240, 9, true, color.ink);
      }
      doc
        .moveTo(left, 68)
        .lineTo(left + width, 68)
        .lineWidth(0.8)
        .strokeColor(color.ink)
        .stroke();
      return;
    }
    doc.rect(0, 0, doc.page.width, 72).fill(color.forest);
    doc.roundedRect(left, 19, 28, 28, 7).fill(color.lime);
    doc.rect(left + 12, 25, 4, 16).fill(color.forest);
    doc.rect(left + 6, 31, 16, 4).fill(color.forest);
    text('SALES INVOICE', left + 38, 18, 310, 16, true, '#FFFFFF');
    text(
      continued ? 'CONTINUED' : 'MEDICINE COMPANY',
      left + 38,
      40,
      310,
      7,
      false,
      color.lime,
    );
    if (!continued) {
      const label = order.status.toUpperCase();
      const badgeX = left + width - 62;
      doc.roundedRect(badgeX, 24, 62, 18, 9).fill(color.cream);
      // Center the visible uppercase letters, excluding the font's line spacing.
      const fontSize = 7;
      const capHeight = fontSize * 0.718; // Helvetica Bold capital height.
      doc
        .font('Helvetica-Bold')
        .fontSize(fontSize)
        .fillColor(color.forest)
        .text(label, badgeX, 24 + 18 / 2 + capHeight / 2, {
          width: 62,
          align: 'center',
          baseline: 'alphabetic',
          lineGap: 0,
        });
    }
  };
  header();
  let y = 85;
  text('CUSTOMER', left, y, 235, 8, true, color.muted);
  text('INVOICE DETAILS', left + 286, y, width - 286, 8, true, color.muted);
  y += 13;
  text(order.customerName, left, y, 245, 10, true);
  let customerY = y + height(order.customerName, 245, 10, true) + 4;
  for (const detail of [
    order.customerAddress,
    order.customerPhone,
    order.customerLicenseNumber
      ? `License No: ${order.customerLicenseNumber}`
      : '',
  ]) {
    if (!detail) continue;
    text(detail, left, customerY, 245, 8, false, color.muted);
    customerY += height(detail, 245, 8) + 3;
  }
  let metaY = y;
  for (const [label, value] of [
    ['Invoice No.', invoiceNumber],
    ['Date', date(order.createdAt)],
  ]) {
    text(label, left + 266, metaY + 1, 63, 7, false, color.muted);
    text(value, left + 332, metaY, width - 332, 7.5, label === 'Invoice No.');
    metaY += Math.max(
      18,
      height(value, width - 332, 7.5, label === 'Invoice No.') + 8,
    );
  }
  const pageNumberY = metaY;
  metaY += 18;
  y = Math.max(customerY, metaY) + 8;
  const savedRemarks = order.remarks?.trim();
  const remarks = `REMARKS: ${order.customerName}${savedRemarks ? ` — ${savedRemarks}` : ''}`;
  const area = `AREA: ${order.customerAddress || '-'}`;
  const remarksWidth = width - 266;
  text(area, left, y, 245, 8, false, color.ink);
  text(remarks, left + 266, y, remarksWidth, 8, true, color.ink);
  y +=
    Math.max(height(area, 245, 8), height(remarks, remarksWidth, 8, true)) + 10;
  const cols = [24, 106, 60, 43, 50, 32, 55, 35, 40, width - 445];
  let position = left;
  const positions = cols.map((columnWidth) => {
    const current = position;
    position += columnWidth;
    return current;
  });
  const columnBorders = (top: number, rowHeight: number, headerRow = false) => {
    doc
      .save()
      .lineWidth(0.5)
      .strokeColor(headerRow ? '#6D8C7F' : color.line);
    const boundaries = headerRow
      ? positions.slice(1)
      : [...positions, left + width];
    for (const x of boundaries) {
      doc
        .moveTo(x, top)
        .lineTo(x, top + rowHeight)
        .stroke();
    }
    doc.restore();
  };
  const tableHead = () => {
    text(
      `MEDICINES  /  ${settings.currency}`,
      left,
      y,
      width,
      8,
      true,
      color.muted,
    );
    y += 13;
    if (settings.warranty) {
      doc.rect(left, y, width, 24).fill('#FFFFFF').strokeColor(color.ink).lineWidth(0.6).stroke();
    } else {
      doc.roundedRect(left, y, width, 24, 4).fill(color.forest);
    }
    [
      'Sr',
      'Product',
      'Company',
      'Type',
      'Pieces / Pack',
      'Packs',
      'Rate / Pack',
      'Disc %',
      'Disc Unit',
      'Net Amount',
    ].forEach((label, i) =>
      text(
        label,
        positions[i] + 5,
        y + 8,
        cols[i] - 10,
        6.5,
        true,
        settings.warranty ? color.ink : '#FFFFFF',
        i > 3 ? 'right' : 'left',
      ),
    );
    columnBorders(y, 24, true);
    y += 24;
  };
  const nextPage = (withTable: boolean) => {
    doc.addPage();
    header(true);
    y = 86;
    if (withTable) tableHead();
  };
  tableHead();
  order.items.forEach((item, index) => {
    const medicine = [item.name, item.strength].filter(Boolean).join(' / ');
    const discountPercent =
      item.discountType === 'percent' ? `${item.discountValue}%` : '-';
    const discountAmount = number(item.unitPriceCents - item.netUnitPriceCents);
    const values = [
      String(index + 1).padStart(2, '0'),
      medicine,
      item.company || '-',
      item.type,
      String(item.quantityPerPacking ?? 1),
      String(item.quantity),
      number(item.unitPriceCents),
      discountPercent,
      discountAmount,
      number(item.totalCents),
    ];
    const rowHeight = Math.max(
      24,
      ...values.map(
        (value, i) => height(value, cols[i] - 10, 8, i === 1 || i === 9) + 12,
      ),
    );
    if (y + rowHeight > bottom) nextPage(true);
    if (!settings.warranty && index % 2 === 0) doc.rect(left, y, width, rowHeight).fill(color.stripe);
    values.forEach((value, i) =>
      text(
        value,
        positions[i] + 5,
        y + 6,
        cols[i] - 10,
        8,
        i === 1 || i === 9,
        i === 0 ? color.muted : color.ink,
        i > 3 ? 'right' : 'left',
      ),
    );
    columnBorders(y, rowHeight);
    y += rowHeight;
    rule(y);
  });
  y += 12;
  const rows: Array<[string, number]> = settings.warranty
    ? [
        ['Subtotal', order.subtotalCents],
        ['Discount', -order.discountCents],
        ['Net Total', order.totalCents],
      ]
    : [
        ['Subtotal', order.subtotalCents],
        ['Discount', -order.discountCents],
        ['Total', order.totalCents],
        ['Previous Balance', order.previousPendingCents],
        ['Total Amount', order.grandTotalCents],
        ['Payment Received', order.receivedCents],
        ['Net Total', order.grandTotalCents - order.receivedCents],
      ];
  const totalsWidth = 270;
  const totalsX = left + width - totalsWidth;
  const rowHeights = rows.map(([label, value]) =>
    Math.max(
      20,
      height(label, 132, 8, true) + 8,
      height(`${settings.currency} ${number(value)}`, 116, 8.5, true) + 8,
    ),
  );
  const totalsHeight = rowHeights.reduce((sum, h) => sum + h, 0);
  if (y + totalsHeight > bottom) nextPage(false);
  text(
    'THANK YOU FOR YOUR TRUST',
    left,
    y + 7,
    width - totalsWidth - 20,
    8,
    true,
    color.forest,
  );
  text(
    'Quotation for institution balance.\nValid for 72 hours\nPlease bring your order with license copy.',
    left,
    y + 22,
    width - totalsWidth - 24,
    9,
    false,
    color.muted,
  );
  text(
    'All discounts apply per medicine unit.',
    left,
    y + 80,
    width - totalsWidth - 24,
    8,
    false,
    color.muted,
  );
  rows.forEach(([label, value], index) => {
    const grand = label === 'Net Total' && !settings.warranty;
    if (settings.warranty) {
      doc
        .rect(totalsX, y, totalsWidth, rowHeights[index])
        .lineWidth(0.5)
        .strokeColor(color.ink)
        .stroke();
    } else {
      doc
        .rect(totalsX, y, totalsWidth, rowHeights[index])
        .fill(
          grand
            ? color.forest
            : label === 'Total Amount'
              ? color.cream
              : color.stripe,
        );
    }
    text(
      label,
      totalsX + 8,
      y + 5,
      132,
      8,
      true,
      grand ? '#FFFFFF' : color.ink,
    );
    text(
      `${settings.currency} ${number(value)}`,
      totalsX + 146,
      y + 4,
      116,
      8.5,
      true,
      grand ? color.lime : color.ink,
      'right',
    );
    y += rowHeights[index];
  });
  if (settings.warranty) {
    if (y > 638) {
      doc.addPage();
      header(true);
    }
    const boxY = 646;
    const gap = 6;
    const boxWidth = (width - gap) / 2;
    doc.rect(left, boxY, boxWidth, 116).lineWidth(0.8).strokeColor(color.ink).stroke();
    doc.rect(left + boxWidth + gap, boxY, boxWidth, 116).lineWidth(0.8).strokeColor(color.ink).stroke();
    text('Warranty Form 2A (See Rule 19 & 30)', left + 6, boxY + 6, 160, 8, true);
    text('Warranty under section 23(1)(i) of Drug Act, 1976', left + 157, boxY + 7, boxWidth - 163, 5.6, false, color.ink, 'right');
    text(
      'I, Ahsan Mumtaz, being a person resident in Pakistan carrying on business at Off, Opposite sui gas office, Gujranwala under the name of M/s HEALTHCARE DISTRIBUTORS do hereby give this warranty that the drugs hereunder described as sold in the bill of sale invoice do not contravene in any way the provisions of section 23 of the Drugs Act 1976.',
      left + 6, boxY + 24, boxWidth - 12, 6.2,
    );
    text('Authorized Signature', left + boxWidth - 105, boxY + 103, 95, 6, false, color.muted, 'center');
    doc.moveTo(left + boxWidth - 105, boxY + 101).lineTo(left + boxWidth - 10, boxY + 101).strokeColor(color.ink).stroke();
    const rightX = left + boxWidth + gap;
    text('Warranty Form 11 for alternative medicines and', rightX + 6, boxY + 6, boxWidth - 12, 7.5, true, color.ink, 'center');
    text('health products enlistment rules 2014', rightX + 6, boxY + 16, boxWidth - 12, 7.5, true, color.ink, 'center');
    text('[see rule 10(3) & (5)]', rightX + 6, boxY + 27, boxWidth - 12, 7, true, color.ink, 'center');
    text(
      'It is hereby certified and i undertake the above mention finished products of specified batch number supplied by me do not contravene in any way the provisions of the drap act 2012 and rules framed thereunder, the authorized agent (with valid distribution authority letter) shall pass on this warranty to the retailers in the area of jurisdiction.',
      rightX + 6, boxY + 42, boxWidth - 12, 6.2,
    );
  }
  const range = doc.bufferedPageRange();
  const attribution = 'This software is developed & maintained  by Sohaib Imran. Call or Whatsapp 03060624288 to get yours';
  for (let page = range.start; page < range.start + range.count; page++) {
    doc.switchToPage(page);
    if (page === 0) {
      text('Page', left + 266, pageNumberY + 1, 63, 7, false, color.muted);
      text(
        `${page + 1} of ${range.count}`,
        left + 332,
        pageNumberY,
        width - 332,
        7.5,
      );
    }
    if (page === range.start + range.count - 1) {
      text(attribution, left, settings.warranty ? 766 : 773, width, 6.5, false, color.muted, 'center');
    }
    rule(786);
    text(invoiceNumber, left, 788, 250, 7, false, color.muted);
    text(
      `Page ${page + 1} of ${range.count}`,
      left + width - 120,
      788,
      120,
      8,
      false,
      color.muted,
      'right',
    );
  }
}
