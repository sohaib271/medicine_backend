import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Order, Product } from '../database/schemas';
import { ListQuery, pageResult, searchRegex } from '../common/dto';
import { cents, discountedPrice } from '../common/money';
import { ProductDto, UpdateProductDto } from './products.dto';
@Injectable()
export class ProductsService {
  constructor(
    @InjectModel('Product') private products: Model<Product>,
    @InjectModel('Order') private orders: Model<Order>,
  ) {}
  async list(query: ListQuery) {
    const filter = {
      deletedAt: null,
      ...(query.search ? { name: searchRegex(query.search) } : {}),
      ...(query.lowStock === 'true'
        ? {
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
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.products
        .find(filter)
        .sort({ name: 1, _id: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.products.countDocuments(filter),
    ]);
    const ids = data.map(
      (product) => (product as unknown as { _id: Types.ObjectId })._id,
    );
    const sales = ids.length
      ? await this.orders.aggregate<{
          _id: Types.ObjectId;
          packsSold: number;
          unitsSold: number;
          salesCents: number;
          recordedCostCents: number;
          legacyPacks: number;
        }>([
          { $match: { deletedAt: null } },
          { $unwind: '$items' },
          { $match: { 'items.productId': { $in: ids } } },
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
                    {
                      $multiply: [
                        '$items.purchasePriceCents',
                        '$items.quantity',
                      ],
                    },
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
        ])
      : [];
    const salesByProduct = new Map(
      sales.map((item) => [item._id.toString(), item]),
    );
    const enriched = data.map((product) => {
      const item = salesByProduct.get(product._id.toString());
      const estimatedCost =
        (item?.recordedCostCents ?? 0) +
        (item?.legacyPacks ?? 0) * product.purchasePriceCents;
      return {
        ...product,
        stockCostCents: Math.round(
          (product.stock / (product.quantityPerPacking ?? 1)) *
            product.purchasePriceCents,
        ),
        packsSold: item?.packsSold ?? 0,
        unitsSold: item?.unitsSold ?? 0,
        salesCents: item?.salesCents ?? 0,
        netProfitCents: (item?.salesCents ?? 0) - estimatedCost,
        profitEstimated: (item?.legacyPacks ?? 0) > 0,
      };
    });
    return pageResult(enriched, total, query);
  }
  private values(dto: ProductDto) {
    if (!dto.name.trim())
      throw new BadRequestException('Medicine name is required.');
    const salePriceCents = cents(dto.salePrice);
    discountedPrice(salePriceCents, dto.discountType, dto.discountValue);
    const quantityPerPacking = dto.quantityPerPacking ?? 1;
    const stock =
      dto.packing !== undefined ? dto.packing * quantityPerPacking : dto.stock;
    if (stock === undefined || stock > 1000000)
      throw new BadRequestException('Total quantity must not exceed 1000000.');
    return {
      name: dto.name.trim(),
      type: dto.type,
      strength: dto.strength.trim(),
      ...(dto.company !== undefined ? { company: dto.company.trim() } : {}),
      purchasePriceCents: cents(dto.purchasePrice),
      salePriceCents,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      stock,
      quantityPerPacking,
      alarmType: dto.alarmType ?? 'quantity',
      alarmLimit: dto.alarmLimit,
      alarmStockThreshold:
        dto.alarmLimit *
        ((dto.alarmType ?? 'quantity') === 'packing' ? quantityPerPacking : 1),
    };
  }
  create(dto: ProductDto) {
    if (dto.packing === undefined && dto.stock === undefined)
      throw new BadRequestException('Packing is required.');
    return this.products.create(this.values(dto));
  }
  async update(id: string, dto: UpdateProductDto) {
    const product = await this.products
      .findOneAndUpdate(
        { _id: id, version: dto.version },
        { $set: this.values(dto), $inc: { version: 1 } },
        { new: true, runValidators: true },
      )
      .lean();
    if (!product)
      throw new ConflictException(
        'Medicine changed or no longer exists. Refresh before editing.',
      );
    return product;
  }
  async addInventory(
    id: string,
    dto: import('./products.dto').AddInventoryDto,
  ) {
    const addedQuantity = dto.packing * dto.quantityPerPacking;
    if (addedQuantity > 1000000)
      throw new BadRequestException('Added quantity is too large.');
    const removing = dto.operation === 'remove';
    const stockChange = removing ? -addedQuantity : addedQuantity;
    const product = await this.products
      .findOneAndUpdate(
        {
          _id: id,
          version: dto.version,
          stock: removing
            ? { $gte: addedQuantity }
            : { $lte: 1000000 - addedQuantity },
        },
        [
          {
            $set: {
              stock: { $add: ['$stock', stockChange] },
              version: { $add: ['$version', 1] },
              quantityPerPacking: dto.quantityPerPacking,
              alarmStockThreshold: {
                $cond: [
                  { $eq: ['$alarmType', 'packing'] },
                  { $multiply: ['$alarmLimit', dto.quantityPerPacking] },
                  '$alarmLimit',
                ],
              },
            },
          },
        ],
        { new: true },
      )
      .lean();
    if (!product)
      throw new ConflictException(
        removing
          ? 'Medicine changed, no longer exists, or there is not enough stock to remove. Refresh before updating inventory.'
          : 'Medicine changed, no longer exists, or the resulting stock is too large. Refresh before updating inventory.',
      );
    return product;
  }
  async remove(id: string, version: number) {
    const product = await this.products.findOneAndUpdate(
      { _id: id, version, deletedAt: null },
      { $set: { deletedAt: new Date() }, $inc: { version: 1 } },
      { new: true },
    );
    if (!product)
      throw new ConflictException(
        'Medicine changed or no longer exists. Refresh before deleting.',
      );
    return { success: true };
  }
}
