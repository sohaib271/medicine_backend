import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Product } from '../database/schemas';
import { ListQuery, pageResult, searchRegex } from '../common/dto';
import { cents, discountedPrice } from '../common/money';
import { ProductDto, UpdateProductDto } from './products.dto';
@Injectable()
export class ProductsService {
  constructor(@InjectModel('Product') private products: Model<Product>) {}
  async list(query: ListQuery) {
    const filter = {
      ...(query.search ? { name: searchRegex(query.search) } : {}),
      ...(query.lowStock === 'true'
        ? { $expr: { $lte: ['$stock', '$alarmLimit'] } }
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
    return pageResult(data, total, query);
  }
  private values(dto: ProductDto) {
    if (!dto.name.trim())
      throw new BadRequestException('Medicine name is required.');
    const salePriceCents = cents(dto.salePrice);
    discountedPrice(salePriceCents, dto.discountType, dto.discountValue);
    return {
      name: dto.name.trim(),
      type: dto.type,
      strength: dto.strength.trim(),
      ...(dto.company !== undefined ? { company: dto.company.trim() } : {}),
      purchasePriceCents: cents(dto.purchasePrice),
      salePriceCents,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      stock: dto.stock,
      alarmLimit: dto.alarmLimit,
    };
  }
  create(dto: ProductDto) {
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
}
