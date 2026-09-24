import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { DocumentNumberService } from '../database/document-number.service';
import type { Customer, Order, Product } from '../database/schemas';
import { ListQuery, pageResult, searchRegex } from '../common/dto';
import { cents, discountedPrice, paymentStatus } from '../common/money';
import { receivedProfit } from './profit';
import { displayInvoiceNumber } from './invoice-number';
import {
  CreateOrderDto,
  OrderItemDto,
  PaymentDto,
  UpdateOrderDto,
} from './orders.dto';

@Injectable()
export class OrdersService {
  constructor(
    private numbers: DocumentNumberService,
    @InjectConnection() private connection: Connection,
    @InjectModel('Order') private orders: Model<Order>,
    @InjectModel('Product') private products: Model<Product>,
    @InjectModel('Customer') private customers: Model<Customer>,
  ) {}
  async list(query: ListQuery) {
    const filter = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.search
        ? {
            $or: [
              { invoiceNumber: searchRegex(query.search) },
              { customerName: searchRegex(query.search) },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.orders
        .find(filter)
        .select('-statusHistory -requestId')
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.orders.countDocuments(filter),
    ]);
    const enriched = await this.withProfit(data);
    return pageResult(
      enriched.map(({ items, ...summary }) => {
        void items;
        return summary;
      }),
      total,
      query,
    );
  }
  async get(id: string) {
    const order = await this.orders
      .findOne({ _id: id, deletedAt: null })
      .lean();
    if (!order) throw new NotFoundException('Order not found.');
    return (await this.withProfit([order]))[0];
  }
  private async withProfit<
    T extends {
      invoiceNumber: string;
      items: Order['items'];
      receivedCents: number;
    },
  >(orders: T[]) {
    const missingIds = [
      ...new Set(
        orders.flatMap((order) =>
          order.items
            .filter((item) => item.purchasePriceCents == null)
            .map((item) => item.productId.toString()),
        ),
      ),
    ];
    const products = missingIds.length
      ? await this.products
          .find({ _id: { $in: missingIds } })
          .select('purchasePriceCents')
          .lean()
      : [];
    const costs = new Map(
      products.map((product) => [
        product._id.toString(),
        product.purchasePriceCents,
      ]),
    );
    return orders.map((order) => ({
      ...order,
      invoiceNumber: displayInvoiceNumber(order.invoiceNumber),
      profitEstimated: order.items.some(
        (item) => item.purchasePriceCents == null,
      ),
      profitCents: receivedProfit(
        order.receivedCents,
        order.items.map((item) => ({
          quantity: item.quantity,
          purchasePriceCents:
            item.purchasePriceCents ?? costs.get(item.productId.toString()),
        })),
      ),
    }));
  }
  // All product reads are batched. Writes use conditional stock checks inside the same transaction.
  private async prepareItems(
    input: OrderItemDto[],
    session: ClientSession,
    previous?: Order['items'],
  ) {
    if (new Set(input.map((i) => i.productId)).size !== input.length)
      throw new BadRequestException('Each medicine can appear only once.');
    const products = await this.products
      .find({ _id: { $in: input.map((i) => i.productId) } })
      .session(session)
      .lean();
    const byId = new Map(products.map((p) => [p._id.toString(), p]));
    const previousById = new Map(
      previous?.map((item) => [item.productId.toString(), item]) ?? [],
    );
    return input.map((item) => {
      const product = byId.get(item.productId);
      if (!product)
        throw new BadRequestException('A selected medicine no longer exists.');
      const old = previousById.get(item.productId);
      // A bill-level override is snapshotted on the order and never changes the product price.
      const unitPriceCents =
        item.salePrice !== undefined
          ? cents(item.salePrice)
          : (old?.unitPriceCents ?? product.salePriceCents);
      const discountType =
        item.discountType ?? old?.discountType ?? product.discountType;
      const discountValue =
        item.discountValue ?? old?.discountValue ?? product.discountValue;
      const netUnitPriceCents = discountedPrice(
        unitPriceCents,
        discountType,
        discountValue,
      );
      return {
        productId: product._id,
        name: old?.name ?? product.name,
        type: old?.type ?? product.type,
        strength: old?.strength ?? product.strength,
        company: old ? old.company : product.company,
        quantity: item.quantity,
        quantityPerPacking:
          old?.quantityPerPacking ?? product.quantityPerPacking ?? 1,
        unitPriceCents,
        purchasePriceCents: old
          ? old.purchasePriceCents
          : product.purchasePriceCents,
        discountType,
        discountValue,
        netUnitPriceCents,
        totalCents: netUnitPriceCents * item.quantity,
      };
    });
  }
  private totals(
    items: {
      unitPriceCents: number;
      quantity: number;
      totalCents: number;
      purchasePriceCents?: number | null;
    }[],
    receivedAmount: number,
    previousPendingCents: number,
  ) {
    const subtotalCents = items.reduce(
      (sum, i) => sum + i.unitPriceCents * i.quantity,
      0,
    );
    const totalCents = items.reduce((sum, i) => sum + i.totalCents, 0);
    const receivedCents = cents(receivedAmount);
    if (!Number.isSafeInteger(subtotalCents + previousPendingCents))
      throw new BadRequestException('Order amount is too large.');
    const status = paymentStatus(totalCents, receivedCents);
    return {
      subtotalCents,
      profitCents: receivedProfit(receivedCents, items),
      totalCents,
      discountCents: subtotalCents - totalCents,
      receivedCents,
      remainingCents: totalCents - receivedCents,
      previousPendingCents,
      grandTotalCents: totalCents + previousPendingCents,
      status,
    };
  }
  private async adjustStock(
    previous: {
      productId: Types.ObjectId;
      quantity: number;
      quantityPerPacking?: number;
    }[],
    next: {
      productId: Types.ObjectId;
      quantity: number;
      quantityPerPacking?: number;
    }[],
    session: ClientSession,
  ) {
    const deltas = new Map<string, number>();
    for (const i of previous)
      deltas.set(
        i.productId.toString(),
        (deltas.get(i.productId.toString()) ?? 0) +
          i.quantity * (i.quantityPerPacking ?? 1),
      );
    for (const i of next)
      deltas.set(
        i.productId.toString(),
        (deltas.get(i.productId.toString()) ?? 0) -
          i.quantity * (i.quantityPerPacking ?? 1),
      );
    const writes = [...deltas]
      .filter(([, delta]) => delta !== 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, delta]) => ({
        updateOne: {
          filter: {
            _id: new Types.ObjectId(id),
            ...(delta < 0 ? { stock: { $gte: -delta } } : {}),
          },
          update: { $inc: { stock: delta, version: 1 } },
        },
      }));
    if (!writes.length) return;
    const requiredStock = [...deltas].filter(([, delta]) => delta < 0);
    if (requiredStock.length) {
      const products = await this.products
        .find({
          _id: { $in: requiredStock.map(([id]) => new Types.ObjectId(id)) },
        })
        .select('_id name stock')
        .session(session)
        .lean();
      const stockById = new Map(
        products.map((product) => [product._id.toString(), product.stock]),
      );
      const insufficientIds = requiredStock
        .filter(([id, delta]) => (stockById.get(id) ?? -1) < -delta)
        .map(([id]) => id);
      if (insufficientIds.length) {
        const insufficientSet = new Set(insufficientIds);
        const names = products
          .filter((product) => insufficientSet.has(product._id.toString()))
          .map((product) => product.name);
        throw new ConflictException({
          message: `Insufficient stock for ${names.join(', ')}. Refresh quantities and try again.`,
          code: 'INSUFFICIENT_STOCK',
          productIds: insufficientIds,
        });
      }
    }
    const result = await this.products.bulkWrite(writes, { session });
    if (result.matchedCount !== writes.length)
      throw new ConflictException(
        'Insufficient stock for a selected medicine. Refresh quantities and try again.',
      );
  }
  async create(dto: CreateOrderDto) {
    if (!!dto.customerId === !!dto.customer)
      throw new BadRequestException(
        'Select a customer or provide a new customer, not both.',
      );
    const existing = await this.orders
      .findOne({ requestId: dto.requestId })
      .lean();
    if (existing) {
      if (existing.deletedAt)
        throw new ConflictException(
          'This request was already used for a deleted order.',
        );
      return existing;
    }
    const invoiceNumber = await this.numbers.next(
      'invoice',
      this.orders.collection.collectionName,
    );
    try {
      return await this.connection.transaction(async (session) => {
        let customer = dto.customerId
          ? await this.customers.findById(dto.customerId).session(session)
          : null;
        if (dto.customer) {
          if (!dto.customer.name.trim())
            throw new BadRequestException('Customer name is required.');
          [customer] = await this.customers.create(
            [{ ...dto.customer, name: dto.customer.name.trim() }],
            { session },
          );
        }
        if (!customer) throw new NotFoundException('Customer not found.');
        const billing = dto.billingDetails ?? customer;
        if (!billing.name.trim())
          throw new BadRequestException('Billing name is required.');
        const items = await this.prepareItems(dto.items, session);
        const totals = this.totals(
          items,
          dto.receivedAmount,
          customer.balanceCents,
        );
        await this.adjustStock([], items, session);
        // Touching the customer serializes simultaneous bills/payments for accurate carried balances.
        await this.customers.updateOne(
          { _id: customer._id },
          {
            $inc: { balanceCents: totals.remainingCents },
            $set: { updatedAt: new Date() },
          },
          { session },
        );
        const now = new Date();
        const [order] = await this.orders.create(
          [
            {
              requestId: dto.requestId,
              invoiceNumber,
              customerId: customer._id,
              customerName: billing.name.trim(),
              customerAddress: billing.address,
              customerPhone: billing.phone,
              remarks: dto.remarks?.trim() ?? '',
              items,
              ...totals,
              statusUpdatedAt: now,
              statusHistory: [
                {
                  status: totals.status,
                  at: now,
                  receivedCents: totals.receivedCents,
                },
              ],
            },
          ],
          { session },
        );
        return order.toObject();
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const order = await this.orders
          .findOne({ requestId: dto.requestId, deletedAt: null })
          .lean();
        if (order) return order;
      }
      throw error;
    }
  }
  async update(id: string, dto: UpdateOrderDto | PaymentDto) {
    return this.connection.transaction(async (session) => {
      const order = await this.orders
        .findOne({ _id: id, deletedAt: null })
        .session(session);
      if (!order) throw new NotFoundException('Order not found.');
      if (order.version !== dto.version)
        throw new ConflictException('Order changed. Refresh before updating.');
      const items =
        'items' in dto
          ? await this.prepareItems(dto.items, session, order.items)
          : order.items;
      const totals = this.totals(
        items,
        dto.receivedAmount,
        order.previousPendingCents,
      );
      if ('items' in dto) await this.adjustStock(order.items, items, session);
      await this.customers.updateOne(
        { _id: order.customerId },
        {
          $inc: { balanceCents: totals.remainingCents - order.remainingCents },
          $set: { updatedAt: new Date() },
        },
        { session },
      );
      if (order.status !== totals.status) {
        order.statusUpdatedAt = new Date();
        order.statusHistory.push({
          status: totals.status,
          at: order.statusUpdatedAt,
          receivedCents: totals.receivedCents,
        });
      }
      order.set({ ...totals, items, version: order.version + 1 });
      if ('remarks' in dto && dto.remarks !== undefined)
        order.set({ remarks: dto.remarks.trim() });
      if ('billingDetails' in dto && dto.billingDetails) {
        if (!dto.billingDetails.name.trim())
          throw new BadRequestException('Billing name is required.');
        order.set({
          customerName: dto.billingDetails.name.trim(),
          customerAddress: dto.billingDetails.address,
          customerPhone: dto.billingDetails.phone,
        });
      }
      await order.save({ session });
      return order.toObject();
    });
  }
  async remove(id: string, version: number) {
    return this.connection.transaction(async (session) => {
      const order = await this.orders
        .findOne({ _id: id, deletedAt: null })
        .session(session);
      if (!order) throw new NotFoundException('Order not found.');
      if (order.version !== version)
        throw new ConflictException('Order changed. Refresh before deleting.');
      await this.adjustStock(order.items, [], session);
      await this.customers.updateOne(
        { _id: order.customerId },
        {
          $inc: { balanceCents: -order.remainingCents },
          $set: { updatedAt: new Date() },
        },
        { session },
      );
      order.deletedAt = new Date();
      order.version += 1;
      await order.save({ session });
      return { success: true };
    });
  }
}
