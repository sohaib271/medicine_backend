import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Permit } from '../auth/auth.guard';
import { ListQuery } from '../common/dto';
import { IdPipe } from '../common/id.pipe';
import { ProductDto, UpdateProductDto } from './products.dto';
import { ProductsService } from './products.service';
@Controller('products')
export class ProductsController {
  constructor(private service: ProductsService) {}
  @Get() @Permit('products:read') list(@Query() query: ListQuery) {
    return this.service.list(query);
  }
  @Post() @Permit('products:write') create(@Body() dto: ProductDto) {
    return this.service.create(dto);
  }
  @Put(':id') @Permit('products:write') update(
    @Param('id', IdPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.service.update(id, dto);
  }
}
