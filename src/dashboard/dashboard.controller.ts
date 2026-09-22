import { Controller, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Permit } from '../auth/auth.guard';
import type { Customer, Order, Product } from '../database/schemas';
import { ReportsService } from '../reports/reports.service';
@Controller('dashboard')
export class DashboardController {
  constructor(
    @InjectModel('Product') private products: Model<Product>,
    @InjectModel('Order') private orders: Model<Order>,
    @InjectModel('Customer') private customers: Model<Customer>,
    private reports: ReportsService,
  ) {}
  @Get() @Permit('dashboard:read') async get() {
    const since = new Date(Date.now() - 30 * 86400000);
    const [
      productCount,
      lowStockCount,
      customerCount,
      balance,
      sales,
      lowStock,
      recentOrders,
      trend,
      inventoryProducts,
      lifetimeSales,
      lifetimeReceived,
    ] = await Promise.all([
      this.products.countDocuments({ deletedAt: null }),
      this.products.countDocuments({
        deletedAt: null,
        $or: [
          {
            alarmStockThreshold: { $exists: true },
            $expr: { $lte: ['$stock', '$alarmStockThreshold'] },
          },
          {
            alarmStockThreshold: { $exists: false },
            $expr: { $lte: ['$stock', '$alarmLimit'] },
          },
        ],
      }),
      this.customers.countDocuments({ deletedAt: null }),
      this.customers.aggregate<{ total: number }>([
        { $match: { deletedAt: null } },
        { $group: { _id: null, total: { $sum: '$balanceCents' } } },
      ]),
      this.orders.aggregate<{ total: number; count: number; received: number }>(
        [
          { $match: { deletedAt: null, createdAt: { $gte: since } } },
          {
            $group: {
              _id: null,
              total: { $sum: '$totalCents' },
              received: { $sum: '$receivedCents' },
              count: { $sum: 1 },
            },
          },
        ],
      ),
      this.products
        .find({
          deletedAt: null,
          $or: [
            {
              alarmStockThreshold: { $exists: true },
              $expr: { $lte: ['$stock', '$alarmStockThreshold'] },
            },
            {
              alarmStockThreshold: { $exists: false },
              $expr: { $lte: ['$stock', '$alarmLimit'] },
            },
          ],
        })
        .sort({ stock: 1, name: 1 })
        .limit(5)
        .lean(),
      this.orders
        .find({ deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('-items -statusHistory -requestId')
        .lean(),
      this.orders.aggregate<{ _id: string; total: number }>([
        { $match: { deletedAt: null, createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: 'Asia/Karachi',
              },
            },
            total: { $sum: '$totalCents' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.products
        .find({ deletedAt: null })
        .select('stock quantityPerPacking purchasePriceCents')
        .lean(),
      this.orders.aggregate<{
        _id: Types.ObjectId;
        packsSold: number;
        unitsSold: number;
        salesCents: number;
        recordedCostCents: number;
        legacyPacks: number;
      }>([
        { $match: { deletedAt: null } },
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
      ]),
      this.orders.aggregate<{ total: number }>([
        { $match: { deletedAt: null } },
        { $group: { _id: null, total: { $sum: '$receivedCents' } } },
      ]),
    ]);
    const purchasePriceByProduct = new Map(
      inventoryProducts.map((product) => [
        (product as unknown as { _id: Types.ObjectId })._id.toString(),
        product.purchasePriceCents,
      ]),
    );
    const soldPacks = lifetimeSales.reduce((sum, item) => sum + item.packsSold, 0);
    const soldUnits = lifetimeSales.reduce((sum, item) => sum + item.unitsSold, 0);
    const lifetimeSalesCents = lifetimeSales.reduce(
      (sum, item) => sum + item.salesCents,
      0,
    );
    const soldCostCents = lifetimeSales.reduce(
      (sum, item) =>
        sum +
        item.recordedCostCents +
        item.legacyPacks *
          (purchasePriceByProduct.get(item._id.toString()) ?? 0),
      0,
    );
    const now = new Date();
    const monthParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(now);
    const monthStart = `${monthParts.find((part) => part.type === 'year')?.value}-${monthParts.find((part) => part.type === 'month')?.value}-01`;
    const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
    const report = await this.reports.summary(monthStart, today);
    return {
      productCount,
      lowStockCount,
      customerCount,
      balanceCents: balance[0]?.total ?? 0,
      salesCents: sales[0]?.total ?? 0,
      receivedCents: sales[0]?.received ?? 0,
      orderCount: sales[0]?.count ?? 0,
      lowStock,
      recentOrders,
      trend,
      stockCostCents: Math.round(
        inventoryProducts.reduce(
          (sum, product) =>
            sum +
            (product.stock / (product.quantityPerPacking ?? 1)) *
              product.purchasePriceCents,
          0,
        ),
      ),
      lifetimeSalesCents,
      lifetimeReceivedCents: lifetimeReceived[0]?.total ?? 0,
      soldPacks,
      soldUnits,
      netProfitCents: lifetimeSalesCents - soldCostCents,
      profitEstimated: lifetimeSales.some((item) => item.legacyPacks > 0),
      expenseCents: report.lifetime.expenseCents,
      monthlyExpenseCents: report.period.expenseCents,
      monthlyProfitCents: report.period.profitCents,
      monthlyProfitAfterExpenseCents: report.period.profitAfterExpenseCents,
      profitAfterExpenseCents: report.lifetime.profitAfterExpenseCents,
    };
  }
}
