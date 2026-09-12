import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Permit } from '../auth/auth.guard';
import { ListQuery, VersionDto } from '../common/dto';
import { IdPipe } from '../common/id.pipe';
import { CreateOrderDto, PaymentDto, UpdateOrderDto } from './orders.dto';
import { OrdersService } from './orders.service';
import { InvoiceService } from './invoice.service';
@Controller('orders')
export class OrdersController {
  constructor(
    private orders: OrdersService,
    private invoices: InvoiceService,
  ) {}
  @Get() @Permit('orders:read') list(@Query() query: ListQuery) {
    return this.orders.list(query);
  }
  @Get(':id/pdf') @Permit('orders:read') pdf(
    @Param('id', IdPipe) id: string,
    @Res() res: Response,
  ) {
    return this.invoices.download(id, res);
  }
  @Get(':id') @Permit('orders:read') get(@Param('id', IdPipe) id: string) {
    return this.orders.get(id);
  }
  @Post() @Permit('orders:write') create(@Body() dto: CreateOrderDto) {
    return this.orders.create(dto);
  }
  @Put(':id') @Permit('orders:write') update(
    @Param('id', IdPipe) id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.orders.update(id, dto);
  }
  @Patch(':id/payment') @Permit('orders:write') payment(
    @Param('id', IdPipe) id: string,
    @Body() dto: PaymentDto,
  ) {
    return this.orders.update(id, dto);
  }
  @Delete(':id') @Permit('orders:write') remove(
    @Param('id', IdPipe) id: string,
    @Body() dto: VersionDto,
  ) {
    return this.orders.remove(id, dto.version);
  }
}
