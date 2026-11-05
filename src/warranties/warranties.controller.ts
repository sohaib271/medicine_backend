import { Controller, Delete, Get, Param, Post, Body, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import { Permit } from '../auth/auth.guard';
import { ListQuery, VersionDto } from '../common/dto';
import { IdPipe } from '../common/id.pipe';
import { renderInvoice } from '../orders/invoice-layout';
import { WarrantyDto } from './warranties.dto';
import { WarrantiesService } from './warranties.service';

@Controller('warranties')
export class WarrantiesController {
  constructor(private warranties: WarrantiesService, private config: ConfigService) {}
  @Get() @Permit('orders:read') list(@Query() query: ListQuery) { return this.warranties.list(query); }
  @Get(':id/pdf') @Permit('orders:read') async pdf(@Param('id', IdPipe) id: string, @Res() res: Response) {
    const warranty = await this.warranties.get(id);
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: `Warranty ${warranty.warrantyNumber}` } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="warranty-${warranty.warrantyNumber}.pdf"`);
    doc.pipe(res);
    renderInvoice(doc, {
      invoiceNumber: warranty.warrantyNumber,
      customerName: warranty.customerName,
      customerAddress: warranty.customerAddress,
      customerPhone: warranty.customerPhone,
      customerLicenseNumber: warranty.customerLicenseNumber,
      createdAt: warranty.createdAt,
      updatedAt: warranty.updatedAt,
      statusUpdatedAt: warranty.updatedAt,
      status: 'paid',
      items: warranty.items as never,
      subtotalCents: warranty.subtotalCents,
      discountCents: warranty.discountCents,
      overallDiscountCents: warranty.overallDiscountCents,
      totalCents: warranty.totalCents,
      previousPendingCents: 0,
      grandTotalCents: warranty.totalCents,
      receivedCents: warranty.totalCents,
      remainingCents: 0,
      remarks: warranty.remarks,
    }, { currency: this.config.get('CURRENCY', 'PKR'), timezone: this.config.get('TIMEZONE', 'Asia/Karachi'), warranty: true });
    doc.end();
  }
  @Get(':id') @Permit('orders:read') get(@Param('id', IdPipe) id: string) { return this.warranties.get(id); }
  @Post() @Permit('orders:write') create(@Body() dto: WarrantyDto) { return this.warranties.create(dto); }
  @Delete(':id') @Permit('orders:write') remove(@Param('id', IdPipe) id: string, @Body() dto: VersionDto) { return this.warranties.remove(id, dto.version); }
}
