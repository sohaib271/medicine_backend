import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Customer } from '../database/schemas';
import { Permit } from '../auth/auth.guard';
import { ListQuery, pageResult, searchRegex } from '../common/dto';
import { IdPipe } from '../common/id.pipe';
import { CustomerDto } from './customers.dto';
@Controller('customers')
export class CustomersController {
  constructor(@InjectModel('Customer') private customers: Model<Customer>) {}
  @Get() @Permit('customers:read') async list(@Query() query: ListQuery) {
    const filter = {
      deletedAt: null,
      ...(query.search
        ? {
            $or: [
              { name: searchRegex(query.search) },
              { phone: searchRegex(query.search) },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.customers
        .find(filter)
        .sort({ name: 1, _id: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.customers.countDocuments(filter),
    ]);
    return pageResult(data, total, query);
  }
  @Get(':id') @Permit('customers:read') async get(
    @Param('id', IdPipe) id: string,
  ) {
    const customer = await this.customers.findById(id).lean();
    if (!customer) throw new NotFoundException('Customer not found.');
    return customer;
  }
  @Post() @Permit('customers:write') create(@Body() dto: CustomerDto) {
    if (!dto.name.trim())
      throw new BadRequestException('Customer name is required.');
    return this.customers.create({ ...dto, name: dto.name.trim() });
  }
  @Put(':id') @Permit('customers:write') async update(
    @Param('id', IdPipe) id: string,
    @Body() dto: CustomerDto,
  ) {
    if (!dto.name.trim())
      throw new BadRequestException('Customer name is required.');
    const customer = await this.customers
      .findByIdAndUpdate(
        id,
        {
          $set: {
            name: dto.name.trim(),
            address: dto.address,
            phone: dto.phone,
          },
        },
        { new: true, runValidators: true },
      )
      .lean();
    if (!customer) throw new NotFoundException('Customer not found.');
    return customer;
  }
  @Delete(':id') @Permit('customers:write') async remove(
    @Param('id', IdPipe) id: string,
  ) {
    const customer = await this.customers.findOne({ _id: id, deletedAt: null });
    if (!customer) throw new NotFoundException('Customer not found.');
    if (customer.balanceCents > 0)
      throw new ConflictException(
        'Settle the customer outstanding balance before deleting them.',
      );
    customer.deletedAt = new Date();
    await customer.save();
    return { success: true };
  }
}
