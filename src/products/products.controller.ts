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
} from '@nestjs/common';
import { Permit } from '../auth/auth.guard';
import { ListQuery, VersionDto } from '../common/dto';
import { IdPipe } from '../common/id.pipe';
import { AddInventoryDto, ProductDto, UpdateProductDto } from './products.dto';
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
  @Patch(':id/inventory') @Permit('products:write') addInventory(
    @Param('id', IdPipe) id: string,
    @Body() dto: AddInventoryDto,
  ) {
    return this.service.addInventory(id, dto);
  }
  @Delete(':id') @Permit('products:write') remove(
    @Param('id', IdPipe) id: string,
    @Body() dto: VersionDto,
  ) {
    return this.service.remove(id, dto.version);
  }
}
