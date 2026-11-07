import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Customer, Product } from '../database/schemas';
import { ListQuery, pageResult, searchRegex } from '../common/dto';
import { cents, discountedPrice } from '../common/money';
import { DocumentNumberService } from '../database/document-number.service';
import { WarrantyDto } from './warranties.dto';
import type { Warranty } from './warranties.schema';

@Injectable()
export class WarrantiesService {
  constructor(
    private numbers: DocumentNumberService,
    @InjectModel('Warranty') private warranties: Model<Warranty>,
    @InjectModel('Product') private products: Model<Product>,
    @InjectModel('Customer') private customers: Model<Customer>,
  ) {}
  async list(query: ListQuery) {
    const filter = {
      deletedAt: null,
      ...(query.search
        ? { $or: [{ warrantyNumber: searchRegex(query.search) }, { customerName: searchRegex(query.search) }] }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.warranties.find(filter).sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      this.warranties.countDocuments(filter),
    ]);
    return pageResult(data, total, query);
  }
  get(id: string) {
    return this.warranties.findOne({ _id: id, deletedAt: null }).lean().then((value) => {
      if (!value) throw new NotFoundException('Warranty not found.');
      return value;
    });
  }
  async create(dto: WarrantyDto) {
    const existing = await this.warranties.findOne({ requestId: dto.requestId }).lean();
    if (existing) return existing;
    const customer = await this.customers.findOne({ _id: dto.customerId, deletedAt: null }).lean();
    if (!customer) throw new NotFoundException('Customer not found.');
    const products = await this.products.find({ _id: { $in: dto.items.map((item) => item.productId) }, deletedAt: null }).lean();
    const byId = new Map(products.map((product) => [product._id.toString(), product]));
    const items = dto.items.map((input) => {
      const product = byId.get(input.productId);
      if (!product) throw new BadRequestException('A selected medicine no longer exists.');
      const unitPriceCents = cents(input.salePrice);
      const netUnitPriceCents = discountedPrice(unitPriceCents, input.discountType, input.discountValue);
      return {
        productId: product._id, name: product.name, type: product.type,
        strength: product.strength, company: product.company,
        batchNumber: product.batchNumber,
        quantity: input.quantity, quantityPerPacking: product.quantityPerPacking ?? 1,
        unitPriceCents, discountType: input.discountType,
        discountValue: input.discountValue, netUnitPriceCents,
        totalCents: netUnitPriceCents * input.quantity,
      };
    });
    const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    const beforeOverall = items.reduce((sum, item) => sum + item.totalCents, 0);
    const overallDiscountCents = cents(dto.overallDiscount);
    if (overallDiscountCents > beforeOverall)
      throw new BadRequestException('Overall discount cannot exceed the warranty amount.');
    const totalCents = beforeOverall - overallDiscountCents;
    return this.warranties.create({
      warrantyNumber: await this.numbers.next('warranty', this.warranties.collection.collectionName),
      requestId: dto.requestId, customerId: customer._id,
      customerName: customer.name, customerAddress: customer.address,
      customerPhone: customer.phone, customerLicenseNumber: customer.licenseNumber ?? '',
      items, subtotalCents, overallDiscountCents,
      discountCents: subtotalCents - totalCents, totalCents,
      remarks: dto.remarks.trim(),
    });
  }
  async remove(id: string, version: number) {
    const result = await this.warranties.findOneAndUpdate(
      { _id: id, version, deletedAt: null },
      { $set: { deletedAt: new Date() }, $inc: { version: 1 } },
    );
    if (!result) throw new NotFoundException('Warranty changed or no longer exists.');
    return { success: true };
  }
}
