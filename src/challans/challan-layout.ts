import type PDFDocument from 'pdfkit';
import type { Challan } from './challans.schema';
export function renderChallan(
  doc: InstanceType<typeof PDFDocument>,
  challan: Pick<
    Challan,
    | 'challanNumber'
    | 'items'
    | 'status'
    | 'createdAt'
    | 'updatedAt'
    | 'statusUpdatedAt'
    | 'customerName'
    | 'customerAddress'
    | 'remarks'
  >,
  storeName: string,
  timezone: string,
) {
  const forest = '#173F35',
    cream = '#E9EFDE',
    lime = '#D7EBA5',
    ink = '#243B34',
    muted = '#687C70',
    line = '#E2E8DC';
  const left = 40,
    width = doc.page.width - 80,
    bottom = 758;
  const text = (
    value: string,
    x: number,
    y: number,
    w: number,
    size = 8,
    bold = false,
    color = ink,
    align: 'left' | 'right' | 'center' = 'left',
  ) => {
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(size)
      .fillColor(color)
      .text(value, x, y, { width: w, align, lineGap: 2 });
  };
  const height = (value: string, w: number, bold = false) =>
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(8)
      .heightOfString(value, { width: w, lineGap: 2 });
  const date = (value: Date) =>
    new Date(value).toLocaleString('en-GB', {
      timeZone: timezone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const header = () => {
    doc.rect(0, 0, doc.page.width, 72).fill(forest);
    doc.roundedRect(left, 19, 28, 28, 7).fill(lime);
    doc.rect(left + 12, 25, 4, 16).fill(forest);
    doc.rect(left + 6, 31, 16, 4).fill(forest);
    text(storeName, left + 38, 18, 310, 16, true, '#FFFFFF');
    text(
      'MEDICINE COMPANY / DELIVERY CHALLAN',
      left + 38,
      40,
      310,
      7,
      false,
      lime,
    );
    doc.roundedRect(left + width - 76, 24, 76, 18, 9).fill(cream);
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(forest)
      .text(
        challan.status.toUpperCase(),
        left + width - 76,
        33 + (7 * 0.718) / 2,
        { width: 76, align: 'center', baseline: 'alphabetic', lineGap: 0 },
      );
  };
  header();
  text(
    'If customer license has expired or not available. Order can not be processed.',
    left,
    76,
    width,
    7,
    true,
  );
  text('Challan No.', left, 90, 65, 8, true, muted);
  text(challan.challanNumber, left + 67, 90, 200);
  text('Created', left + 285, 90, 55, 8, true, muted);
  text(date(challan.createdAt), left + 340, 90, width - 340);
  const cols = [28, 191, 100, width - 459, 140];
  let position = left;
  const xs = cols.map((columnWidth) => {
    const current = position;
    position += columnWidth;
    return current;
  });
  text('CUSTOMER', left, 109, 65, 8, true, muted);
  text(challan.customerName || '-', left + 67, 109, width - 67, 8, true);
  const detailsY =
    109 +
    Math.max(12, height(challan.customerName || '-', width - 67, true)) +
    8;
  const detailWidth = (width - 20) / 2;
  text('AREA', left, detailsY, detailWidth, 8, true);
  const remarks = `Remarks : ${challan.remarks || '-'}`;
  text(
    challan.customerAddress || '-',
    left,
    detailsY + 14,
    detailWidth,
    8,
    true,
  );
  text(
    remarks,
    left + detailWidth + 20,
    detailsY,
    detailWidth,
    8,
    true,
  );
  let y =
    detailsY +
    26 +
    Math.max(
      height(challan.customerAddress || '-', detailWidth, true),
      height(remarks, detailWidth, true),
    );
  const borders = (top: number, h: number) => {
    doc.lineWidth(0.5).strokeColor(line);
    for (const x of [...xs, left + width])
      doc
        .moveTo(x, top)
        .lineTo(x, top + h)
        .stroke();
    doc
      .moveTo(left, top + h)
      .lineTo(left + width, top + h)
      .stroke();
  };
  const tableHead = () => {
    doc.roundedRect(left, y, width, 24, 4).fill(forest);
    ['Sr', 'Product', 'Type', 'Qty', 'Company'].forEach((label, i) =>
      text(
        label,
        xs[i] + 5,
        y + 8,
        cols[i] - 10,
        7,
        true,
        '#FFFFFF',
        i === 3 ? 'right' : 'left',
      ),
    );
    y += 24;
  };
  tableHead();
  challan.items.forEach((item, index) => {
    const values = [
      String(index + 1),
      [item.name, item.strength].filter(Boolean).join(' / '),
      item.type,
      String(item.quantity),
      item.company,
    ];
    const h = Math.max(
      25,
      ...values.map((v, i) => height(v, cols[i] - 10, i === 1) + 12),
    );
    if (y + h > bottom) {
      doc.addPage();
      header();
      y = 88;
      tableHead();
    }
    if (index % 2 === 0) doc.rect(left, y, width, h).fill('#F7F9F3');
    values.forEach((v, i) =>
      text(
        v,
        xs[i] + 5,
        y + 6,
        cols[i] - 10,
        8,
        i === 1,
        ink,
        i === 3 ? 'right' : 'left',
      ),
    );
    borders(y, h);
    y += h;
  });
  if (y + 70 > bottom) {
    doc.addPage();
    header();
    y = 88;
  }
  y += 14;
  text(
    `${challan.items.length} product lines  /  ${challan.items.reduce((sum, item) => sum + item.quantity, 0)} total units`,
    left,
    y,
    width,
    9,
    true,
    forest,
  );
  y += 40;
  doc
    .strokeColor(line)
    .moveTo(left, y)
    .lineTo(left + 170, y)
    .stroke();
  doc
    .moveTo(left + width - 170, y)
    .lineTo(left + width, y)
    .stroke();
  text('Prepared by', left, y + 6, 170, 8, false, muted);
  text(
    'Received by / signature',
    left + width - 170,
    y + 6,
    170,
    8,
    false,
    muted,
  );
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc
      .strokeColor(line)
      .moveTo(left, 780)
      .lineTo(left + width, 780)
      .stroke();
    text(challan.challanNumber, left, 788, 260, 7, false, muted);
    text(
      `Page ${i + 1} of ${pages.count}`,
      left + width - 120,
      788,
      120,
      7,
      false,
      muted,
      'right',
    );
  }
}
