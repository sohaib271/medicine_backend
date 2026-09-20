import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Expense, Order, Product } from '../database/schemas';

type SalesRow = {
  _id: Types.ObjectId;
  packsSold: number;
  unitsSold: number;
  salesCents: number;
  recordedCostCents: number;
  legacyPacks: number;
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel('Order') private orders: Model<Order>,
    @InjectModel('Product') private products: Model<Product>,
    @InjectModel('Expense') private expenses: Model<Expense>,
  ) {}

  private range(from: string, to: string) {
    if (from > to)
      throw new BadRequestException('From date must be before or equal to the to date.');
    return {
      $gte: new Date(`${from}T00:00:00+05:00`),
      $lte: new Date(`${to}T23:59:59.999+05:00`),
    };
  }

  private sales(match: Record<string, unknown>) {
    return this.orders.aggregate<SalesRow>([
      { $match: { deletedAt: null, ...match } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          packsSold: { $sum: '$items.quantity' },
          unitsSold: {
            $sum: {
              $multiply: [
                '$items.quantity',
                { $ifNull: ['$items.quantityPerPacking', 1] },
              ],
            },
          },
          salesCents: { $sum: '$items.totalCents' },
          recordedCostCents: {
            $sum: {
              $cond: [
                { $ne: ['$items.purchasePriceCents', null] },
                { $multiply: ['$items.purchasePriceCents', '$items.quantity'] },
                0,
              ],
            },
          },
          legacyPacks: {
            $sum: {
              $cond: [
                { $eq: ['$items.purchasePriceCents', null] },
                '$items.quantity',
                0,
              ],
            },
          },
        },
      },
    ]);
  }

  async summary(from: string, to: string) {
    const dateRange = this.range(from, to);
    const [products, lifetimeRows, periodRows, expenses, periodExpenses] =
      await Promise.all([
        this.products
          .find({})
          .select('stock quantityPerPacking purchasePriceCents deletedAt')
          .lean(),
        this.sales({}),
        this.sales({ createdAt: dateRange }),
        this.expenses.aggregate<{ total: number }>([
          { $match: { deletedAt: null } },
          { $group: { _id: null, total: { $sum: '$amountCents' } } },
        ]),
        this.expenses.aggregate<{ total: number }>([
          { $match: { deletedAt: null, date: dateRange } },
          { $group: { _id: null, total: { $sum: '$amountCents' } } },
        ]),
      ]);
    const costs = new Map(
      products.map((product) => [
        (product as unknown as { _id: Types.ObjectId })._id.toString(),
        product.purchasePriceCents,
      ]),
    );
    const summarize = (rows: SalesRow[]) => {
      const salesCents = rows.reduce((sum, row) => sum + row.salesCents, 0);
      const stockSpentCents = rows.reduce(
        (sum, row) =>
          sum +
          row.recordedCostCents +
          row.legacyPacks * (costs.get(row._id.toString()) ?? 0),
        0,
      );
      return {
        packsSold: rows.reduce((sum, row) => sum + row.packsSold, 0),
        unitsSold: rows.reduce((sum, row) => sum + row.unitsSold, 0),
        salesCents,
        stockSpentCents,
        profitCents: salesCents - stockSpentCents,
        profitEstimated: rows.some((row) => row.legacyPacks > 0),
      };
    };
    const lifetime = summarize(lifetimeRows);
    const period = summarize(periodRows);
    const expenseCents = expenses[0]?.total ?? 0;
    const periodExpenseCents = periodExpenses[0]?.total ?? 0;
    const stockLeftCents = Math.round(
      products
        .filter((product) => product.deletedAt == null)
        .reduce(
          (sum, product) =>
            sum +
            (product.stock / (product.quantityPerPacking ?? 1)) *
              product.purchasePriceCents,
          0,
        ),
    );
    return {
      from,
      to,
      lifetime: {
        ...lifetime,
        expenseCents,
        profitAfterExpenseCents: lifetime.profitCents - expenseCents,
        stockLeftCents,
      },
      period: {
        ...period,
        expenseCents: periodExpenseCents,
        profitAfterExpenseCents: period.profitCents - periodExpenseCents,
      },
    };
  }
}
