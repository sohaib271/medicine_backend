import { Controller, Get, Query, Res } from '@nestjs/common';
import { Permit } from '../auth/auth.guard';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import { ReportQuery } from './reports.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get() @Permit('dashboard:read') get(@Query() query: ReportQuery) {
    return this.reports.summary(query.from, query.to);
  }

  @Get('pdf') @Permit('dashboard:read') async pdf(
    @Query() query: ReportQuery,
    @Res() res: Response,
  ) {
    const report = await this.reports.summary(query.from, query.to);
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      info: { Title: `Business report ${query.from} to ${query.to}` },
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="report-${query.from}-to-${query.to}.pdf"`,
    );
    doc.pipe(res);
    const money = (value: number) =>
      `PKR ${(value / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    doc.fillColor('#26483d').fontSize(22).text('Business performance report');
    doc.moveDown(0.5).fontSize(11).text(`${query.from} to ${query.to}`);
    doc.moveDown(1.5);
    const section = (
      title: string,
      values: typeof report.lifetime | typeof report.period,
      includeStockLeft: boolean,
    ) => {
      doc.fillColor('#26483d').fontSize(15).text(title);
      doc.moveDown(0.5);
      const rows: [string, string][] = [
        ['Stock sold', `${values.packsSold.toLocaleString()} packs / ${values.unitsSold.toLocaleString()} units`],
        ['Sales', money(values.salesCents)],
        ['Stock spent (purchase cost)', money(values.stockSpentCents)],
        ['Sales profit', `${values.profitEstimated ? '~ ' : ''}${money(values.profitCents)}`],
        ['Expenses', money(values.expenseCents)],
        ['Profit after expenses', `${values.profitEstimated ? '~ ' : ''}${money(values.profitAfterExpenseCents)}`],
      ];
      if (includeStockLeft && 'stockLeftCents' in values)
        rows.splice(3, 0, ['Stock left (purchase value)', money(values.stockLeftCents)]);
      for (const [label, value] of rows) {
        const y = doc.y;
        doc.fillColor('#708074').fontSize(10).text(label, 48, y, { width: 270 });
        doc.fillColor('#243c34').fontSize(10).text(value, 320, y, { width: 220, align: 'right' });
        doc.moveTo(48, doc.y + 6).lineTo(547, doc.y + 6).strokeColor('#e6ebe6').stroke();
        doc.y += 14;
      }
      doc.moveDown();
    };
    section('Selected period', report.period, false);
    section('All time', report.lifetime, true);
    if (report.lifetime.profitEstimated || report.period.profitEstimated)
      doc.fillColor('#8a7650').fontSize(9).text('~ Estimated using current purchase prices for older invoices without stored cost snapshots.');
    doc.end();
  }
}
