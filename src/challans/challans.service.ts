import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DocumentNumberService } from '../database/document-number.service';
import type { Role, Customer } from '../database/schemas';
import type { Challan } from './challans.schema';
import {
  ChallanQuery,
  CreateChallanDto,
  UpdateChallanDto,
} from './challans.dto';
import { searchRegex } from '../common/dto';
@Injectable()
export class ChallansService implements OnModuleInit {
  constructor(
    private numbers: DocumentNumberService,
    @InjectModel('DeliveryChallan') private challans: Model<Challan>,
    @InjectModel('Role') private roles: Model<Role>,
    @InjectModel('Customer') private customers: Model<Customer>,
  ) {}
  async onModuleInit() {
    // Extend existing administrators when upgrading an already-running installation.
    await this.roles.updateOne(
      { name: 'admin' },
      {
        $addToSet: {
          permissions: { $each: ['challans:read', 'challans:write'] },
        },
      },
    );
  }
  async list(query: ChallanQuery) {
    const filter = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            $or: [
              { challanNumber: searchRegex(query.search) },
              { 'items.name': searchRegex(query.search) },
              { 'items.company': searchRegex(query.search) },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.challans
        .find(filter)
        .select('-requestId')
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.challans.countDocuments(filter),
    ]);
    return {
      data,
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit),
    };
  }
  async get(id: string) {
    const challan = await this.challans
      .findById(id)
      .select('-requestId')
      .lean();
    if (!challan) throw new NotFoundException('Delivery challan not found.');
    return challan;
  }
  async create(dto: CreateChallanDto) {
    const existing = await this.challans
      .findOne({ requestId: dto.requestId })
      .lean();
    if (existing) return existing;
    const customer = await this.customerDetails(dto);
    try {
      return await this.challans.create({
        ...dto,
        ...customer,
        challanNumber: await this.numbers.next(
          'DC',
          this.challans.collection.collectionName,
        ),
        statusUpdatedAt: new Date(),
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const existing = await this.challans
          .findOne({ requestId: dto.requestId })
          .lean();
        if (existing) return existing;
      }
      throw error;
    }
  }
  async update(id: string, dto: UpdateChallanDto) {
    const current = await this.get(id);
    if (current.version !== dto.version)
      throw new ConflictException(
        'This challan changed. Refresh before editing.',
      );
    const customer = await this.customerDetails(dto);
    const updated = await this.challans
      .findOneAndUpdate(
        { _id: id, version: dto.version },
        {
          $set: {
            ...customer,
            ...(dto.customerAddress !== undefined
              ? { customerAddress: dto.customerAddress }
              : {}),
            ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
            items: dto.items,
            status: dto.status,
            ...(current.status !== dto.status
              ? { statusUpdatedAt: new Date() }
              : {}),
          },
          $inc: { version: 1 },
        },
        { new: true, runValidators: true },
      )
      .lean();
    if (!updated)
      throw new ConflictException(
        'This challan changed. Refresh before editing.',
      );
    return updated;
  }
  private async customerDetails(dto: CreateChallanDto | UpdateChallanDto) {
    if (!dto.customerId) return {};
    const customer = await this.customers.findById(dto.customerId).lean();
    if (!customer) throw new NotFoundException('Customer not found.');
    return {
      customerId: customer._id,
      customerName: customer.name,
      customerAddress: dto.customerAddress ?? customer.address,
      customerPhone: customer.phone,
    };
  }
}
