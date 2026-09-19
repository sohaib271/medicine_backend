import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { Permit } from '../auth/auth.guard';
import { IdPipe } from '../common/id.pipe';
import { VersionDto } from '../common/dto';
import { ChallansService } from './challans.service';
import {
  ChallanQuery,
  CreateChallanDto,
  UpdateChallanDto,
} from './challans.dto';
import { renderChallan } from './challan-layout';
@Controller('challans')
export class ChallansController {
  constructor(
    private service: ChallansService,
    private config: ConfigService,
  ) {}
  @Get() @Permit('challans:read') list(@Query() query: ChallanQuery) {
    return this.service.list(query);
  }
  @Post() @Permit('challans:write') create(@Body() dto: CreateChallanDto) {
    return this.service.create(dto);
  }
  @Get(':id') @Permit('challans:read') get(@Param('id', IdPipe) id: string) {
    return this.service.get(id);
  }
  @Put(':id') @Permit('challans:write') update(
    @Param('id', IdPipe) id: string,
    @Body() dto: UpdateChallanDto,
  ) {
    return this.service.update(id, dto);
  }
  @Delete(':id') @Permit('challans:write') remove(
    @Param('id', IdPipe) id: string,
    @Body() dto: VersionDto,
  ) {
    return this.service.remove(id, dto.version);
  }
  @Get(':id/pdf') @Permit('challans:read') async pdf(
    @Param('id', IdPipe) id: string,
    @Res() res: Response,
  ) {
    const challan = await this.service.get(id);
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
      info: { Title: challan.challanNumber },
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${challan.challanNumber}.pdf"`,
    );
    doc.pipe(res);
    renderChallan(
      doc,
      challan,
      this.config.get<string>('STORE_NAME', 'Zainab Traders'),
      this.config.get<string>('TIMEZONE', 'Asia/Karachi'),
    );
    doc.end();
  }
}
