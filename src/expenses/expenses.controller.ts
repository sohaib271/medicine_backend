import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Permit } from '../auth/auth.guard';
import { IdPipe } from '../common/id.pipe';
import type { Expense } from '../database/schemas';
import { ExpenseDto, ExpenseQuery } from './expenses.dto';

const dayStart = (value: string) => new Date(`${value}T00:00:00+05:00`);
const dayEnd = (value: string) => new Date(`${value}T23:59:59.999+05:00`);

@Controller('expenses')
export class ExpensesController {
  constructor(@InjectModel('Expense') private expenses: Model<Expense>) {}

  @Get() @Permit('dashboard:read') async list(@Query() query: ExpenseQuery) {
    if (query.from && query.to && query.from > query.to)
      throw new BadRequestException('From date must be before or equal to the to date.');
    const filter = {
      deletedAt: null,
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { $gte: dayStart(query.from) } : {}),
              ...(query.to ? { $lte: dayEnd(query.to) } : {}),
            },
          }
        : {}),
    };
    const [data, total, amount] = await Promise.all([
      this.expenses
        .find(filter)
        .sort({ date: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.expenses.countDocuments(filter),
      this.expenses.aggregate<{ total: number }>([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$amountCents' } } },
      ]),
    ]);
    return {
      data,
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit),
      amountCents: amount[0]?.total ?? 0,
    };
  }

  @Post() @Permit('orders:write') create(@Body() dto: ExpenseDto) {
    if (!dto.category.trim())
      throw new BadRequestException('Expense category is required.');
    return this.expenses.create({
      date: dayStart(dto.date),
      category: dto.category.trim(),
      description: dto.description.trim(),
      amountCents: dto.amountCents,
    });
  }

  @Delete(':id') @Permit('orders:write') async remove(
    @Param('id', IdPipe) id: string,
  ) {
    const expense = await this.expenses.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    );
    if (!expense) throw new NotFoundException('Expense not found.');
    return { success: true };
  }
}
