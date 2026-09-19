import { Controller, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Permit } from '../auth/auth.guard';
import type { Customer, Order, Product } from '../database/schemas';
@Controller('dashboard')
export class DashboardController {
  constructor(
    @InjectModel('Product') private products: Model<Product>,
    @InjectModel('Order') private orders: Model<Order>,
    @InjectModel('Customer') private customers: Model<Customer>,
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
    ]);
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
    };
  }
}
